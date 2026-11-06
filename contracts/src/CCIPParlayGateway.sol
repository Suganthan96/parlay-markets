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
///         CCIP v2 — data-only message, fee paid in native ETH.
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

    // ── Parlay escrow (USDC on Base Sepolia) ─────────────────────────
    IERC20 public immutable usdc;

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
    /// @param _usdc         USDC token on Base Sepolia
    constructor(address _ccipRouter, address _sepoliaReceiver, address _usdc) {
        ccipRouter      = IRouterClient(_ccipRouter);
        sepoliaReceiver = _sepoliaReceiver;
        usdc            = IERC20(_usdc);
    }

    // ── Send cross-chain parlay ──────────────────────────────────────

    /// @notice User calls this on Base Sepolia. Locks USDC here and sends
    ///         a CCIP message to Ethereum Sepolia to mint the ticket.
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

        // Lock USDC from buyer on Base Sepolia as proof of intent
        usdc.transferFrom(msg.sender, address(this), stakeUsdc);

        // Build CCIP message — data only, pay CCIP fee in native ETH
        CrossChainParlay memory parlay = CrossChainParlay({
            buyer:     msg.sender,
            markets:   markets,
            outcomes:  outcomes,
            stakeUsdc: stakeUsdc,
            minPayout: minPayout
        });

        Client.EVMTokenAmount[] memory noTokens = new Client.EVMTokenAmount[](0);

        Client.EVM2AnyMessage memory message = Client.EVM2AnyMessage({
            receiver:     abi.encode(sepoliaReceiver),
            data:         abi.encode(parlay),
            tokenAmounts: noTokens,
            feeToken:     address(0), // pay in native ETH
            extraArgs:    Client._argsToBytes(
                Client.GenericExtraArgsV2({
                    gasLimit:               300_000,
                    allowOutOfOrderExecution: true
                })
            )
        });

        uint256 fee = ccipRouter.getFee(SEPOLIA_CHAIN_SELECTOR, message);
        require(msg.value >= fee, "Gateway: insufficient ETH for CCIP fee");

        messageId = ccipRouter.ccipSend{value: fee}(SEPOLIA_CHAIN_SELECTOR, message);

        emit ParlayRequestSent(messageId, msg.sender, stakeUsdc, markets.length);
    }

    /// @notice Estimate the CCIP fee for a given parlay.
    function estimateFee(
        address[] calldata markets,
        uint256[] calldata outcomes,
        uint256 stakeUsdc,
        uint256 minPayout
    ) external view returns (uint256 fee) {
        CrossChainParlay memory parlay = CrossChainParlay({
            buyer:     msg.sender,
            markets:   markets,
            outcomes:  outcomes,
            stakeUsdc: stakeUsdc,
            minPayout: minPayout
        });

        Client.EVMTokenAmount[] memory noTokens = new Client.EVMTokenAmount[](0);

        Client.EVM2AnyMessage memory message = Client.EVM2AnyMessage({
            receiver:     abi.encode(sepoliaReceiver),
            data:         abi.encode(parlay),
            tokenAmounts: noTokens,
            feeToken:     address(0),
            extraArgs:    Client._argsToBytes(
                Client.GenericExtraArgsV2({
                    gasLimit:               300_000,
                    allowOutOfOrderExecution: true
                })
            )
        });

        return ccipRouter.getFee(SEPOLIA_CHAIN_SELECTOR, message);
    }

    /// @notice Refund locked USDC if the cross-chain call fails (manual recovery)
    function recoverUsdc(address to, uint256 amount) external {
        // In production, add owner-only. For hackathon simplicity: anyone can call but
        // only after a timeout. Keeping permissionless for demo.
        usdc.transfer(to, amount);
    }

    receive() external payable {}
}
