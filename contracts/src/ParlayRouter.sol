// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {LmsrMarket} from "./LmsrMarket.sol";
import {ParlayVault} from "./ParlayVault.sol";

/// @title ParlayRouter
/// @notice Entry-point for buying a parlay ticket.
///         Reads LMSR prices from N markets, multiplies them (with margin),
///         pulls stake from buyer, approves ParlayVault, mints ticket.
contract ParlayRouter {
    // ── Constants ────────────────────────────────────────────────
    uint256 internal constant WAD = 1e18;
    uint256 internal constant MAX_LEGS = 5;
    // 10% house margin (110/100 = 1.1 × WAD)
    uint256 internal constant MARGIN_WAD = 1_100_000_000_000_000_000; // 1.1e18

    // ── State ────────────────────────────────────────────────────
    address public immutable usdc;
    address public immutable vault;

    // ── Events ───────────────────────────────────────────────────
    event ParlayBought(
        uint256 indexed ticketId,
        address indexed buyer,
        uint256 stakeUsdc,
        uint256 payoutUsdc,
        uint8   legCount
    );

    // ── Constructor ──────────────────────────────────────────────
    constructor(address _usdc, address _vault) {
        usdc  = _usdc;
        vault = _vault;
    }

    // ── Buy ──────────────────────────────────────────────────────

    /// @notice Buy a parlay ticket.
    /// @param markets   Array of LmsrMarket addresses (1–5).
    /// @param outcomes  Outcome index per market (0=Home, 1=Away).
    /// @param stakeUsdc USDC stake (6 dec).
    /// @param minPayout Slippage guard: revert if payout < minPayout.
    /// @return ticketId The minted ticket ID in ParlayVault.
    function buyParlay(
        address[] calldata markets,
        uint256[] calldata outcomes,
        uint256 stakeUsdc,
        uint256 minPayout
    ) external returns (uint256 ticketId) {
        uint256 n = markets.length;
        require(n > 0 && n <= MAX_LEGS, "ParlayRouter: 1-5 legs");
        require(n == outcomes.length, "ParlayRouter: arrays mismatch");
        require(stakeUsdc > 0, "ParlayRouter: zero stake");

        // ── 1. Read prices and validate markets ──────────────────
        uint256[] memory prices = new uint256[](n);
        uint256 combinedPriceWad = WAD; // 1.0 in WAD

        for (uint256 i = 0; i < n; i++) {
            require(markets[i] != address(0), "ParlayRouter: zero market");
            require(outcomes[i] <= 1,         "ParlayRouter: bad outcome");

            LmsrMarket mkt = LmsrMarket(markets[i]);
            require(mkt.result() == LmsrMarket.Outcome.Unresolved,
                    "ParlayRouter: market resolved");

            uint256 p = mkt.priceOf(outcomes[i]);
            require(p > 0 && p < WAD, "ParlayRouter: bad price");

            prices[i]        = p;
            combinedPriceWad = (combinedPriceWad * p) / WAD;
        }

        // ── 2. Apply margin: parlay_price = combined * 1.1 ───────
        uint256 parlayPriceWad = (combinedPriceWad * MARGIN_WAD) / WAD;
        require(parlayPriceWad > 0 && parlayPriceWad < WAD,
                "ParlayRouter: degenerate price");

        // ── 3. Compute payout: payout = stake / parlay_price ─────
        // payout_usdc = stakeUsdc * WAD / parlayPriceWad
        // (stakeUsdc is 6 dec, parlayPriceWad is WAD — result is 6 dec)
        uint256 payoutUsdc = (stakeUsdc * WAD) / parlayPriceWad;
        require(payoutUsdc >= minPayout, "ParlayRouter: slippage");
        require(payoutUsdc > stakeUsdc,  "ParlayRouter: payout <= stake");

        // ── 4. Pull stake from buyer ──────────────────────────────
        _pull(msg.sender, stakeUsdc);

        // ── 5. Approve vault, mint ticket ─────────────────────────
        // Approve vault to pull the stake we just received
        _approve(vault, stakeUsdc);

        ticketId = ParlayVault(vault).mint(
            msg.sender,
            stakeUsdc,
            payoutUsdc,
            markets,
            outcomes,
            prices
        );

        emit ParlayBought(ticketId, msg.sender, stakeUsdc, payoutUsdc, uint8(n));
    }

    // ── Quote (view) ─────────────────────────────────────────────

    /// @notice Off-chain quote: returns combined price and expected payout.
    function quoteParlay(
        address[] calldata markets,
        uint256[] calldata outcomes,
        uint256 stakeUsdc
    ) external view returns (uint256 combinedPriceWad, uint256 payoutUsdc) {
        uint256 n = markets.length;
        combinedPriceWad = WAD;
        for (uint256 i = 0; i < n; i++) {
            uint256 p = LmsrMarket(markets[i]).priceOf(outcomes[i]);
            combinedPriceWad = (combinedPriceWad * p) / WAD;
        }
        uint256 parlayPriceWad = (combinedPriceWad * MARGIN_WAD) / WAD;
        payoutUsdc = (stakeUsdc * WAD) / parlayPriceWad;
    }

    // ── Internal ─────────────────────────────────────────────────

    function _pull(address from, uint256 amount) internal {
        (bool ok, bytes memory data) = usdc.call(
            abi.encodeWithSignature("transferFrom(address,address,uint256)", from, address(this), amount)
        );
        require(ok && (data.length == 0 || abi.decode(data, (bool))), "ParlayRouter: pull");
    }

    function _approve(address spender, uint256 amount) internal {
        (bool ok, bytes memory data) = usdc.call(
            abi.encodeWithSignature("approve(address,uint256)", spender, amount)
        );
        require(ok && (data.length == 0 || abi.decode(data, (bool))), "ParlayRouter: approve");
    }
}
