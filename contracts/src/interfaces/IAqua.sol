// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @notice Virtual liquidity layer — tokens stay in maker wallets, Aqua records balances.
interface IAqua {
    /// @notice Register virtual balances for (app, strategy) pair.
    /// @param app       The dApp that will execute swaps (e.g. a SwapVM router).
    /// @param strategy  Arbitrary bytes identifying the strategy; strategyHash = keccak256(strategy).
    /// @param tokens    Tokens to register (any order).
    /// @param amounts   Virtual amounts corresponding to tokens[].
    /// @return strategyHash keccak256(strategy)
    function ship(
        address app,
        bytes calldata strategy,
        address[] calldata tokens,
        uint256[] calldata amounts
    ) external returns (bytes32 strategyHash);

    /// @notice Withdraw all virtual balances for (app, strategyHash) back to msg.sender.
    function dock(address app, bytes32 strategyHash, address[] calldata tokens) external;

    /// @notice Transfer `amount` of `token` from `maker`'s virtual balance to `to`.
    ///         Calls token.transferFrom(maker, to, amount) — maker must have approved this contract.
    ///         msg.sender must be the registered app.
    function pull(
        address maker,
        bytes32 strategyHash,
        address token,
        uint256 amount,
        address to
    ) external;

    /// @notice Add `amount` of `token` to `maker`'s virtual balance.
    ///         Caller must have transferred the tokens to this contract already.
    ///         msg.sender must be the registered app.
    function push(
        address maker,
        bytes32 strategyHash,
        address token,
        uint256 amount
    ) external;

    /// @notice Returns virtual balances, reverts if either token is not in the active strategy.
    function safeBalances(
        address maker,
        address app,
        bytes32 strategyHash,
        address token0,
        address token1
    ) external view returns (uint256 balance0, uint256 balance1);

    /// @notice Returns virtual balances (0 if not registered).
    function rawBalances(
        address maker,
        address app,
        bytes32 strategyHash,
        address token0,
        address token1
    ) external view returns (uint256 balance0, uint256 balance1);
}
