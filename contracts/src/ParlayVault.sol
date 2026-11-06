// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {LmsrMarket} from "./LmsrMarket.sol";

/// @title ParlayVault
/// @notice Mints parlay tickets, holds stake in escrow, handles
///         cash-out (partial value) and claim (full payout on all legs won).
contract ParlayVault {
    // ── Types ────────────────────────────────────────────────────
    struct Leg {
        address market;
        uint256 outcome; // 0=Home, 1=Away
        uint256 price;   // WAD-scaled price at purchase time
    }

    struct Ticket {
        address owner;
        uint256 stakeUsdc;    // 6 dec
        uint256 payoutUnits;  // WAD-scaled units (e.g. 1e18 = $1 at 1:1)
        uint256 payoutUsdc;   // actual payout in USDC (6 dec)
        uint8   legCount;
        bool    cashedOut;
        bool    claimed;
        mapping(uint8 => Leg) legs;
    }

    // ── State ────────────────────────────────────────────────────
    address public immutable usdc;
    address public immutable parlayRouter; // only router can mint tickets

    uint256 public nextTicketId = 1;
    mapping(uint256 => Ticket) private _tickets;

    // ── Events ───────────────────────────────────────────────────
    event TicketMinted(
        uint256 indexed ticketId,
        address indexed owner,
        uint256 stakeUsdc,
        uint256 payoutUsdc,
        uint8   legCount
    );
    event CashedOut(uint256 indexed ticketId, address indexed owner, uint256 payout);
    event Claimed(uint256 indexed ticketId, address indexed owner, uint256 payout);

    // ── Constructor ──────────────────────────────────────────────
    constructor(address _usdc, address _parlayRouter) {
        usdc         = _usdc;
        parlayRouter = _parlayRouter;
    }

    // ── Minting (called by ParlayRouter) ─────────────────────────

    /// @notice Mint a ticket. Called only by ParlayRouter after collecting stake.
    function mint(
        address owner,
        uint256 stakeUsdc,
        uint256 payoutUsdc,
        address[] calldata markets,
        uint256[] calldata outcomes,
        uint256[] calldata prices
    ) external returns (uint256 ticketId) {
        require(msg.sender == parlayRouter, "ParlayVault: only router");
        require(markets.length > 0 && markets.length <= 5, "ParlayVault: 1-5 legs");
        require(markets.length == outcomes.length && markets.length == prices.length,
                "ParlayVault: leg arrays mismatch");

        ticketId = nextTicketId++;
        Ticket storage t = _tickets[ticketId];
        t.owner        = owner;
        t.stakeUsdc    = stakeUsdc;
        t.payoutUsdc   = payoutUsdc;
        t.payoutUnits  = payoutUsdc * 1e12; // scale to WAD
        t.legCount     = uint8(markets.length);

        for (uint8 i = 0; i < markets.length; i++) {
            t.legs[i] = Leg({ market: markets[i], outcome: outcomes[i], price: prices[i] });
        }

        // Pull stake from router (router already pulled from buyer)
        _pull(parlayRouter, stakeUsdc);

        emit TicketMinted(ticketId, owner, stakeUsdc, payoutUsdc, t.legCount);
    }

    // ── Cash Out ─────────────────────────────────────────────────

    /// @notice Cash out before resolution — receive current market value.
    ///         Payout = stake * (product of current prices / purchase prices).
    function cashOut(uint256 ticketId) external {
        Ticket storage t = _tickets[ticketId];
        require(t.owner == msg.sender, "ParlayVault: not owner");
        require(!t.cashedOut && !t.claimed, "ParlayVault: already settled");

        // Check no leg is already resolved (would skew the price)
        uint256 currentProductWad = 1e18;
        uint256 purchaseProductWad = 1e18;

        for (uint8 i = 0; i < t.legCount; i++) {
            Leg storage leg = t.legs[i];
            LmsrMarket mkt = LmsrMarket(leg.market);
            require(mkt.result() == LmsrMarket.Outcome.Unresolved, "ParlayVault: leg resolved");

            uint256 currentPrice = mkt.priceOf(leg.outcome);
            currentProductWad  = (currentProductWad  * currentPrice) / 1e18;
            purchaseProductWad = (purchaseProductWad * leg.price)    / 1e18;
        }

        // cashOutValue = stake * (currentProduct / purchaseProduct)
        uint256 payout = (t.stakeUsdc * currentProductWad) / purchaseProductWad;
        if (payout > t.payoutUsdc) payout = t.payoutUsdc; // cap at max payout
        if (payout > _usdcBalance()) payout = _usdcBalance();

        t.cashedOut = true;
        _push(msg.sender, payout);
        emit CashedOut(ticketId, msg.sender, payout);
    }

    // ── Claim ────────────────────────────────────────────────────

    /// @notice Claim full payout when all legs are resolved and winner matches.
    function claim(uint256 ticketId) external {
        Ticket storage t = _tickets[ticketId];
        require(t.owner == msg.sender, "ParlayVault: not owner");
        require(!t.cashedOut && !t.claimed, "ParlayVault: already settled");

        for (uint8 i = 0; i < t.legCount; i++) {
            Leg storage leg = t.legs[i];
            LmsrMarket mkt = LmsrMarket(leg.market);
            LmsrMarket.Outcome res = mkt.result();
            require(res != LmsrMarket.Outcome.Unresolved, "ParlayVault: leg not resolved");

            // Map outcome index to Outcome enum
            LmsrMarket.Outcome picked = leg.outcome == 0
                ? LmsrMarket.Outcome.Home
                : LmsrMarket.Outcome.Away;
            require(res == picked, "ParlayVault: leg lost");
        }

        uint256 payout = t.payoutUsdc;
        require(payout <= _usdcBalance(), "ParlayVault: insufficient funds");

        t.claimed = true;
        _push(msg.sender, payout);
        emit Claimed(ticketId, msg.sender, payout);
    }

    // ── Views ────────────────────────────────────────────────────

    function ticketOwner(uint256 id) external view returns (address) {
        return _tickets[id].owner;
    }

    function ticketStake(uint256 id) external view returns (uint256) {
        return _tickets[id].stakeUsdc;
    }

    function ticketPayout(uint256 id) external view returns (uint256) {
        return _tickets[id].payoutUsdc;
    }

    function ticketSettled(uint256 id) external view returns (bool) {
        return _tickets[id].cashedOut || _tickets[id].claimed;
    }

    function ticketCashedOut(uint256 id) external view returns (bool) {
        return _tickets[id].cashedOut;
    }

    function ticketClaimed(uint256 id) external view returns (bool) {
        return _tickets[id].claimed;
    }

    function ticketLeg(uint256 id, uint8 i)
        external view
        returns (address market, uint256 outcome, uint256 price)
    {
        Leg storage l = _tickets[id].legs[i];
        return (l.market, l.outcome, l.price);
    }

    function ticketLegCount(uint256 id) external view returns (uint8) {
        return _tickets[id].legCount;
    }

    // ── Internal ─────────────────────────────────────────────────

    function _pull(address from, uint256 amount) internal {
        (bool ok, bytes memory data) = usdc.call(
            abi.encodeWithSignature("transferFrom(address,address,uint256)", from, address(this), amount)
        );
        require(ok && (data.length == 0 || abi.decode(data, (bool))), "ParlayVault: pull");
    }

    function _push(address to, uint256 amount) internal {
        (bool ok, bytes memory data) = usdc.call(
            abi.encodeWithSignature("transfer(address,uint256)", to, amount)
        );
        require(ok && (data.length == 0 || abi.decode(data, (bool))), "ParlayVault: push");
    }

    function _usdcBalance() internal view returns (uint256) {
        (bool ok, bytes memory data) = usdc.staticcall(
            abi.encodeWithSignature("balanceOf(address)", address(this))
        );
        require(ok, "ParlayVault: balanceOf");
        return abi.decode(data, (uint256));
    }
}
