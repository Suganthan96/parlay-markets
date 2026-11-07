// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Script, console} from "forge-std/Script.sol";
import {MarketResolver}     from "../src/MarketResolver.sol";
import {LmsrMarket}         from "../src/LmsrMarket.sol";
import {ParlayVault}        from "../src/ParlayVault.sol";
import {AquaParlayRouter}   from "../src/AquaParlayRouter.sol";
import {CCIPParlayReceiver} from "../src/CCIPParlayReceiver.sol";
import {IAqua}              from "../src/interfaces/IAqua.sol";
import {IERC20}             from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

address constant AQUA               = 0x1111113CCf1426A8E30e2bfF5E005d929bF6a90a;
address constant CCIP_ROUTER_SEPOLIA = 0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59;
/// @dev Circle USDC on Ethereum Sepolia — the CCIP-supported destination of Base Sepolia USDC
address constant SEPOLIA_USDC        = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;

/// @notice Full deployment on Ethereum Sepolia:
///   LmsrMarkets (real Circle USDC) + ParlayVault + AquaParlayRouter + CCIPParlayReceiver
///
/// Env vars:
///   PRIVATE_KEY   — deployer key; must hold Sepolia USDC (https://faucet.circle.com)
///                   covering LMSR_SEED*2 + AQUA_RESERVE_APPROVAL
///   LMSR_SEED     — optional, USDC (6 dec) shipped to each LMSR market (default 2e6)
///   AQUA_RESERVE  — optional, USDC (6 dec) shipped to Aqua (default 10e6)
contract DeployAllWithCCIP is Script {

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer    = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        // ── 1. Real USDC (no mock: bridged stakes from Base Sepolia are Circle USDC)
        IERC20 usdc = IERC20(SEPOLIA_USDC);
        console.log("USDC (Circle, Sepolia):", address(usdc));

        // ── 2. MarketResolver ─────────────────────────────────────────
        MarketResolver resolver = new MarketResolver(deployer);
        console.log("MarketResolver:    ", address(resolver));

        // ── 3. LmsrMarkets ───────────────────────────────────────────
        LmsrMarket marketA = new LmsrMarket(
            address(usdc), address(resolver),
            keccak256("EPL_MCI_ARS_2026"),
            "Man City", "Arsenal",
            block.timestamp + 3 days
        );
        console.log("LmsrMarket (Man City vs Arsenal): ", address(marketA));

        LmsrMarket marketB = new LmsrMarket(
            address(usdc), address(resolver),
            keccak256("UCL_RMA_BAR_2026"),
            "Real Madrid", "Barcelona",
            block.timestamp + 3 days
        );
        console.log("LmsrMarket (Real Madrid vs Barcelona): ", address(marketB));

        // ── 4. ParlayVault + AquaParlayRouter (nonce-predict) ────────
        uint256 vaultNonce      = vm.getNonce(deployer);
        uint256 aquaRouterNonce = vaultNonce + 1;
        address vaultAddr       = vm.computeCreateAddress(deployer, vaultNonce);
        address aquaRouterAddr  = vm.computeCreateAddress(deployer, aquaRouterNonce);

        ParlayVault vault = new ParlayVault(address(usdc), aquaRouterAddr);
        require(address(vault) == vaultAddr, "vault addr mismatch");
        console.log("ParlayVault:       ", address(vault));

        AquaParlayRouter aquaRouter = new AquaParlayRouter(address(usdc), address(vault));
        require(address(aquaRouter) == aquaRouterAddr, "aquaRouter addr mismatch");
        console.log("AquaParlayRouter:  ", address(aquaRouter));

        // ── 5. CCIPParlayReceiver ─────────────────────────────────────
        CCIPParlayReceiver receiver = new CCIPParlayReceiver(
            CCIP_ROUTER_SEPOLIA,
            address(vault),
            address(usdc)
        );
        console.log("CCIPParlayReceiver:", address(receiver));

        // Wire receiver into vault (one-time)
        vault.setCcipReceiver(address(receiver));
        console.log("ParlayVault.ccipReceiver set");

        // ── 6. Seed LMSR liquidity (real USDC from the deployer) ─────
        uint256 lmsrSeed = vm.envOr("LMSR_SEED", uint256(2e6));
        int256  b        = 200e18;

        usdc.approve(address(marketA), lmsrSeed);
        marketA.ship(lmsrSeed, b);

        usdc.approve(address(marketB), lmsrSeed);
        marketB.ship(lmsrSeed, b);
        console.log("LMSR seeded, b=200");

        // ── 7. CCIP receiver needs no reserve: stakes arrive with each message

        // ── 8. Aqua payout reserve ───────────────────────
        uint256 aquaReserve = vm.envOr("AQUA_RESERVE", uint256(10e6));
        usdc.approve(AQUA, aquaReserve);

        address[] memory markets      = new address[](2);
        markets[0] = address(marketA);
        markets[1] = address(marketB);

        address[] memory shipTokens   = new address[](1);
        uint256[] memory shipAmounts  = new uint256[](1);
        shipTokens[0]  = address(usdc);
        shipAmounts[0] = aquaReserve;

        bytes memory strategy   = abi.encode(markets);
        bytes32 strategyHash    = IAqua(AQUA).ship(address(aquaRouter), strategy, shipTokens, shipAmounts);
        console.log("Shipped to Aqua. strategyHash:");
        console.logBytes32(strategyHash);

        vm.stopBroadcast();

        console.log("");
        console.log("=== DEPLOYMENT COMPLETE - copy to .env.local ===");
        console.log("NEXT_PUBLIC_MOCK_USDC= (real Sepolia USDC) ", address(usdc));
        console.log("NEXT_PUBLIC_MARKET_RESOLVER=", address(resolver));
        console.log("NEXT_PUBLIC_PARLAY_VAULT=", address(vault));
        console.log("NEXT_PUBLIC_AQUA_ROUTER=", address(aquaRouter));
        console.log("NEXT_PUBLIC_CCIP_RECEIVER=", address(receiver));
        console.log("NEXT_PUBLIC_MARKET_A=", address(marketA));
        console.log("NEXT_PUBLIC_MARKET_B=", address(marketB));
        console.log("NEXT_PUBLIC_STRATEGY_HASH=");
        console.logBytes32(strategyHash);
    }
}
