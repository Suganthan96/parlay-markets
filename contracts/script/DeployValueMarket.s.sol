// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {LmsrMarket} from "../src/LmsrMarket.sol";

/// Non-sports market (price / politics / any data feed). matchId = keccak256(MATCH_KEY); register the same
/// key's hash under `sources` in cre/market-resolver/config.staging.json so the CRE workflow knows what to fetch.
/// Env: MATCH_KEY, QUESTION_HOME (default Yes), QUESTION_AWAY (default No), KICKOFF_IN_MIN (default 10).
contract DeployValueMarket is Script {
    address constant USDC     = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    address constant RESOLVER = 0x79AcDa877B38570d4A2e7Ee84dC5AA60E6AeE934;

    function run() external {
        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        LmsrMarket m = new LmsrMarket(
            USDC, RESOLVER,
            keccak256(bytes(vm.envString("MATCH_KEY"))),
            vm.envOr("QUESTION_HOME", string("Yes")),
            vm.envOr("QUESTION_AWAY", string("No")),
            block.timestamp + vm.envOr("KICKOFF_IN_MIN", uint256(10)) * 60
        );
        console.log("VALUE_MARKET", address(m));
        vm.stopBroadcast();
    }
}
