// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {LmsrMarket} from "./LmsrMarket.sol";

/// @title MarketResolver
/// @notice Trusted oracle bridge — called by Chainlink CRE automation
///         to resolve LmsrMarket outcomes on-chain.
contract MarketResolver {
    address public owner;
    // Chainlink CRE forwarder address (set after CRE workflow deploy)
    address public cre;

    event CREUpdated(address oldCRE, address newCRE);
    event MarketResolved(address indexed market, LmsrMarket.Outcome result);

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

    /// @notice Resolve a market. Called by Chainlink CRE (or owner for testing).
    /// @param market  Address of the LmsrMarket to resolve.
    /// @param result  1=Home, 2=Away, 3=Draw (matches LmsrMarket.Outcome enum).
    function resolveMarket(address market, uint8 result) external onlyAuthorized {
        require(result >= 1 && result <= 3, "Resolver: invalid result");
        LmsrMarket(market).resolve(LmsrMarket.Outcome(result));
        emit MarketResolved(market, LmsrMarket.Outcome(result));
    }

    /// @notice Batch resolve multiple markets at once.
    function resolveMarkets(address[] calldata markets, uint8[] calldata results)
        external
        onlyAuthorized
    {
        require(markets.length == results.length, "Resolver: arrays mismatch");
        for (uint256 i = 0; i < markets.length; i++) {
            require(results[i] >= 1 && results[i] <= 3, "Resolver: invalid result");
            LmsrMarket(markets[i]).resolve(LmsrMarket.Outcome(results[i]));
            emit MarketResolved(markets[i], LmsrMarket.Outcome(results[i]));
        }
    }
}
