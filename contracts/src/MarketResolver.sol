// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {LmsrMarket} from "./LmsrMarket.sol";

/// @title MarketResolver
/// @notice Trusted oracle bridge — called by Chainlink CRE automation
///         to resolve LmsrMarket outcomes on-chain.
///
///         CRE integration:
///           1. Anyone calls requestSettlement(matchId, market) → emits SettlementRequested
///           2. CRE workflow detects event, fetches sports API result, encodes outcome
///           3. CRE Forwarder calls receiveReport(executionId, workflowName, owner, data)
///              where data = abi.encode(market, outcome)
///           4. receiveReport decodes and resolves the market
contract MarketResolver {
    address public owner;
    /// @notice Chainlink CRE Forwarder address on Sepolia.
    ///         Set to 0xf8344cfd5c43616a4366c34e3eee75af79a74482 on Sepolia.
    address public cre;

    event CREUpdated(address oldCRE, address newCRE);
    event MarketResolved(address indexed market, LmsrMarket.Outcome result);
    /// @notice Emitted to trigger the CRE workflow. matchId must match the sports API's game ID.
    event SettlementRequested(bytes32 indexed matchId, address indexed market, uint256 requestedAt);

    modifier onlyAuthorized() {
        require(msg.sender == owner || msg.sender == cre, "Resolver: unauthorized");
        _;
    }

    constructor(address _cre) {
        owner = msg.sender;
        cre   = _cre;
    }

    /// @notice Update the Chainlink CRE forwarder address.
    function setCRE(address _cre) external {
        require(msg.sender == owner, "Resolver: not owner");
        emit CREUpdated(cre, _cre);
        cre = _cre;
    }

    /// @notice Request CRE to resolve a market. Emits SettlementRequested for the workflow trigger.
    ///         Anyone may call this once a match has ended.
    /// @param matchId  The external sports API game/event ID (keccak256 of the string ID).
    /// @param market   The LmsrMarket to resolve.
    function requestSettlement(bytes32 matchId, address market) external {
        emit SettlementRequested(matchId, market, block.timestamp);
    }

    /// @notice Called by the Chainlink CRE Forwarder after consensus on the game result.
    ///         Implements the IReceiver interface (see CRE docs).
    ///         data = abi.encode(address market, uint8 outcome)
    function receiveReport(
        bytes32 /*workflowExecutionId*/,
        bytes32 /*workflowName*/,
        bytes32 /*workflowOwner*/,
        bytes calldata data
    ) external {
        require(msg.sender == cre, "Resolver: not CRE forwarder");
        (address market, uint8 result) = abi.decode(data, (address, uint8));
        _resolveMarket(market, result);
    }

    /// @notice IReceiver entrypoint called by the Chainlink KeystoneForwarder:
    ///         onReport(bytes metadata, bytes report), report = abi.encode(market, outcome).
    function onReport(bytes calldata /*metadata*/, bytes calldata report) external {
        require(msg.sender == cre, "Resolver: not CRE forwarder");
        (address market, uint8 result) = abi.decode(report, (address, uint8));
        _resolveMarket(market, result);
    }

    /// @notice ERC165: advertises IReceiver (0x805f2132) so the forwarder will deliver reports.
    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == 0x805f2132 || id == 0x01ffc9a7;
    }

    /// @notice Resolve a market. Called by Chainlink CRE (or owner for testing).
    /// @param market  Address of the LmsrMarket to resolve.
    /// @param result  1=Home, 2=Away, 3=Draw (matches LmsrMarket.Outcome enum).
    function resolveMarket(address market, uint8 result) external onlyAuthorized {
        _resolveMarket(market, result);
    }

    /// @notice Batch resolve multiple markets at once.
    function resolveMarkets(address[] calldata markets, uint8[] calldata results)
        external
        onlyAuthorized
    {
        require(markets.length == results.length, "Resolver: arrays mismatch");
        for (uint256 i = 0; i < markets.length; i++) {
            _resolveMarket(markets[i], results[i]);
        }
    }

    function _resolveMarket(address market, uint8 result) internal {
        require(result >= 1 && result <= 3, "Resolver: invalid result");
        LmsrMarket(market).resolve(LmsrMarket.Outcome(result));
        emit MarketResolved(market, LmsrMarket.Outcome(result));
    }
}
