// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Script, console} from "forge-std/Script.sol";
import {MockUSDC}       from "../src/MockUSDC.sol";
import {MarketResolver} from "../src/MarketResolver.sol";
import {LmsrMarket}     from "../src/LmsrMarket.sol";
import {ParlayVault}    from "../src/ParlayVault.sol";
import {ParlayRouter}   from "../src/ParlayRouter.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer    = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        // 1. MockUSDC
        MockUSDC usdc = new MockUSDC();
        console.log("MockUSDC:       ", address(usdc));

        // 2. MarketResolver (CRE address set to deployer for testnet; update after CRE deploy)
        MarketResolver resolver = new MarketResolver(deployer);
        console.log("MarketResolver: ", address(resolver));

        // 3. Two LmsrMarkets (generic sport events for hackathon demo)
        LmsrMarket marketA = new LmsrMarket(
            address(usdc),
            address(resolver),
            keccak256("MATCH_001"),
            "Team Alpha",
            "Team Beta",
            block.timestamp + 2 days
        );
        console.log("LmsrMarket A:   ", address(marketA));

        LmsrMarket marketB = new LmsrMarket(
            address(usdc),
            address(resolver),
            keccak256("MATCH_002"),
            "Team Gamma",
            "Team Delta",
            block.timestamp + 2 days
        );
        console.log("LmsrMarket B:   ", address(marketB));

        // 4. ParlayVault (router address not known yet — set after router deploy)
        //    Use a temporary address; update with vault.setRouter() pattern or redeploy
        //    For the script we do: deploy vault with placeholder, deploy router, then
        //    we need vault constructor to accept router. We'll deploy router first with
        //    vault address predicted via CREATE — simpler: deploy vault with zero router,
        //    then set router after. For hackathon we just redeploy in correct order:
        //    Deploy router address is deterministic: nonce(deployer) + 2 more deploys.
        //    Easiest: predict vault addr or deploy in two passes. For simplicity, use
        //    a two-step: deploy vault with zero addr, then deploy router, then update.
        //    But ParlayVault has immutable parlayRouter — can't update.
        //    Solution: deploy router first with vault address computed via CREATE2 or
        //    just use a nonce-based prediction.
        //
        //    Nonce prediction:
        //    After this point: deployer nonce = base + 4 (usdc, resolver, mktA, mktB)
        //    vault nonce = base + 4  (next deploy)
        //    router nonce = base + 5
        //    vault addr = computeCreateAddress(deployer, nonce+4)
        //    router addr = computeCreateAddress(deployer, nonce+5)

        uint256 vaultNonce  = vm.getNonce(deployer);     // current = base+4
        uint256 routerNonce = vaultNonce + 1;

        address vaultAddr  = vm.computeCreateAddress(deployer, vaultNonce);
        address routerAddr = vm.computeCreateAddress(deployer, routerNonce);

        ParlayVault vault = new ParlayVault(address(usdc), routerAddr);
        require(address(vault) == vaultAddr, "Deploy: vault addr mismatch");
        console.log("ParlayVault:    ", address(vault));

        ParlayRouter router = new ParlayRouter(address(usdc), address(vault));
        require(address(router) == routerAddr, "Deploy: router addr mismatch");
        console.log("ParlayRouter:   ", address(router));

        // 5. Seed LP liquidity into markets (100 USDC each, b = 100 WAD)
        uint256 lpAmount = 100e6; // 100 USDC
        int256  b        = 100e18;

        usdc.mint(deployer, lpAmount * 2);
        usdc.approve(address(marketA), lpAmount);
        marketA.ship(lpAmount, b);

        usdc.approve(address(marketB), lpAmount);
        marketB.ship(lpAmount, b);

        // 6. Fund vault so it can pay out winners (500 USDC safety buffer)
        uint256 vaultFund = 500e6;
        usdc.mint(deployer, vaultFund);
        usdc.transfer(address(vault), vaultFund);

        vm.stopBroadcast();

        console.log("=== DEPLOYMENT COMPLETE ===");
        console.log("Add these to .env.local:");
        console.log("NEXT_PUBLIC_MOCK_USDC=",        address(usdc));
        console.log("NEXT_PUBLIC_MARKET_RESOLVER=",  address(resolver));
        console.log("NEXT_PUBLIC_PARLAY_VAULT=",     address(vault));
        console.log("NEXT_PUBLIC_PARLAY_ROUTER=",    address(router));
        console.log("MARKET_A=",                     address(marketA));
        console.log("MARKET_B=",                     address(marketB));
    }

}
