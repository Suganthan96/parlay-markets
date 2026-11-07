// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {IRouterClient} from "chainlink-ccip/interfaces/IRouterClient.sol";
import {Client} from "chainlink-ccip/libraries/Client.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title CCIPParlayGateway
/// @notice Deployed on Base Sepolia. User submits a cross-chain parlay here;
///         the request is relayed via Chainlink CCIP to CCIPParlayReceiver on
///         Ethereum Sepolia where the ParlayVault mints the ticket.
///
///         CCIP programmable token transfer: real Circle USDC is bridged
///         (Base Sepolia USDC → Sepolia USDC) together with the parlay data,
///         so the transfer is visible as a token transfer in CCIP Explorer.
///         Fee is paid in native ETH.
///         Chain selectors (v2 testnet):
///           Ethereum Sepolia  : 16015286601757825753
///           Base Sepolia      : 10344971235874465080
contract CCIPParlayGateway {
    // ── Chainlink CCIP ───────────────────────────────────────────────
    IRouterClient public immutable ccipRouter;

    /// @dev Ethereum Sepolia chain selector (CCIP v2 testnet)
    uint64 public constant SEPOLIA_CHAIN_SELECTOR = 16015286601757825753;

    // ── Receiver on Ethereum Sepolia ─────────────────────────────────
    address public immutable sepoliaReceiver;

    // ── Circle USDC on Base Sepolia (0x036CbD53842c5426634e7929541eC2318f3dCF7e)
    IERC20 public immutable usdc;

    /// @dev Gas for receiver's _ccipReceive (price reads + vault mint)
    uint256 public constant RECEIVER_GAS_LIMIT = 500_000;

    // ── Cross-chain message payload ───────────────────────────────────
    struct CrossChainParlay {
        address buyer;       // original buyer (on Base)
        address[] markets;   // LMSR market addresses on Sepolia
        uint256[] outcomes;  // 0 = YES/Home, 1 = NO/Away
        uint256 stakeUsdc;   // 6-dec USDC amount
        uint256 minPayout;   // slippage floor (6-dec)
    }

    // ── Events ────────────────────────────────────────────────────────
    event ParlayRequestSent(
        bytes32 indexed messageId,
        address indexed buyer,
        uint256 stakeUsdc,
        uint256 legs
    );

    // ── Constructor ──────────────────────────────────────────────────
    /// @param _ccipRouter   CCIP Router on Base Sepolia
    ///                      0xD3b06cEbF099CE7DA4AcCf578aaebFDBd6e88a93
    /// @param _sepoliaReceiver  CCIPParlayReceiver address on Ethereum Sepolia
    /// @param _usdc         Circle USDC on Base Sepolia (CCIP-supported token)
    constructor(address _ccipRouter, address _sepoliaReceiver, address _usdc) {
        ccipRouter      = IRouterClient(_ccipRouter);
        sepoliaReceiver = _sepoliaReceiver;
        usdc            = IERC20(_usdc);
    }

    // ── Send cross-chain parlay ──────────────────────────────────────

    /// @notice User calls this on Base Sepolia. Bridges the USDC stake to the
    ///         receiver on Ethereum Sepolia via CCIP, together with the parlay
    ///         data, so the ticket is minted against real USDC.
    /// @param markets   On-chain LMSR market addresses (Sepolia)
    /// @param outcomes  Outcome index per leg (0 or 1)
    /// @param stakeUsdc USDC amount (6 decimals) — must be approved to this contract
    /// @param minPayout Minimum acceptable payout (slippage protection)
    function sendParlay(
        address[] calldata markets,
        uint256[] calldata outcomes,
        uint256 stakeUsdc,
        uint256 minPayout
    ) external payable returns (bytes32 messageId) {
        require(markets.length > 0 && markets.length <= 5, "Gateway: 1-5 legs");
        require(markets.length == outcomes.length, "Gateway: leg arrays mismatch");
        require(stakeUsdc > 0, "Gateway: zero stake");

        // Pull the stake from the buyer, then let the CCIP router bridge it
        require(usdc.transferFrom(msg.sender, address(this), stakeUsdc), "Gateway: USDC pull failed");
        require(usdc.approve(address(ccipRouter), stakeUsdc), "Gateway: USDC approve failed");

        Client.EVM2AnyMessage memory message = _buildMessage(msg.sender, markets, outcomes, stakeUsdc, minPayout);

        uint256 fee = ccipRouter.getFee(SEPOLIA_CHAIN_SELECTOR, message);
        require(msg.value >= fee, "Gateway: insufficient ETH for CCIP fee");

        messageId = ccipRouter.ccipSend{value: fee}(SEPOLIA_CHAIN_SELECTOR, message);

        // Refund any ETH sent above the CCIP fee
        if (msg.value > fee) {
            (bool ok, ) = msg.sender.call{value: msg.value - fee}("");
            require(ok, "Gateway: refund failed");
        }

        emit ParlayRequestSent(messageId, msg.sender, stakeUsdc, markets.length);
    }

    /// @notice Estimate the CCIP fee for a given parlay.
    function estimateFee(
        address[] calldata markets,
        uint256[] calldata outcomes,
        uint256 stakeUsdc,
        uint256 minPayout
    ) external view returns (uint256 fee) {
        Client.EVM2AnyMessage memory message = _buildMessage(msg.sender, markets, outcomes, stakeUsdc, minPayout);

        return ccipRouter.getFee(SEPOLIA_CHAIN_SELECTOR, message);
    }

    function _buildMessage(
        address buyer,
        address[] calldata markets,
        uint256[] calldata outcomes,
        uint256 stakeUsdc,
        uint256 minPayout
    ) internal view returns (Client.EVM2AnyMessage memory) {
        CrossChainParlay memory parlay = CrossChainParlay({
            buyer:     buyer,
            markets:   markets,
            outcomes:  outcomes,
            stakeUsdc: stakeUsdc,
            minPayout: minPayout
        });

        Client.EVMTokenAmount[] memory tokenAmounts = new Client.EVMTokenAmount[](1);
        tokenAmounts[0] = Client.EVMTokenAmount({token: address(usdc), amount: stakeUsdc});

        return Client.EVM2AnyMessage({
            receiver:     abi.encode(sepoliaReceiver),
            data:         abi.encode(parlay),
            tokenAmounts: tokenAmounts,
            feeToken:     address(0), // pay in native ETH
            extraArgs:    Client._argsToBytes(
                Client.GenericExtraArgsV2({
                    gasLimit:                 RECEIVER_GAS_LIMIT,
                    allowOutOfOrderExecution: true
                })
            )
        });
    }

    receive() external payable {}
}
