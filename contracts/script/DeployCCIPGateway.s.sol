// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Script, console} from "forge-std/Script.sol";
import {CCIPParlayGateway} from "../src/CCIPParlayGateway.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

/// @notice Deploy CCIPParlayGateway + MockUSDC on Base Sepolia.
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

    function run() external {
        uint256 deployerKey   = vm.envUint("PRIVATE_KEY");
        address sepoliaReceiver = vm.envAddress("SEPOLIA_RECEIVER_ADDRESS");

        vm.startBroadcast(deployerKey);

        // 1. Deploy MockUSDC on Base Sepolia (for the gateway escrow)
        MockUSDC baseUsdc = new MockUSDC();
        console.log("MockUSDC (Base Sepolia):", address(baseUsdc));

        // 2. Mint some test USDC for the deployer so they can test
        address deployer = vm.addr(deployerKey);
        baseUsdc.mint(deployer, 10_000 * 1e6); // 10,000 USDC
        console.log("Minted 10,000 test USDC to deployer on Base Sepolia");

        // 3. Deploy CCIPParlayGateway
        CCIPParlayGateway gateway = new CCIPParlayGateway(
            CCIP_ROUTER,
            sepoliaReceiver,
            address(baseUsdc)
        );
        console.log("CCIPParlayGateway:", address(gateway));

        vm.stopBroadcast();

        console.log("--- Base Sepolia CCIP Gateway deployment complete ---");
        console.log("MockUSDC (Base):     ", address(baseUsdc));
        console.log("CCIPParlayGateway:   ", address(gateway));
        console.log("Sepolia Receiver wired:", sepoliaReceiver);
    }
}
