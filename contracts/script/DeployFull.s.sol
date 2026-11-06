// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Script, console} from "forge-std/Script.sol";
import {MockUSDC}          from "../src/MockUSDC.sol";
import {MarketResolver}    from "../src/MarketResolver.sol";
import {LmsrMarket}        from "../src/LmsrMarket.sol";
import {ParlayVault}       from "../src/ParlayVault.sol";
import {AquaParlayRouter}  from "../src/AquaParlayRouter.sol";

address constant AQUA = 0x1111113CCf1426A8E30e2bfF5E005d929bF6a90a;

contract DeployFull is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer    = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        // ── 1. MockUSDC ───────────────────────────────────────────────────────
        MockUSDC usdc = new MockUSDC();
        console.log("MockUSDC:          ", address(usdc));

        // ── 2. MarketResolver ─────────────────────────────────────────────────
        MarketResolver resolver = new MarketResolver(deployer);
        console.log("MarketResolver:    ", address(resolver));

        // ── 3. LmsrMarkets with real match names ─────────────────────────────
        LmsrMarket marketA = new LmsrMarket(
            address(usdc), address(resolver),
            keccak256("EPL_MCI_ARS_2026"),
            "Man City", "Arsenal",
            block.timestamp + 3 days
        );
        console.log("LmsrMarket A (Man City vs Arsenal): ", address(marketA));

        LmsrMarket marketB = new LmsrMarket(
            address(usdc), address(resolver),
            keccak256("UCL_RMA_BAR_2026"),
            "Real Madrid", "Barcelona",
            block.timestamp + 3 days
        );
        console.log("LmsrMarket B (Real Madrid vs Barcelona): ", address(marketB));

        // ── 4. ParlayVault + AquaParlayRouter (nonce prediction) ─────────────
        // vault nonce = N, aquaRouter nonce = N+1
        // vault needs aquaRouter addr upfront; predict via nonce
        uint256 vaultNonce      = vm.getNonce(deployer);
        uint256 aquaRouterNonce = vaultNonce + 1;
        address vaultAddr       = vm.computeCreateAddress(deployer, vaultNonce);
        address aquaRouterAddr  = vm.computeCreateAddress(deployer, aquaRouterNonce);

        // Vault authorises AquaParlayRouter (not old ParlayRouter) as the only minter
        ParlayVault vault = new ParlayVault(address(usdc), aquaRouterAddr);
        require(address(vault) == vaultAddr, "vault addr mismatch");
        console.log("ParlayVault:       ", address(vault));

        // ── 5. AquaParlayRouter ───────────────────────────────────────────────
        AquaParlayRouter aquaRouter = new AquaParlayRouter(address(usdc), address(vault));
        require(address(aquaRouter) == aquaRouterAddr, "aquaRouter addr mismatch");
        console.log("AquaParlayRouter:  ", address(aquaRouter));

        // ── 6. Seed LMSR liquidity (500 USDC each, b = 200 WAD) ──────────────
        uint256 lmsrSeed = 500e6;
        int256  b        = 200e18;

        usdc.mint(deployer, lmsrSeed * 2);
        usdc.approve(address(marketA), lmsrSeed);
        marketA.ship(lmsrSeed, b);

        usdc.approve(address(marketB), lmsrSeed);
        marketB.ship(lmsrSeed, b);

        console.log("LMSR seeded: 500 USDC each, b=200");

        // ── 7. Mint USDC for LP Aqua payout reserve ───────────────────────────
        uint256 aquaReserve = 2000e6; // 2000 USDC payout reserve
        usdc.mint(deployer, aquaReserve);
        console.log("Minted 2000 USDC to deployer for Aqua reserve");

        // ── 8. Approve Aqua to pull from deployer wallet ──────────────────────
        usdc.approve(AQUA, aquaReserve);
        console.log("Approved Aqua for 2000 USDC");

        // ── 9. Ship virtual liquidity to Aqua ────────────────────────────────
        address[] memory markets = new address[](2);
        markets[0] = address(marketA);
        markets[1] = address(marketB);

        bytes32 strategyHash = aquaRouter.lpShipAqua(markets, aquaReserve);
        console.log("Shipped to Aqua. Strategy hash:");
        console.logBytes32(strategyHash);

        // ── 10. Mint 100 USDC to deployer so they can test buying parlays ─────
        usdc.mint(deployer, 100e6);
        console.log("Minted 100 USDC to deployer for testing");

        vm.stopBroadcast();

        console.log("=== DEPLOYMENT COMPLETE ===");
        console.log("NEXT_PUBLIC_MOCK_USDC=", address(usdc));
        console.log("NEXT_PUBLIC_MARKET_RESOLVER=", address(resolver));
        console.log("NEXT_PUBLIC_PARLAY_VAULT=", address(vault));
        console.log("NEXT_PUBLIC_AQUA_ROUTER=", address(aquaRouter));
        console.log("NEXT_PUBLIC_MARKETS=", address(marketA), ",", address(marketB));
        console.log("NEXT_PUBLIC_STRATEGY_HASH=");
        console.logBytes32(strategyHash);
        console.log("NEXT_PUBLIC_DEPLOYER=", deployer);
    }
}
