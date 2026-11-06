// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Script, console} from "forge-std/Script.sol";
import {CCIPParlayReceiver} from "../src/CCIPParlayReceiver.sol";
import {ParlayVault} from "../src/ParlayVault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Deploy CCIPParlayReceiver on Ethereum Sepolia and wire it to ParlayVault.
///
/// Required env vars:
///   PRIVATE_KEY            — deployer key
///   BASE_GATEWAY_ADDRESS   — CCIPParlayGateway address on Base Sepolia (set after that deploy)
///
/// Fixed addresses (Ethereum Sepolia):
///   CCIP Router   : 0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59
///   ParlayVault   : 0x8d98ff91515b47f8a2b89d00cb597497dc47fbe0
///   MockUSDC      : 0xaff7d282ac4e256118a5b0ce55017bd8cd62388a
contract DeployCCIPReceiver is Script {
    // ── Ethereum Sepolia addresses ───────────────────────────────────
    address constant CCIP_ROUTER    = 0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59;
    address constant PARLAY_VAULT   = 0x8D98FF91515b47f8A2B89D00cB597497Dc47fbE0;
    address constant MOCK_USDC      = 0xAFf7d282AC4e256118A5B0ce55017bD8cd62388A;

    function run() external {
        uint256 deployerKey   = vm.envUint("PRIVATE_KEY");
        // BASE_GATEWAY_ADDRESS is optional — set later via setGateway() once gateway is deployed
        address baseGateway   = vm.envOr("BASE_GATEWAY_ADDRESS", address(0));

        vm.startBroadcast(deployerKey);

        // 1. Deploy CCIPParlayReceiver (gateway wired after Base Sepolia deploy)
        CCIPParlayReceiver receiver = new CCIPParlayReceiver(
            CCIP_ROUTER,
            PARLAY_VAULT,
            MOCK_USDC
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

        // 3. Fund receiver with 100 USDC reserve (deployer must hold USDC)
        uint256 reserve = 100 * 1e6; // 100 USDC
        IERC20(MOCK_USDC).approve(address(receiver), reserve);
        receiver.fundReserve(reserve);
        console.log("Funded receiver with 100 USDC reserve");

        vm.stopBroadcast();

        console.log("--- Sepolia CCIP Receiver deployment complete ---");
        console.log("CCIPParlayReceiver:", address(receiver));
        console.log("Next: set SEPOLIA_RECEIVER_ADDRESS=<above> and run DeployCCIPGateway on Base Sepolia");
        console.log("Then call setGateway(<gateway>) on the receiver");
    }
}
