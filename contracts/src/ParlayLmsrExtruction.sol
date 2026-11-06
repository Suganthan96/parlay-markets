// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {IExtruction, IStaticExtruction, SwapQuery, SwapRegisters} from "./interfaces/IExtruction.sol";
import {LmsrMarket} from "./LmsrMarket.sol";

/// @notice Custom SwapVM Extruction (opcode 0x04) that prices parlays via LMSR.
///
/// Program slot in an Aqua SwapVM order:
///   [0x04][argsLen][address(this)][count][market0][outcome0][market1][outcome1]...
///
/// The extruction sets amountOut (exact-in) or amountIn (exact-out) based on the
/// product of LMSR marginal prices across all legs, plus a 10 % house margin.
///
/// Token convention: tokenIn = USDC (taker pays), tokenOut = ParlayToken (taker receives).
/// 1 ParlayToken redeems for 1 USDC on a full-parlay win, so:
///   amountOut = amountIn / parlayPrice   (more tokens = bigger potential payout)
contract ParlayLmsrExtruction is IExtruction, IStaticExtruction {
    uint256 internal constant WAD        = 1e18;
    uint256 internal constant MARGIN_WAD = 1_100_000_000_000_000_000; // 1.1 × WAD (10 % margin)

    // ── IExtruction + IStaticExtruction ─────────────────────────────────────
    // A `view` function satisfies both the non-view IExtruction and the view
    // IStaticExtruction interfaces. Single implementation, override both.

    function extruction(
        bool /*isStaticContext*/,
        uint256 nextPC,
        SwapQuery calldata query,
        SwapRegisters calldata swap,
        bytes calldata args,
        bytes calldata /*takerData*/
    ) external view override(IExtruction, IStaticExtruction) returns (uint256, uint256, SwapRegisters memory) {
        return _price(nextPC, query, swap, args);
    }

    // ── Internal pricing ─────────────────────────────────────────────────────

    function _price(
        uint256 nextPC,
        SwapQuery calldata query,
        SwapRegisters calldata swap,
        bytes calldata args
    ) internal view returns (uint256 updatedNextPC, uint256 choppedLength, SwapRegisters memory out) {
        (address[] memory markets, uint256[] memory outcomes) = _decodeArgs(args);

        // Combined LMSR price as a WAD fraction (product of per-leg marginal prices).
        uint256 combinedPrice = WAD;
        for (uint256 i; i < markets.length; ++i) {
            uint256 legPrice = LmsrMarket(markets[i]).priceOf(outcomes[i]);
            combinedPrice = combinedPrice * legPrice / WAD;
        }
        require(combinedPrice > 0, "Extruction: zero price");

        // Apply 10 % house margin: effective price = combined * 1.1
        uint256 parlayPrice = combinedPrice * MARGIN_WAD / WAD;

        out = swap;

        if (query.isExactIn) {
            // amountOut = amountIn / parlayPrice  (tokens have same 6-dec decimals)
            uint256 rawOut = swap.amountIn * WAD / parlayPrice;
            // Cap at available Aqua balance for tokenOut
            out.amountOut = rawOut < swap.balanceOut ? rawOut : swap.balanceOut;
        } else {
            // amountIn = amountOut * parlayPrice
            out.amountIn = swap.amountOut * parlayPrice / WAD;
        }

        // Return type(uint256).max to signal end-of-program to SwapVM's runLoop.
        updatedNextPC = type(uint256).max;
        choppedLength = 0;
    }

    // ── Args encoding ────────────────────────────────────────────────────────
    //
    // Compact packed format (fits in 255-byte SwapVM args field):
    //   [uint8 count][address market0][uint8 outcome0][address market1][uint8 outcome1]...
    //
    // Max legs: 11 × 21 bytes = 231 bytes < 255 ✓

    function _decodeArgs(bytes calldata args) internal pure returns (
        address[] memory markets,
        uint256[] memory outcomes
    ) {
        require(args.length >= 1, "Extruction: empty args");
        uint8 count = uint8(args[0]);
        require(args.length >= 1 + uint256(count) * 21, "Extruction: args too short");

        markets  = new address[](count);
        outcomes = new uint256[](count);

        uint256 offset = 1;
        for (uint8 i; i < count; ++i) {
            markets[i]  = address(bytes20(args[offset : offset + 20]));
            outcomes[i] = uint8(args[offset + 20]);
            offset += 21;
        }
    }

    /// @notice Build the args bytes to embed in a SwapVM Extruction instruction.
    function encodeArgs(address[] calldata markets, uint8[] calldata outcomes)
        external pure returns (bytes memory)
    {
        require(markets.length == outcomes.length, "length mismatch");
        require(markets.length <= 11, "too many legs");
        bytes memory out_ = abi.encodePacked(uint8(markets.length));
        for (uint256 i; i < markets.length; ++i) {
            out_ = bytes.concat(out_, abi.encodePacked(markets[i], outcomes[i]));
        }
        return out_;
    }

    /// @notice Build the full SwapVM Extruction instruction bytes for embedding in order.data.
    ///   Layout: [0x04][argsLen][address(this)][count][market0][o0]...
    function buildInstruction(address[] calldata markets, uint8[] calldata outcomes)
        external view returns (bytes memory)
    {
        bytes memory extArgs = this.encodeArgs(markets, outcomes);
        uint8 argsLen = uint8(20 + extArgs.length); // address(20) + extArgs
        return bytes.concat(
            bytes1(0x04),                     // Extruction opcode
            bytes1(argsLen),
            bytes20(address(this)),
            extArgs
        );
    }

    /// @notice Build a complete order.data payload for an Aqua SwapVM order.
    ///   data = abi.encodePacked(tokenA, tokenB) + extructionProgram
    ///   tokenA MUST be < tokenB (SwapVM canonical ordering).
    function buildOrderData(
        address tokenA,
        address tokenB,
        address[] calldata markets,
        uint8[]  calldata outcomes
    ) external view returns (bytes memory) {
        require(tokenA < tokenB, "tokens must be sorted: tokenA < tokenB");
        bytes memory program = this.buildInstruction(markets, outcomes);
        return bytes.concat(abi.encodePacked(tokenA, tokenB), program);
    }

    /// @notice Build MakerTraits uint256 for an Aqua order with no hooks.
    ///   Bit 254 = USE_AQUA_INSTEAD_OF_SIGNATURE
    ///   Bits 160-223 = four hook end-offsets all = 40 (program starts right after token pair)
    ///   Bits 0-159 = receiver (0 → defaults to maker)
    function buildAquaMakerTraits() external pure returns (uint256) {
        uint256 USE_AQUA = 1 << 254;
        // 4 × uint16 hook end-offsets = 40 each, packed big-endian into 8 bytes
        // PreTransferIn=40, PostTransferIn=40, PreTransferOut=40, PostTransferOut=40
        uint64 hookOffsets = 0x0028002800280028; // 0x0028 = 40
        return USE_AQUA | (uint256(hookOffsets) << 160);
    }

    /// @notice Build the 22-byte TakerTraits prefix for an Aqua exact-in A→B swap.
    ///   flags = IS_EXACT_IN(0x0001) | USE_TRANSFER_FROM_AND_AQUA_PUSH(0x0040) | IS_A_TO_B(0x0080)
    function buildAquaTakerTraits() external pure returns (bytes memory) {
        // 20 zero bytes (all slice indexes = 0, no threshold/to/deadline/callbacks)
        // then uint16 flags = 0x00C1
        bytes memory out_ = new bytes(22);
        out_[20] = 0x00;
        out_[21] = 0xC1;
        return out_;
    }
}
