// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @notice Minimal interface for the 1inch SwapVM router.
/// Order struct and trait encoding match the ABI-level layout of the deployed contracts.
interface ISwapVM {
    /// @dev ABI-compatible with SwapVM's Order { maker, MakerTraits(uint256), bytes data }.
    struct Order {
        address maker;
        uint256 traits;  // MakerTraits (custom type wrapping uint256 — same ABI)
        bytes   data;    // abi.encodePacked(tokenA, tokenB) + program
    }

    /// @notice Execute a swap defined by an on-chain or Aqua order.
    /// @param order         The swap order.
    /// @param amount        For exact-in: amount of tokenIn; for exact-out: amount of tokenOut.
    /// @param takerData     22-byte TakerTraits header + optional threshold/to/deadline/etc.
    function swap(
        Order calldata order,
        uint256 amount,
        bytes calldata takerData
    ) external returns (uint256 takerAmount, uint256 makerAmount);

    /// @notice Quote a swap without state changes.
    function quote(
        Order calldata order,
        uint256 amount,
        bytes calldata takerData
    ) external view returns (uint256 takerAmount, uint256 makerAmount);
}
