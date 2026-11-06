// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Script, console} from "forge-std/Script.sol";
import {AquaParlayRouter} from "../src/AquaParlayRouter.sol";

/// @notice Deploy AquaParlayRouter on top of the existing deployment.
contract DeployAqua is Script {
    // Addresses from the main Deploy.s.sol run
    address constant MOCK_USDC   = 0x14e8926E63443237D4DCAc9dD47746Bee669fCD3;
    address constant PARLAY_VAULT = 0xF5cc3E8267035bEce44c67a06f9fee0CfC40BAb7;
    address constant MARKET_A    = 0xd129A5d7dB93aeE29123Df19c37934735eb00140;
    address constant MARKET_B    = 0x9e8E15C325C613a3304115CE294BfDEFde0F3785;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer    = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        AquaParlayRouter router = new AquaParlayRouter(MOCK_USDC, PARLAY_VAULT);
        console.log("AquaParlayRouter:", address(router));

        // Compute the strategy hash for both markets so LP and UI can use it
        address[] memory markets = new address[](2);
        markets[0] = MARKET_A;
        markets[1] = MARKET_B;
        bytes32 strategyHash = router.strategyHashFor(markets);
        console.log("Strategy hash (both markets):");
        console.logBytes32(strategyHash);

        // Print LP instructions
        console.log("=== LP INSTRUCTIONS ===");
        console.log("1. Approve Aqua to pull your USDC:");
        console.log("   usdc.approve(0x1111113CCf1426A8E30e2bfF5E005d929bF6a90a, reserveAmount)");
        console.log("2. Ship to Aqua:");
        console.log("   router.lpShipAqua([MARKET_A, MARKET_B], reserveAmount)");
        console.log("3. Users can now buy parlays via:");
        console.log("   router.buyParlay(lp, strategyHash, markets, outcomes, stake, minPayout)");

        console.log("=== DEPLOYMENT COMPLETE ===");
        console.log("Add to .env.local:");
        console.log("NEXT_PUBLIC_AQUA_ROUTER=", address(router));

        vm.stopBroadcast();
    }
}
