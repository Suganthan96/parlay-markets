// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @notice Snapshot of the swap's input/output tokens and direction passed to Extruction targets.
struct SwapQuery {
    bytes32 orderHash;
    address maker;
    address taker;
    address tokenIn;
    address tokenOut;
    bool    isExactIn;
}

/// @notice Running register set during SwapVM program execution.
struct SwapRegisters {
    uint256 balanceIn;   // virtual balance of tokenIn  (from Aqua)
    uint256 balanceOut;  // virtual balance of tokenOut (from Aqua)
    uint256 amountIn;    // tokens taker pays
    uint256 amountOut;   // tokens taker receives
    uint256 surcharge;   // protocol fee accumulator
}

/// @notice Stateful custom SwapVM instruction (opcode 0x04).
interface IExtruction {
    function extruction(
        bool isStaticContext,
        uint256 nextPC,
        SwapQuery calldata query,
        SwapRegisters calldata swap,
        bytes calldata args,
        bytes calldata takerData
    ) external returns (
        uint256 updatedNextPC,
        uint256 choppedLength,
        SwapRegisters memory updatedSwap
    );
}

/// @notice Read-only variant — called when SwapVM is in static (quote) context.
interface IStaticExtruction {
    function extruction(
        bool isStaticContext,
        uint256 nextPC,
        SwapQuery calldata query,
        SwapRegisters calldata swap,
        bytes calldata args,
        bytes calldata takerData
    ) external view returns (
        uint256 updatedNextPC,
        uint256 choppedLength,
        SwapRegisters memory updatedSwap
    );
}
