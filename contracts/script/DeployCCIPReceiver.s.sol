// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Script, console} from "forge-std/Script.sol";
import {CCIPParlayReceiver} from "../src/CCIPParlayReceiver.sol";
import {ParlayVault} from "../src/ParlayVault.sol";

/// @notice Deploy CCIPParlayReceiver on Ethereum Sepolia and wire it to ParlayVault.
///
/// Required env vars:
///   PRIVATE_KEY            — deployer key
///   BASE_GATEWAY_ADDRESS   — CCIPParlayGateway address on Base Sepolia (set after that deploy)
///
/// Fixed addresses (Ethereum Sepolia):
///   CCIP Router   : 0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59
///   ParlayVault   : 0x8d98ff91515b47f8a2b89d00cb597497dc47fbe0
///   USDC (Circle) : 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
contract DeployCCIPReceiver is Script {
    // ── Ethereum Sepolia addresses ───────────────────────────────────
    address constant CCIP_ROUTER    = 0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59;
    address constant PARLAY_VAULT   = 0x8D98FF91515b47f8A2B89D00cB597497Dc47fbE0;
    address constant USDC           = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238; // Circle USDC, Sepolia

    function run() external {
        uint256 deployerKey   = vm.envUint("PRIVATE_KEY");
        // BASE_GATEWAY_ADDRESS is optional — set later via setGateway() once gateway is deployed
        address baseGateway   = vm.envOr("BASE_GATEWAY_ADDRESS", address(0));

        vm.startBroadcast(deployerKey);

        // 1. Deploy CCIPParlayReceiver (gateway wired after Base Sepolia deploy)
        CCIPParlayReceiver receiver = new CCIPParlayReceiver(
            CCIP_ROUTER,
            PARLAY_VAULT,
            USDC
        );
        console.log("CCIPParlayReceiver:", address(receiver));

        // If gateway already known, wire it now
        if (baseGateway != address(0)) {
            receiver.setGateway(baseGateway);
            console.log("Gateway wired:", baseGateway);
        }

        // 2. Wire receiver into ParlayVault (one-time setter)
        ParlayVault(PARLAY_VAULT).setCcipReceiver(address(receiver));
        console.log("ParlayVault.ccipReceiver set to:", address(receiver));

        vm.stopBroadcast();

        console.log("--- Sepolia CCIP Receiver deployment complete ---");
        console.log("CCIPParlayReceiver:", address(receiver));
        console.log("Next: set SEPOLIA_RECEIVER_ADDRESS=<above> and run DeployCCIPGateway on Base Sepolia");
        console.log("Then call setGateway(<gateway>) on the receiver");
    }
}
