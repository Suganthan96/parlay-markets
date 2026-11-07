// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Script, console} from "forge-std/Script.sol";
import {CCIPParlayGateway} from "../src/CCIPParlayGateway.sol";

/// @notice Deploy CCIPParlayGateway on Base Sepolia (real Circle USDC).
///
/// Required env vars:
///   PRIVATE_KEY                — deployer key
///   SEPOLIA_RECEIVER_ADDRESS   — CCIPParlayReceiver address on Ethereum Sepolia
///
/// Fixed addresses (Base Sepolia):
///   CCIP Router : 0xD3b06cEbF099CE7DA4AcCf578aaebFDBd6e88a93
contract DeployCCIPGateway is Script {
    // ── Base Sepolia addresses ───────────────────────────────────────
    address constant CCIP_ROUTER = 0xD3b06cEbF099CE7DA4AcCf578aaebFDBd6e88a93;
    /// Circle USDC on Base Sepolia — has a CCIP pool to Sepolia USDC
    address constant BASE_USDC   = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    function run() external {
        uint256 deployerKey   = vm.envUint("PRIVATE_KEY");
        address sepoliaReceiver = vm.envAddress("SEPOLIA_RECEIVER_ADDRESS");

        vm.startBroadcast(deployerKey);

        // Deploy CCIPParlayGateway
        CCIPParlayGateway gateway = new CCIPParlayGateway(
            CCIP_ROUTER,
            sepoliaReceiver,
            BASE_USDC
        );
        console.log("CCIPParlayGateway:", address(gateway));

        vm.stopBroadcast();

        console.log("--- Base Sepolia CCIP Gateway deployment complete ---");
        console.log("USDC (Base Sepolia):   ", BASE_USDC);
        console.log("CCIPParlayGateway:   ", address(gateway));
        console.log("Sepolia Receiver wired:", sepoliaReceiver);
    }
}
