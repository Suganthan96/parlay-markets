// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {LmsrMarket} from "./LmsrMarket.sol";
import {ParlayVault} from "./ParlayVault.sol";
import {IAqua}       from "./interfaces/IAqua.sol";

/// @title AquaParlayRouter
/// @notice End-to-end parlay router that integrates 1inch Aqua virtual liquidity.
///
/// ## End-to-end flow
///
/// LP side (one-time per market set):
///   1. LP calls LmsrMarket.ship(amount, b) on each market to seed LMSR pricing.
///   2. LP calls USDC.approve(AQUA, payoutReserve) so Aqua can pull from their wallet.
///   3. LP calls this.lpShipAqua(markets[], payoutReserve) which calls:
///        Aqua.ship(app=this, strategy=abi.encode(markets), [usdc], [payoutReserve])
///      → LP's USDC is "virtually shipped" — it stays in their wallet but Aqua records it.
///
/// User side (every parlay):
///   1. User calls USDC.approve(this, stake).
///   2. User calls this.buyParlay(lp, strategyHash, markets[], outcomes[], stake, minPayout).
///        a. Router reads LMSR prices, computes payout = stake / (Πp × 1.1).
///        b. Router pulls stake from user.
///        c. Router calls Aqua.pull(lp, strategyHash, usdc, payout, this)
///             → Aqua calls usdc.transferFrom(lp, this, payout) — LP pays payout from wallet.
///        d. Router calls ParlayVault.mint(user, stake, payout, ...) → mints NFT ticket.
///
/// Key 1inch Aqua properties:
///   • LP funds never leave wallet until a parlay is bought
///   • Strategy (market list hash) gates which parlays the LP covers
///   • LP can dock() at any time to cancel virtual commitments
contract AquaParlayRouter {
    // ── Constants ────────────────────────────────────────────────────────────
    uint256 internal constant WAD        = 1e18;
    uint256 internal constant MAX_LEGS   = 5;
    uint256 internal constant MARGIN_WAD = 1_100_000_000_000_000_000; // 1.1 × WAD

    address public constant AQUA = 0x1111113CCf1426A8E30e2bfF5E005d929bF6a90a;

    // ── Immutables ───────────────────────────────────────────────────────────
    address public immutable usdc;
    address public immutable vault;

    // ── Events ───────────────────────────────────────────────────────────────
    event LiquidityShippedToAqua(
        address indexed lp,
        bytes32 indexed strategyHash,
        uint256 payoutReserve
    );

    event LiquidityDockedFromAqua(
        address indexed lp,
        bytes32 indexed strategyHash
    );

    event ParlayBought(
        uint256 indexed ticketId,
        address indexed buyer,
        address indexed lp,
        bytes32 strategyHash,
        uint256 stakeUsdc,
        uint256 payoutUsdc,
        uint8   legCount
    );

    // ── Constructor ──────────────────────────────────────────────────────────
    constructor(address _usdc, address _vault) {
        usdc  = _usdc;
        vault = _vault;
    }

    // ── LP: Register virtual liquidity with Aqua ─────────────────────────────

    /// @notice LP step 2: register a payout reserve with Aqua for a set of markets.
    ///         LP must have called USDC.approve(AQUA, payoutReserve) first.
    ///         USDC stays in LP's wallet — Aqua just records the virtual balance.
    /// @param markets       The LmsrMarket addresses this LP covers.
    /// @param payoutReserve Maximum USDC Aqua is allowed to pull from LP for payouts.
    /// @return strategyHash keccak256 of the encoded markets — users need this to buy.
    function lpShipAqua(
        address[] calldata markets,
        uint256 payoutReserve
    ) external returns (bytes32 strategyHash) {
        require(markets.length > 0, "AquaRouter: empty markets");
        require(payoutReserve > 0,  "AquaRouter: zero reserve");

        // Build strategy bytes = abi.encode(markets)
        bytes memory strategy = abi.encode(markets);

        address[] memory tokens  = new address[](1);
        uint256[] memory amounts = new uint256[](1);
        tokens[0]  = usdc;
        amounts[0] = payoutReserve;

        strategyHash = IAqua(AQUA).ship(address(this), strategy, tokens, amounts);

        emit LiquidityShippedToAqua(msg.sender, strategyHash, payoutReserve);
    }

    /// @notice LP: cancel virtual liquidity and unregister from Aqua.
    function lpDockAqua(bytes32 strategyHash) external {
        address[] memory tokens = new address[](1);
        tokens[0] = usdc;
        IAqua(AQUA).dock(address(this), strategyHash, tokens);
        emit LiquidityDockedFromAqua(msg.sender, strategyHash);
    }

    // ── User: Buy a parlay ───────────────────────────────────────────────────

    /// @notice Buy a parlay. Routes payout reserve through 1inch Aqua.
    /// @param lp            The LP who shipped the payout reserve to Aqua.
    /// @param strategyHash  Returned by lpShipAqua — identifies which LP/market set.
    /// @param markets       LmsrMarket addresses (must match LP's registered markets).
    /// @param outcomes      Outcome index per market (0=Home, 1=Away).
    /// @param stakeUsdc     USDC stake from user (6 dec). Router must be approved.
    /// @param minPayout     Slippage guard.
    /// @return ticketId     Minted ticket ID in ParlayVault.
    function buyParlay(
        address lp,
        bytes32 strategyHash,
        address[] calldata markets,
        uint256[] calldata outcomes,
        uint256 stakeUsdc,
        uint256 minPayout
    ) external returns (uint256 ticketId) {
        uint256 n = markets.length;
        require(n > 0 && n <= MAX_LEGS, "AquaRouter: 1-5 legs");
        require(n == outcomes.length,   "AquaRouter: arrays mismatch");
        require(stakeUsdc > 0,          "AquaRouter: zero stake");
        require(lp != address(0),       "AquaRouter: zero LP");

        // ── 1. Read LMSR prices ───────────────────────────────────────────────
        uint256[] memory prices = new uint256[](n);
        uint256 combinedPriceWad = WAD;

        for (uint256 i = 0; i < n; i++) {
            require(markets[i] != address(0), "AquaRouter: zero market");
            require(outcomes[i] <= 1,         "AquaRouter: bad outcome");

            LmsrMarket mkt = LmsrMarket(markets[i]);
            require(mkt.result() == LmsrMarket.Outcome.Unresolved,
                    "AquaRouter: market resolved");

            uint256 p = mkt.priceOf(outcomes[i]);
            require(p > 0 && p < WAD, "AquaRouter: bad price");

            prices[i]        = p;
            combinedPriceWad = (combinedPriceWad * p) / WAD;
        }

        // ── 2. Apply 10% house margin ─────────────────────────────────────────
        uint256 parlayPriceWad = (combinedPriceWad * MARGIN_WAD) / WAD;
        require(parlayPriceWad > 0 && parlayPriceWad < WAD, "AquaRouter: bad price");

        // ── 3. Compute payout ─────────────────────────────────────────────────
        uint256 payoutUsdc = (stakeUsdc * WAD) / parlayPriceWad;
        require(payoutUsdc >= minPayout, "AquaRouter: slippage");
        require(payoutUsdc > stakeUsdc,  "AquaRouter: payout <= stake");

        // ── 4. Pull stake from user ───────────────────────────────────────────
        _transferFrom(msg.sender, address(this), stakeUsdc);

        // ── 5. Pull LP's payout reserve from Aqua ────────────────────────────
        // Aqua calls USDC.transferFrom(lp, this, payoutUsdc) — LP's wallet funds it.
        // LP must have called USDC.approve(AQUA, ≥ payoutUsdc) for this to succeed.
        IAqua(AQUA).pull(lp, strategyHash, usdc, payoutUsdc, address(this));

        // ── 6. Approve vault, mint ticket ────────────────────────────────────
        // Vault holds: stake (from user) + payoutUsdc (from LP via Aqua)
        // On win: vault pays payoutUsdc to user. On loss: stake stays in vault for LP.
        _approve(vault, stakeUsdc + payoutUsdc);

        ticketId = ParlayVault(vault).mint(
            msg.sender,
            stakeUsdc,
            payoutUsdc,
            markets,
            outcomes,
            prices
        );

        emit ParlayBought(ticketId, msg.sender, lp, strategyHash, stakeUsdc, payoutUsdc, uint8(n));
    }

    // ── Quote ────────────────────────────────────────────────────────────────

    /// @notice Read-only quote: returns combined price and expected payout.
    function quoteParlay(
        address[] calldata markets,
        uint256[] calldata outcomes,
        uint256 stakeUsdc
    ) external view returns (uint256 combinedPriceWad, uint256 payoutUsdc) {
        combinedPriceWad = WAD;
        for (uint256 i = 0; i < markets.length; i++) {
            uint256 p = LmsrMarket(markets[i]).priceOf(outcomes[i]);
            combinedPriceWad = (combinedPriceWad * p) / WAD;
        }
        uint256 parlayPriceWad = (combinedPriceWad * MARGIN_WAD) / WAD;
        payoutUsdc = (stakeUsdc * WAD) / parlayPriceWad;
    }

    // ── Helper: compute strategyHash for a market list ───────────────────────

    /// @notice Compute the strategyHash for a given market list (off-chain helper).
    function strategyHashFor(address[] calldata markets) external pure returns (bytes32) {
        return keccak256(abi.encode(markets));
    }

    // ── Internals ────────────────────────────────────────────────────────────

    function _transferFrom(address from, address to, uint256 amount) internal {
        (bool ok, bytes memory data) = usdc.call(
            abi.encodeWithSignature("transferFrom(address,address,uint256)", from, to, amount)
        );
        require(ok && (data.length == 0 || abi.decode(data, (bool))), "AquaRouter: transferFrom");
    }

    function _approve(address spender, uint256 amount) internal {
        (bool ok, bytes memory data) = usdc.call(
            abi.encodeWithSignature("approve(address,uint256)", spender, amount)
        );
        require(ok && (data.length == 0 || abi.decode(data, (bool))), "AquaRouter: approve");
    }
}
