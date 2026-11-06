// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {CCIPReceiver} from "chainlink-ccip/applications/CCIPReceiver.sol";
import {Client} from "chainlink-ccip/libraries/Client.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ParlayVault} from "./ParlayVault.sol";
import {LmsrMarket} from "./LmsrMarket.sol";

/// @title CCIPParlayReceiver
/// @notice Deployed on Ethereum Sepolia. Receives cross-chain parlay requests
///         from CCIPParlayGateway on Base Sepolia via Chainlink CCIP v2 and
///         mints a ParlayVault ticket for the cross-chain buyer.
///
///         The receiver holds a USDC reserve (pre-funded by LP) to back payouts.
///         Minting uses the existing ParlayVault.mintFromCCIP() path.
contract CCIPParlayReceiver is CCIPReceiver {

    // ── Cross-chain message payload (must match Gateway) ─────────────
    struct CrossChainParlay {
        address buyer;
        address[] markets;
        uint256[] outcomes;
        uint256 stakeUsdc;
        uint256 minPayout;
    }

    // ── Contracts on Ethereum Sepolia ────────────────────────────────
    ParlayVault public immutable vault;
    IERC20      public immutable usdc;

    /// @dev Base Sepolia chain selector — only accept messages from this chain
    uint64 public constant BASE_SEPOLIA_CHAIN_SELECTOR = 10344971235874465080;

    // ── The gateway contract address on Base Sepolia ─────────────────
    address public baseSepolia_gateway; // settable by owner after deploy
    address public immutable owner;

    // ── Events ────────────────────────────────────────────────────────
    event CrossChainParlayMinted(
        bytes32 indexed messageId,
        address indexed buyer,
        uint256 indexed ticketId,
        uint256 stakeUsdc
    );
    event CrossChainParlayFailed(bytes32 indexed messageId, bytes reason);

    // ── Constructor ──────────────────────────────────────────────────
    /// @param _ccipRouter   CCIP Router on Ethereum Sepolia (0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59)
    /// @param _vault        ParlayVault address on Sepolia
    /// @param _usdc         USDC token on Sepolia
    constructor(
        address _ccipRouter,
        address _vault,
        address _usdc
    ) CCIPReceiver(_ccipRouter) {
        vault  = ParlayVault(_vault);
        usdc   = IERC20(_usdc);
        owner  = msg.sender;
    }

    /// @notice Set or update the gateway address on Base Sepolia. Owner-only.
    function setGateway(address _gateway) external {
        require(msg.sender == owner, "Receiver: not owner");
        baseSepolia_gateway = _gateway;
    }

    // ── CCIP receive hook ─────────────────────────────────────────────

    /// @dev Called by the CCIP Router on Sepolia when a message arrives from Base.
    function _ccipReceive(
        Client.Any2EVMMessage memory message
    ) internal override {
        // Validate source chain — only accept from Base Sepolia
        require(
            message.sourceChainSelector == BASE_SEPOLIA_CHAIN_SELECTOR,
            "Receiver: wrong source chain"
        );

        // Validate sender — must be our deployed gateway (checked once gateway is set)
        if (baseSepolia_gateway != address(0)) {
            address sender = abi.decode(message.sender, (address));
            require(sender == baseSepolia_gateway, "Receiver: unknown sender");
        }

        // Decode parlay request
        CrossChainParlay memory parlay = abi.decode(message.data, (CrossChainParlay));

        // Mint ticket on behalf of buyer — try/catch so CCIP message isn't stuck
        try this._mintTicket(message.messageId, parlay) {
            // success path handled inside _mintTicket
        } catch (bytes memory reason) {
            emit CrossChainParlayFailed(message.messageId, reason);
        }
    }

    /// @dev Separated so we can try/catch — external to allow that
    function _mintTicket(
        bytes32 messageId,
        CrossChainParlay memory parlay
    ) external {
        require(msg.sender == address(this), "Receiver: internal only");

        // Approve vault to pull the stake USDC from this contract's reserve
        usdc.approve(address(vault), parlay.stakeUsdc);

        // Calculate price product to derive payout (same math as ParlayRouter)
        // payoutUsdc = stakeUsdc / (p0 * p1 * … pN)  where pN is current market price
        uint256 combinedPriceWad = 1e18;
        uint256[] memory prices = new uint256[](parlay.markets.length);
        for (uint256 i = 0; i < parlay.markets.length; i++) {
            uint256 p = LmsrMarket(parlay.markets[i]).priceOf(parlay.outcomes[i]);
            prices[i]         = p;
            combinedPriceWad  = (combinedPriceWad * p) / 1e18;
        }
        uint256 payoutUsdc = (parlay.stakeUsdc * 1e18) / combinedPriceWad;
        require(payoutUsdc >= parlay.minPayout, "Receiver: slippage exceeded");

        uint256 ticketId = vault.mintFromCCIP(
            parlay.buyer,
            parlay.stakeUsdc,
            payoutUsdc,
            parlay.markets,
            parlay.outcomes,
            prices
        );

        emit CrossChainParlayMinted(messageId, parlay.buyer, ticketId, parlay.stakeUsdc);
    }

    // ── Reserve management ───────────────────────────────────────────

    /// @notice LP or admin funds this contract with USDC to back cross-chain payouts.
    function fundReserve(uint256 amount) external {
        usdc.transferFrom(msg.sender, address(this), amount);
    }

    function usdcBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }
}
