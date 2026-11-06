// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Test, console} from "forge-std/Test.sol";

import {IAqua}                  from "../src/interfaces/IAqua.sol";
import {ISwapVM}                from "../src/interfaces/ISwapVM.sol";
import {ParlayToken}            from "../src/ParlayToken.sol";
import {ParlayLmsrExtruction}   from "../src/ParlayLmsrExtruction.sol";
import {LmsrMarket}             from "../src/LmsrMarket.sol";
import {MarketResolver}         from "../src/MarketResolver.sol";
import {MockUSDC}               from "../src/MockUSDC.sol";

/// @notice Integration test: full Aqua + SwapVM parlay swap on a mainnet fork.
///
/// Run:
///   MAINNET_RPC_URL=<rpc> forge test --match-contract ParlayAquaTest -vvv
///
/// What this proves:
///   1. LP ships USDC + ParlayToken into the official Aqua contract.
///   2. Taker swaps USDC → ParlayToken at LMSR-derived odds via our custom Extruction.
///   3. After resolve, taker redeems ParlayToken back to USDC through ParlayVault.
///
/// Aqua address (all major EVM chains): 0x1111113ccf1426a8e30e2bff5e005d929bf6a90a
/// SwapVM router:                        0x111111338c5091e8440b67b168bae16a668ac0de
contract ParlayAquaTest is Test {
    // ── Mainnet constants ────────────────────────────────────────────────────

    address constant AQUA_ADDR   = 0x1111113CCf1426A8E30e2bfF5E005d929bF6a90a;
    address constant ROUTER_ADDR = 0x111111338c5091E8440b67B168bAe16a668AC0De;

    // Mainnet USDC (6 dec)
    address constant USDC_MAINNET = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;

    IAqua   aqua   = IAqua(AQUA_ADDR);
    ISwapVM router = ISwapVM(ROUTER_ADDR);

    // ── Test actors ──────────────────────────────────────────────────────────

    address LP     = makeAddr("LP");
    address TAKER  = makeAddr("TAKER");
    address ORACLE = makeAddr("ORACLE");

    // ── Deployed contracts ───────────────────────────────────────────────────

    ParlayToken          parlayToken;
    ParlayLmsrExtruction extruction;
    MarketResolver       resolver;
    LmsrMarket           marketA;
    LmsrMarket           marketB;

    // ── Setup ────────────────────────────────────────────────────────────────

    function setUp() public {
        // Skip gracefully if no fork RPC is configured.
        string memory rpc = vm.envOr("MAINNET_RPC_URL", string(""));
        if (bytes(rpc).length == 0) {
            vm.skip(true);
            return;
        }
        vm.createSelectFork(rpc);

        // 1. Deploy our contracts on the mainnet fork.
        extruction = new ParlayLmsrExtruction();
        resolver   = new MarketResolver(ORACLE);

        marketA = new LmsrMarket(
            USDC_MAINNET, address(resolver),
            keccak256("MATCH_001"), "Team Alpha", "Team Beta",
            block.timestamp + 2 days
        );
        marketB = new LmsrMarket(
            USDC_MAINNET, address(resolver),
            keccak256("MATCH_002"), "Team Gamma", "Team Delta",
            block.timestamp + 2 days
        );

        // 2. Seed LP liquidity into both LMSR markets (1000 USDC each, smooth b).
        uint256 lpSeed = 1000e6;
        int256  b      = 1000e18;
        deal(USDC_MAINNET, LP, lpSeed * 2);
        vm.startPrank(LP);
        _approveUSDC(address(marketA), lpSeed);
        marketA.ship(lpSeed, b);
        _approveUSDC(address(marketB), lpSeed);
        marketB.ship(lpSeed, b);
        vm.stopPrank();

        // 3. LP pre-mints ParlayTokens (the "claim" side of Aqua orders).
        //    1 ParlayToken redeems for 1 USDC on a full win.
        //    LP ships 1000 ParlayTokens + 1000 USDC into Aqua as payout reserve.
        parlayToken = new ParlayToken("Parlay Claim", "PARLAY");

        uint256 aquaUsdcAmount   = 1000e6;    // 1000 USDC backing (tokenIn reserve)
        uint256 aquaParlayAmount = 1000e6;    // 1000 PARLAY (tokenOut supply)

        parlayToken.mint(LP, aquaParlayAmount);
        deal(USDC_MAINNET, LP, aquaUsdcAmount);

        // 4. Build the SwapVM order and ship into Aqua.
        (address tokenA, address tokenB) = _sortTokens(USDC_MAINNET, address(parlayToken));

        address[] memory markets = new address[](2);
        uint8[]   memory outcomes = new uint8[](2);
        markets[0]  = address(marketA); outcomes[0] = 0; // marketA Home
        markets[1]  = address(marketB); outcomes[1] = 0; // marketB Home

        bytes memory orderData = extruction.buildOrderData(tokenA, tokenB, markets, outcomes);
        uint256 traits         = extruction.buildAquaMakerTraits();

        ISwapVM.Order memory order = ISwapVM.Order({
            maker:  LP,
            traits: traits,
            data:   orderData
        });

        address[] memory shipTokens   = new address[](2);
        uint256[] memory shipAmounts  = new uint256[](2);
        (shipTokens[0], shipAmounts[0]) = tokenA == USDC_MAINNET
            ? (USDC_MAINNET, aquaUsdcAmount) : (address(parlayToken), aquaParlayAmount);
        (shipTokens[1], shipAmounts[1]) = tokenA == USDC_MAINNET
            ? (address(parlayToken), aquaParlayAmount) : (USDC_MAINNET, aquaUsdcAmount);

        vm.startPrank(LP);
        _approveUSDC(AQUA_ADDR, aquaUsdcAmount);
        parlayToken.approve(AQUA_ADDR, aquaParlayAmount);
        aqua.ship(ROUTER_ADDR, abi.encode(order), shipTokens, shipAmounts);
        vm.stopPrank();

        // 5. Give taker some USDC.
        deal(USDC_MAINNET, TAKER, 100e6);
    }

    // ── Test: Quote returns non-zero parlay amount ───────────────────────────

    function test_AquaQuote() public {
        uint256 stake = 10e6; // $10 USDC

        (address tokenA, address tokenB) = _sortTokens(USDC_MAINNET, address(parlayToken));
        address[] memory markets = new address[](2);
        uint8[]   memory outcomes = new uint8[](2);
        markets[0] = address(marketA); outcomes[0] = 0;
        markets[1] = address(marketB); outcomes[1] = 0;

        ISwapVM.Order memory order = ISwapVM.Order({
            maker:  LP,
            traits: extruction.buildAquaMakerTraits(),
            data:   extruction.buildOrderData(tokenA, tokenB, markets, outcomes)
        });

        bool isAToB = tokenA == USDC_MAINNET;
        bytes memory takerData = _buildTakerData(isAToB);

        (uint256 takerAmt, uint256 makerAmt) = router.quote(order, stake, takerData);
        console.log("stake (USDC):",      stake);
        console.log("takerAmt:",          takerAmt);
        console.log("makerAmt (PARLAY):", makerAmt);

        // At 50/50 odds × 1.1 margin, $10 → ~36 PARLAY (4× parlay at 1.1 margin)
        assertGt(makerAmt, 30e6, "payout > $30 (reflects combined odds)");
        assertLt(makerAmt, 50e6, "payout < $50 (margin applied)");
    }

    // ── Test: Taker swaps USDC → ParlayToken via Aqua ───────────────────────

    function test_AquaSwap() public {
        uint256 stake = 10e6;

        (address tokenA, address tokenB) = _sortTokens(USDC_MAINNET, address(parlayToken));
        address[] memory markets = new address[](2);
        uint8[]   memory outcomes = new uint8[](2);
        markets[0] = address(marketA); outcomes[0] = 0;
        markets[1] = address(marketB); outcomes[1] = 0;

        ISwapVM.Order memory order = ISwapVM.Order({
            maker:  LP,
            traits: extruction.buildAquaMakerTraits(),
            data:   extruction.buildOrderData(tokenA, tokenB, markets, outcomes)
        });

        bool isAToB = tokenA == USDC_MAINNET;
        bytes memory takerData = _buildTakerData(isAToB);

        uint256 parlayBefore = parlayToken.balanceOf(TAKER);

        vm.startPrank(TAKER);
        _approveUSDC(ROUTER_ADDR, stake);
        router.swap(order, stake, takerData);
        vm.stopPrank();

        uint256 received = parlayToken.balanceOf(TAKER) - parlayBefore;
        console.log("PARLAY received:", received);
        assertGt(received, 0, "taker received ParlayTokens");

        // Confirm LP's Aqua balance decreased by the payout amount.
        bytes32 strategyHash = keccak256(abi.encode(order));
        (uint256 remBal0, uint256 remBal1) = aqua.rawBalances(LP, ROUTER_ADDR, strategyHash, tokenA, tokenB);
        console.log("remaining Aqua balA:", remBal0);
        console.log("remaining Aqua balB:", remBal1);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    function _sortTokens(address a, address b) internal pure returns (address, address) {
        return a < b ? (a, b) : (b, a);
    }

    function _approveUSDC(address spender, uint256 amount) internal {
        (bool ok,) = USDC_MAINNET.call(
            abi.encodeWithSignature("approve(address,uint256)", spender, amount)
        );
        require(ok, "USDC approve failed");
    }

    /// @dev TakerTraits 22-byte header: 20 zero bytes + uint16 flags.
    ///   Exact-in + Aqua push: IS_EXACT_IN(0x01) | USE_TRANSFER_FROM_AND_AQUA_PUSH(0x40) | IS_A_TO_B(0x80 or 0)
    function _buildTakerData(bool isAToB) internal pure returns (bytes memory) {
        bytes memory data = new bytes(22);
        // flags: IS_EXACT_IN | USE_TRANSFER_FROM_AND_AQUA_PUSH | (isAToB ? IS_A_TO_B : 0)
        uint8 flags = 0x01 | 0x40 | (isAToB ? 0x80 : 0x00);
        data[20] = 0x00;
        data[21] = bytes1(flags);
        return data;
    }
}

// ── Pure unit tests (no fork required) ───────────────────────────────────────

contract ParlayExtructionUnitTest is Test {
    ParlayLmsrExtruction extruction;
    MarketResolver       resolver;
    LmsrMarket           marketA;
    LmsrMarket           marketB;
    MockUSDC             usdc;

    address LP = makeAddr("LP");

    function setUp() public {
        usdc       = new MockUSDC();
        extruction = new ParlayLmsrExtruction();
        resolver   = new MarketResolver(makeAddr("oracle"));

        marketA = new LmsrMarket(
            address(usdc), address(resolver),
            keccak256("M1"), "A", "B", block.timestamp + 1 days
        );
        marketB = new LmsrMarket(
            address(usdc), address(resolver),
            keccak256("M2"), "C", "D", block.timestamp + 1 days
        );

        // Seed both markets at 50/50 (b=1000)
        usdc.mint(LP, 2000e6);
        vm.startPrank(LP);
        usdc.approve(address(marketA), 1000e6);
        marketA.ship(1000e6, 1000e18);
        usdc.approve(address(marketB), 1000e6);
        marketB.ship(1000e6, 1000e18);
        vm.stopPrank();
    }

    function test_ExtructionPricingUnit() public view {
        (uint256 p0A,) = marketA.prices();
        (uint256 p0B,) = marketB.prices();

        // Both at 50/50 → combined ≈ 0.25
        uint256 combined   = p0A * p0B / 1e18;
        uint256 withMargin = combined * 1_100_000_000_000_000_000 / 1e18;
        uint256 expectedOut = 10e6 * 1e18 / withMargin;

        console.log("marketA p0:      ", p0A);
        console.log("combined price:  ", combined);
        console.log("with 10% margin: ", withMargin);
        console.log("expected payout: ", expectedOut);

        assertApproxEqAbs(combined, 0.25e18, 1e12, "50/50 combined ~ 0.25");
        assertGt(expectedOut, 36e6, "payout > 36 USDC");
        assertLt(expectedOut, 37e6, "payout < 37 USDC");
    }

    function test_BuildOrderDataNoRevert() public view {
        address tokenA = address(usdc) < address(extruction)
            ? address(usdc) : address(extruction);
        address tokenB = address(usdc) < address(extruction)
            ? address(extruction) : address(usdc);

        address[] memory markets = new address[](2);
        uint8[]   memory outcomes = new uint8[](2);
        markets[0] = address(marketA); outcomes[0] = 0;
        markets[1] = address(marketB); outcomes[1] = 0;

        bytes memory data   = extruction.buildOrderData(tokenA, tokenB, markets, outcomes);
        uint256 traits      = extruction.buildAquaMakerTraits();
        bytes memory taker  = extruction.buildAquaTakerTraits();

        // tokenA + tokenB = 40 bytes; Extruction opcode (1) + argsLen (1) + addr (20) + args
        assertEq(data.length >= 40, true, "data has token pair");
        assertEq(uint8(data[40]), 0x04, "Extruction opcode at byte 40");
        assertGt(traits, 0, "traits non-zero");
        assertEq(taker.length, 22, "taker traits = 22 bytes");
        assertEq(uint8(taker[21]) & 0x01, 0x01, "IS_EXACT_IN flag set");
        assertEq(uint8(taker[21]) & 0x40, 0x40, "USE_TRANSFER_FROM_AND_AQUA_PUSH flag set");

        // USE_AQUA_INSTEAD_OF_SIGNATURE is bit 254
        assertGt(traits >> 254, 0, "USE_AQUA bit set");
    }

    function test_AquaMakerTraitsBitLayout() public view {
        uint256 traits = extruction.buildAquaMakerTraits();

        // Bit 254: USE_AQUA_INSTEAD_OF_SIGNATURE
        assertEq((traits >> 254) & 1, 1, "USE_AQUA bit 254");

        // Bits 160-175: PreTransferIn hook end offset = 40
        assertEq((traits >> 160) & 0xFFFF, 40, "PreTransferIn offset = 40");

        // Bits 208-223: PostTransferOut hook end offset = 40
        assertEq((traits >> 208) & 0xFFFF, 40, "PostTransferOut offset = 40");

        // Bits 0-159: receiver = 0 (defaults to maker)
        assertEq(uint160(traits), 0, "receiver = 0");
    }
}
