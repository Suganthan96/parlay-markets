// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {LmsrMarket} from "../src/LmsrMarket.sol";
import {MarketResolver} from "../src/MarketResolver.sol";

/// Demo markets for the CRE monitor: real finished ESPN EPL events, kickoff in the past,
/// so the monitor can immediately request settlement and CRE resolves from real scores.
contract DeployDemoMarkets is Script {
    address constant USDC     = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    address constant FORWARDER = 0x15fC6ae953E024d975e77382eEeC56A9101f9F88;

    function run() external {
        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        // Resolver deployed earlier with FORWARDER as cre(); reused for every demo market.
        address RESOLVER = 0x79AcDa877B38570d4A2e7Ee84dC5AA60E6AeE934;
        // Two live markets for the demo. Kickoff is in KICKOFF_IN_MIN minutes (default 10): the CRE monitor
        // discovers them from MarketCreated immediately but waits for kickoff, so you can LP + buy first.
        // ESPN ids are finished EPL events (740697 Aston Villa 4-0 Bournemouth, 740698 Brentford 3-1 Newcastle).
        uint256 kickoff = block.timestamp + vm.envOr("KICKOFF_IN_MIN", uint256(10)) * 60;
        LmsrMarket a = new LmsrMarket(USDC, RESOLVER, bytes32(uint256(740697)), "Aston Villa", "Bournemouth", kickoff);
        LmsrMarket b = new LmsrMarket(USDC, RESOLVER, bytes32(uint256(740698)), "Brentford", "Newcastle", kickoff);
        console.log("MARKET_A", address(a));
        console.log("MARKET_B", address(b));
        vm.stopBroadcast();
    }
}
