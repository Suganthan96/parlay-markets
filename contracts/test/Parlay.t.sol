// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Test, console} from "forge-std/Test.sol";
import {MockUSDC}       from "../src/MockUSDC.sol";
import {MarketResolver} from "../src/MarketResolver.sol";
import {LmsrMarket}     from "../src/LmsrMarket.sol";
import {ParlayVault}    from "../src/ParlayVault.sol";
import {ParlayRouter}   from "../src/ParlayRouter.sol";

contract ParlayTest is Test {
    MockUSDC       usdc;
    MarketResolver resolver;
    LmsrMarket     marketA;
    LmsrMarket     marketB;
    ParlayVault    vault;
    ParlayRouter   router;

    address LP     = makeAddr("LP");
    address TAKER  = makeAddr("TAKER");
    address ORACLE = makeAddr("ORACLE");

    uint256 constant LP_AMOUNT   = 1000e6;  // 1000 USDC per market
    int256  constant B           = 1000e18; // b = 1000 WAD (smooth odds)
    uint256 constant VAULT_FUND  = 5000e6;  // 5000 USDC to cover payouts
    uint256 constant STAKE       = 10e6;    // $10 stake

    function setUp() public {
        // ── Deploy contracts ─────────────────────────────────────
        usdc     = new MockUSDC();
        resolver = new MarketResolver(ORACLE);

        marketA = new LmsrMarket(
            address(usdc),
            address(resolver),
            keccak256("MATCH_001"),
            "Team Alpha",
            "Team Beta",
            block.timestamp + 2 days
        );

        marketB = new LmsrMarket(
            address(usdc),
            address(resolver),
            keccak256("MATCH_002"),
            "Team Gamma",
            "Team Delta",
            block.timestamp + 2 days
        );

        // Predict vault/router addresses (nonce-based)
        uint256 vaultNonce  = vm.getNonce(address(this));
        uint256 routerNonce = vaultNonce + 1;
        address vaultAddr  = vm.computeCreateAddress(address(this), vaultNonce);
        address routerAddr = vm.computeCreateAddress(address(this), routerNonce);

        vault  = new ParlayVault(address(usdc), routerAddr);
        router = new ParlayRouter(address(usdc), address(vault));

        assertEq(address(vault),  vaultAddr,  "vault addr");
        assertEq(address(router), routerAddr, "router addr");

        // ── Seed LP liquidity ────────────────────────────────────
        vm.startPrank(LP);
        usdc.mint(LP, LP_AMOUNT * 2);
        usdc.approve(address(marketA), LP_AMOUNT);
        marketA.ship(LP_AMOUNT, B);
        usdc.approve(address(marketB), LP_AMOUNT);
        marketB.ship(LP_AMOUNT, B);
        vm.stopPrank();

        // ── Fund vault (house bank) ──────────────────────────────
        usdc.mint(address(this), VAULT_FUND);
        usdc.transfer(address(vault), VAULT_FUND);

        // ── Mint stake USDC for taker ────────────────────────────
        usdc.mint(TAKER, STAKE * 10);
    }

    // ── Test: LMSR prices are sane at startup ────────────────────

    function test_InitialPrices() public view {
        (uint256 p0, uint256 p1) = marketA.prices();
        // At b=1000, q0=q1=0 → prices should be exactly 50/50
        assertApproxEqAbs(p0, 0.5e18, 1e12, "p0 ~ 0.5");
        assertApproxEqAbs(p1, 0.5e18, 1e12, "p1 ~ 0.5");
        assertApproxEqAbs(p0 + p1, 1e18, 1e9, "prices sum to 1");
    }

    // ── Test: Quote is correct ────────────────────────────────────

    function test_Quote() public view {
        address[] memory markets = new address[](2);
        uint256[] memory outcomes = new uint256[](2);
        markets[0] = address(marketA);
        markets[1] = address(marketB);
        outcomes[0] = 0; // marketA Home
        outcomes[1] = 0; // marketB Home

        (uint256 combinedPrice, uint256 payout) = router.quoteParlay(markets, outcomes, STAKE);

        // Both at 50/50 → combined = 0.5 * 0.5 = 0.25
        assertApproxEqAbs(combinedPrice, 0.25e18, 1e12, "combined price");

        // payout = stake / (combined * 1.1) = 10 / 0.275 ≈ 36.36 USDC
        // With 10% margin: parlayPrice = 0.25 * 1.1 = 0.275
        // payout = 10e6 * 1e18 / 0.275e18 ≈ 36.36e6
        assertGt(payout, 36e6, "payout > 36");
        assertLt(payout, 37e6, "payout < 37");
        console.log("payout (USDC):", payout);
    }

    // ── Test: Buy parlay end-to-end ───────────────────────────────

    function test_BuyParlay() public {
        address[] memory markets = new address[](2);
        uint256[] memory outcomes = new uint256[](2);
        markets[0] = address(marketA);
        markets[1] = address(marketB);
        outcomes[0] = 0;
        outcomes[1] = 0;

        vm.startPrank(TAKER);
        usdc.approve(address(router), STAKE);
        uint256 ticketId = router.buyParlay(markets, outcomes, STAKE, 0);
        vm.stopPrank();

        assertEq(ticketId, 1, "first ticket");
        assertEq(vault.ticketOwner(ticketId),   TAKER, "owner");
        assertEq(vault.ticketStake(ticketId),   STAKE, "stake");
        assertGt(vault.ticketPayout(ticketId),  STAKE, "payout > stake");
        assertEq(vault.ticketLegCount(ticketId), 2,    "leg count");

        (address m0, uint256 o0,) = vault.ticketLeg(ticketId, 0);
        assertEq(m0, address(marketA), "leg0 market");
        assertEq(o0, 0,                "leg0 outcome");

        console.log("ticket id:", ticketId);
        console.log("stake:", vault.ticketStake(ticketId));
        console.log("payout:", vault.ticketPayout(ticketId));
    }

    // ── Test: Claim after winning ─────────────────────────────────

    function test_ClaimWin() public {
        // Buy parlay: Home wins both
        address[] memory markets = new address[](2);
        uint256[] memory outcomes = new uint256[](2);
        markets[0] = address(marketA);
        markets[1] = address(marketB);
        outcomes[0] = 0; // Home
        outcomes[1] = 0; // Home

        vm.startPrank(TAKER);
        usdc.approve(address(router), STAKE);
        uint256 ticketId = router.buyParlay(markets, outcomes, STAKE, 0);
        vm.stopPrank();

        uint256 expectedPayout = vault.ticketPayout(ticketId);

        // Resolve both markets: Home wins (Outcome = 1)
        vm.startPrank(ORACLE);
        resolver.resolveMarket(address(marketA), 1); // Home
        resolver.resolveMarket(address(marketB), 1); // Home
        vm.stopPrank();

        // Taker claims
        uint256 balBefore = usdc.balanceOf(TAKER);
        vm.prank(TAKER);
        vault.claim(ticketId);
        uint256 balAfter = usdc.balanceOf(TAKER);

        assertEq(balAfter - balBefore, expectedPayout, "payout received");
        assertTrue(vault.ticketSettled(ticketId), "ticket settled");
        console.log("claim payout:", expectedPayout);
    }

    // ── Test: Lost parlay cannot be claimed ───────────────────────

    function test_ClaimLose() public {
        address[] memory markets = new address[](2);
        uint256[] memory outcomes = new uint256[](2);
        markets[0] = address(marketA);
        markets[1] = address(marketB);
        outcomes[0] = 0; // Home
        outcomes[1] = 0; // Home

        vm.startPrank(TAKER);
        usdc.approve(address(router), STAKE);
        uint256 ticketId = router.buyParlay(markets, outcomes, STAKE, 0);
        vm.stopPrank();

        // MarketA: Home wins, MarketB: Away wins → parlay loses
        vm.startPrank(ORACLE);
        resolver.resolveMarket(address(marketA), 1); // Home wins ✓
        resolver.resolveMarket(address(marketB), 2); // Away wins ✗
        vm.stopPrank();

        vm.prank(TAKER);
        vm.expectRevert("ParlayVault: leg lost");
        vault.claim(ticketId);
    }

    // ── Test: Cash out before resolution ─────────────────────────

    function test_CashOut() public {
        address[] memory markets = new address[](2);
        uint256[] memory outcomes = new uint256[](2);
        markets[0] = address(marketA);
        markets[1] = address(marketB);
        outcomes[0] = 0;
        outcomes[1] = 0;

        vm.startPrank(TAKER);
        usdc.approve(address(router), STAKE);
        uint256 ticketId = router.buyParlay(markets, outcomes, STAKE, 0);
        vm.stopPrank();

        uint256 balBefore = usdc.balanceOf(TAKER);
        vm.prank(TAKER);
        vault.cashOut(ticketId);
        uint256 balAfter = usdc.balanceOf(TAKER);

        // Cash-out at equal prices → receives approximately stake (before margin)
        assertGt(balAfter, balBefore, "received some USDC");
        assertLe(balAfter - balBefore, vault.ticketPayout(1), "capped at max payout");
        assertTrue(vault.ticketSettled(ticketId), "settled after cash out");
        console.log("cash-out received:", balAfter - balBefore);
    }

    // ── Test: LP can dock after resolution ───────────────────────

    function test_LPDock() public {
        // Resolve market A
        vm.prank(ORACLE);
        resolver.resolveMarket(address(marketA), 1); // Home wins

        uint256 balBefore = usdc.balanceOf(LP);
        vm.prank(LP);
        marketA.dock();
        uint256 balAfter = usdc.balanceOf(LP);

        assertGt(balAfter, balBefore, "LP received USDC on dock");
        console.log("LP dock received:", balAfter - balBefore);
    }

    // ── Test: Slippage guard ──────────────────────────────────────

    function test_SlippageGuard() public {
        address[] memory markets = new address[](1);
        uint256[] memory outcomes = new uint256[](1);
        markets[0] = address(marketA);
        outcomes[0] = 0;

        vm.startPrank(TAKER);
        usdc.approve(address(router), STAKE);
        // Set minPayout way too high
        vm.expectRevert("ParlayRouter: slippage");
        router.buyParlay(markets, outcomes, STAKE, 1_000_000e6);
        vm.stopPrank();
    }

    // ── Test: Batch resolve ───────────────────────────────────────

    function test_BatchResolve() public {
        address[] memory markets = new address[](2);
        uint8[]   memory results = new uint8[](2);
        markets[0] = address(marketA);
        markets[1] = address(marketB);
        results[0] = 2; // Away wins
        results[1] = 1; // Home wins

        vm.prank(ORACLE);
        resolver.resolveMarkets(markets, results);

        assertEq(uint8(marketA.result()), 2, "marketA Away");
        assertEq(uint8(marketB.result()), 1, "marketB Home");
    }

}
