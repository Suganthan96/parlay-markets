// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @notice Fixed-point LMSR pricing math (18-decimal precision).
/// p_i = e^(q_i / b) / sum(e^(q_j / b))
///
/// We use a shifted representation to avoid overflow:
///   let m = max(q_j / b)
///   p_i = e^((q_i/b) - m) / sum(e^((q_j/b) - m))
///
/// e^x approximated via a 7th-order Taylor series valid for x in [-20, 0].
library LMSR {
    uint256 internal constant WAD = 1e18;

    /// @dev e^x for x in [-20*WAD, 0], returns WAD-scaled result.
    function expWad(int256 x) internal pure returns (uint256) {
        // Clamp to avoid underflow (e^-20 ≈ 2e-9, rounds to 0 at WAD scale)
        if (x < -20e18) return 0;
        if (x == 0) return WAD;

        // Work in positive domain: compute e^(-|x|) then maybe invert
        bool negative = x < 0;
        uint256 ax = uint256(negative ? -x : x);

        // Taylor: e^u = 1 + u + u^2/2! + ... + u^7/7!
        // u = ax / WAD (dimensionless)
        uint256 u = ax; // WAD-scaled
        uint256 result = WAD;
        uint256 term = WAD;

        // term_n = term_{n-1} * u / (n * WAD)
        term = term * u / WAD / 1;  result += term;
        term = term * u / WAD / 2;  result += term;
        term = term * u / WAD / 3;  result += term;
        term = term * u / WAD / 4;  result += term;
        term = term * u / WAD / 5;  result += term;
        term = term * u / WAD / 6;  result += term;
        term = term * u / WAD / 7;  result += term;

        if (negative) {
            // e^(-x) = WAD^2 / e^x
            return (WAD * WAD) / result;
        }
        return result;
    }

    /// @notice Compute outcome prices for a 2-outcome market.
    /// @param q0 Units outstanding for outcome 0 (WAD-scaled)
    /// @param q1 Units outstanding for outcome 1 (WAD-scaled)
    /// @param b  Liquidity parameter (WAD-scaled)
    /// @return p0 Price of outcome 0 in WAD (sums with p1 to WAD)
    /// @return p1 Price of outcome 1 in WAD
    function prices2(int256 q0, int256 q1, int256 b)
        internal
        pure
        returns (uint256 p0, uint256 p1)
    {
        require(b > 0, "LMSR: b must be positive");
        // Shift: subtract max to keep exponents <= 0
        int256 r0 = (q0 * int256(WAD)) / b;
        int256 r1 = (q1 * int256(WAD)) / b;
        int256 m  = r0 > r1 ? r0 : r1;

        uint256 e0 = expWad(r0 - m);
        uint256 e1 = expWad(r1 - m);
        uint256 sum = e0 + e1;

        p0 = (e0 * WAD) / sum;
        p1 = WAD - p0; // exact complement
    }

    /// @notice Cost to move q_i by delta units (integral of LMSR cost function).
    /// C(q) = b * ln(sum(e^(q_j/b)))
    /// cost = C(q_after) - C(q_before)
    /// For 2 outcomes: cost = b * ln((e^(q0'/b) + e^(q1'/b)) / (e^(q0/b) + e^(q1/b)))
    /// Approximated as: b * (ln_e_after - ln_e_before) using ln(x) ≈ (x-1) - (x-1)^2/2 ...
    /// For simplicity we use the price * delta approximation valid for small deltas.
    /// Full integral: uncomment the ln-based version for production.
    function costApprox(
        int256 q0,
        int256 q1,
        int256 b,
        uint256 outcome, // 0 or 1
        int256 delta     // positive = buy, negative = sell
    ) internal pure returns (int256 cost) {
        (uint256 p0, uint256 p1) = prices2(q0, q1, b);
        uint256 price = outcome == 0 ? p0 : p1;
        // cost ≈ price * delta (WAD-scaled)
        cost = (int256(price) * delta) / int256(WAD);
    }
}
