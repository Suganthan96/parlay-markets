// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {LMSR} from "./lib/LMSR.sol";

/// @title LmsrMarket
/// @notice One binary prediction market per sports event.
///         LP ships USDC liquidity; the contract holds LMSR state.
///         Compatible with 1inch Aqua as a standalone LP vault
///         (Aqua integration wired in ParlayApp/ParlayRouter).
contract LmsrMarket {
    using LMSR for *;

    // ── Types ────────────────────────────────────────────────────
    enum Outcome { Unresolved, Home, Away, Draw }

    // ── State ────────────────────────────────────────────────────
    address public immutable usdc;
    address public immutable resolver;   // only address that can resolve

    bytes32 public immutable matchId;
    string  public  homeTeam;
    string  public  awayTeam;
    uint256 public  kickoff;             // unix timestamp

    // LMSR parameters (WAD = 1e18 precision)
    int256  public b;        // liquidity parameter
    int256  public q0;       // units outstanding for Home
    int256  public q1;       // units outstanding for Away

    // LP tracking
    address public lp;
    uint256 public lpShipped;   // USDC shipped by LP (6 dec)

    Outcome public result;
    bool    public settled;

    // ── Events ──────────────────────────────────────────────────
    event MarketCreated(bytes32 indexed matchId, string home, string away, uint256 kickoff);
    event LiquidityShipped(address indexed lp, uint256 amount, int256 b);
    event LiquidityDocked(address indexed lp, uint256 amount);
    event TradeExecuted(address indexed taker, uint256 outcome, int256 delta, uint256 cost);
    event MarketResolved(Outcome result);

    // ── Constructor ─────────────────────────────────────────────
    constructor(
        address _usdc,
        address _resolver,
        bytes32 _matchId,
        string memory _home,
        string memory _away,
        uint256 _kickoff
    ) {
        usdc     = _usdc;
        resolver = _resolver;
        matchId  = _matchId;
        homeTeam = _home;
        awayTeam = _away;
        kickoff  = _kickoff;
        emit MarketCreated(_matchId, _home, _away, _kickoff);
    }

    // ── LP: Ship ────────────────────────────────────────────────

    /// @notice LP deposits USDC and sets the LMSR b parameter.
    ///         Only one LP per market (hackathon scope).
    function ship(uint256 amount, int256 _b) external {
        require(lp == address(0) || lp == msg.sender, "LmsrMarket: LP slot taken");
        require(_b > 0, "LmsrMarket: b must be > 0");
        require(result == Outcome.Unresolved, "LmsrMarket: already resolved");

        _pull(msg.sender, amount);

        lp         = msg.sender;
        lpShipped += amount;

        // Starting odds: 50/50 (q0 = q1 = 0 gives equal prices)
        if (b == 0) {
            b  = _b;
            q0 = 0;
            q1 = 0;
        } else {
            // Additional liquidity — keep existing positions, scale b
            b = _b;
        }

        emit LiquidityShipped(msg.sender, amount, _b);
    }

    /// @notice LP withdraws remaining USDC after market resolves.
    function dock() external {
        require(msg.sender == lp, "LmsrMarket: not LP");
        require(result != Outcome.Unresolved, "LmsrMarket: not resolved yet");

        uint256 bal = _usdcBalance();
        lpShipped   = 0;
        _push(lp, bal);
        emit LiquidityDocked(msg.sender, bal);
    }

    // ── Trading ─────────────────────────────────────────────────

    /// @notice Buy `units` of `outcome` (0=Home, 1=Away).
    ///         Cost is calculated via LMSR and pulled from buyer.
    /// @return cost USDC cost (6 dec)
    function buy(address buyer, uint256 outcome, uint256 units)
        external
        returns (uint256 cost)
    {
        require(result == Outcome.Unresolved, "LmsrMarket: resolved");
        require(outcome <= 1, "LmsrMarket: invalid outcome");
        require(units > 0, "LmsrMarket: zero units");

        int256 delta   = int256(units);
        int256 costWad = LMSR.costApprox(q0, q1, b, outcome, delta);
        require(costWad > 0, "LmsrMarket: cost must be positive");

        // Convert WAD cost to USDC (6 dec): costWad / 1e18 * 1e6 = costWad / 1e12
        cost = uint256(costWad) / 1e12;
        require(cost > 0, "LmsrMarket: cost rounds to 0");

        _pull(buyer, cost);

        if (outcome == 0) q0 += delta;
        else              q1 += delta;

        emit TradeExecuted(buyer, outcome, delta, cost);
    }

    /// @notice Cash out `units` of `outcome` before resolution.
    /// @return payout USDC received (6 dec)
    function sellBack(address seller, uint256 outcome, uint256 units)
        external
        returns (uint256 payout)
    {
        require(result == Outcome.Unresolved, "LmsrMarket: resolved");
        require(outcome <= 1, "LmsrMarket: invalid outcome");

        int256 delta    = -int256(units);
        int256 costWad  = LMSR.costApprox(q0, q1, b, outcome, delta);
        // Selling: cost is negative (market pays seller)
        require(costWad < 0, "LmsrMarket: sell payout must be positive");

        payout = uint256(-costWad) / 1e12;
        require(payout > 0, "LmsrMarket: payout rounds to 0");
        require(payout <= _usdcBalance(), "LmsrMarket: insufficient vault");

        if (outcome == 0) q0 += delta;
        else              q1 += delta;

        _push(seller, payout);
        emit TradeExecuted(seller, outcome, delta, payout);
    }

    // ── Oracle / Resolver ────────────────────────────────────────

    /// @notice Called by MarketResolver (triggered by Chainlink CRE).
    function resolve(Outcome _result) external {
        require(msg.sender == resolver, "LmsrMarket: not resolver");
        require(result == Outcome.Unresolved, "LmsrMarket: already resolved");
        require(_result != Outcome.Unresolved, "LmsrMarket: invalid result");

        result   = _result;
        settled  = true;
        emit MarketResolved(_result);
    }

    // ── Views ────────────────────────────────────────────────────

    function prices() external view returns (uint256 p0, uint256 p1) {
        return LMSR.prices2(q0, q1, b);
    }

    function priceOf(uint256 outcome) external view returns (uint256) {
        (uint256 p0, uint256 p1) = LMSR.prices2(q0, q1, b);
        return outcome == 0 ? p0 : p1;
    }

    // ── Internal ─────────────────────────────────────────────────

    function _pull(address from, uint256 amount) internal {
        (bool ok, bytes memory data) = usdc.call(
            abi.encodeWithSignature("transferFrom(address,address,uint256)", from, address(this), amount)
        );
        require(ok && (data.length == 0 || abi.decode(data, (bool))), "LmsrMarket: pull failed");
    }

    function _push(address to, uint256 amount) internal {
        (bool ok, bytes memory data) = usdc.call(
            abi.encodeWithSignature("transfer(address,uint256)", to, amount)
        );
        require(ok && (data.length == 0 || abi.decode(data, (bool))), "LmsrMarket: push failed");
    }

    function _usdcBalance() internal view returns (uint256) {
        (bool ok, bytes memory data) = usdc.staticcall(
            abi.encodeWithSignature("balanceOf(address)", address(this))
        );
        require(ok, "LmsrMarket: balanceOf failed");
        return abi.decode(data, (uint256));
    }
}
