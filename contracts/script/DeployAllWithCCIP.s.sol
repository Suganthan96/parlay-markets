// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Script, console} from "forge-std/Script.sol";
import {MockUSDC}           from "../src/MockUSDC.sol";
import {MarketResolver}     from "../src/MarketResolver.sol";
import {LmsrMarket}         from "../src/LmsrMarket.sol";
import {ParlayVault}        from "../src/ParlayVault.sol";
import {AquaParlayRouter}   from "../src/AquaParlayRouter.sol";
import {CCIPParlayReceiver} from "../src/CCIPParlayReceiver.sol";
import {IAqua}              from "../src/interfaces/IAqua.sol";
import {IERC20}             from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

address constant AQUA               = 0x1111113CCf1426A8E30e2bfF5E005d929bF6a90a;
address constant CCIP_ROUTER_SEPOLIA = 0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59;

/// @notice Full deployment on Ethereum Sepolia:
///   MockUSDC + LmsrMarkets + ParlayVault + AquaParlayRouter + CCIPParlayReceiver
///
/// Env vars:
///   PRIVATE_KEY — deployer key
contract DeployAllWithCCIP is Script {

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer    = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        // ── 1. MockUSDC ───────────────────────────────────────────────
        MockUSDC usdc = new MockUSDC();
        console.log("MockUSDC:          ", address(usdc));

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

        // ── 6. Seed LMSR liquidity (500 USDC each, b=200) ────────────
        uint256 lmsrSeed = 500e6;
        int256  b        = 200e18;

        usdc.mint(deployer, lmsrSeed * 2);
        usdc.approve(address(marketA), lmsrSeed);
        marketA.ship(lmsrSeed, b);

        usdc.approve(address(marketB), lmsrSeed);
        marketB.ship(lmsrSeed, b);
        console.log("LMSR seeded: 500 USDC each, b=200");

        // ── 7. Fund receiver USDC reserve (100 USDC for CCIP payouts) ─
        uint256 ccipReserve = 100e6;
        usdc.mint(deployer, ccipReserve);
        usdc.approve(address(receiver), ccipReserve);
        receiver.fundReserve(ccipReserve);
        console.log("CCIPParlayReceiver funded with 100 USDC reserve");

        // ── 8. Aqua payout reserve (2000 USDC) ───────────────────────
        uint256 aquaReserve = 2000e6;
        usdc.mint(deployer, aquaReserve);
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

        // ── 9. Test USDC for deployer ─────────────────────────────────
        usdc.mint(deployer, 100e6);
        console.log("Minted 100 USDC to deployer for testing");

        vm.stopBroadcast();

        console.log("");
        console.log("=== DEPLOYMENT COMPLETE - copy to .env.local ===");
        console.log("NEXT_PUBLIC_MOCK_USDC=", address(usdc));
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
