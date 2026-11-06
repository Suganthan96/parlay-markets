// ── Chain config ────────────────────────────────────────────────
// Contracts, 1inch Aqua/SwapVM, and Chainlink CRE all live on Sepolia.
// Arkiv data schemas live on Rabdi (see arkiv.ts).
export const SEPOLIA_CHAIN_ID = 11155111;

// ── Contract addresses (deploy on Sepolia, then fill these in) ──
// Ask 1inch at booth: "Which Aqua and SwapVM addresses should we use on Sepolia?"
export const PARLAY_ROUTER_ADDRESS  = '0x0000000000000000000000000000000000000001' as `0x${string}`;
export const PARLAY_VAULT_ADDRESS   = '0x0000000000000000000000000000000000000002' as `0x${string}`;
export const MARKET_RESOLVER_ADDRESS = '0x0000000000000000000000000000000000000003' as `0x${string}`;

// Mock USDC on Sepolia — deploy your own ERC20 for the demo, or use an existing test USDC
export const MOCK_USDC_ADDRESS      = '0x0000000000000000000000000000000000000004' as `0x${string}`;

// 1inch Aqua on Sepolia — same deterministic address as mainnet.
// Source: Watermark (3rd, Tokyo) README + Takarabako (2nd, Continuity) .env.example.
// Two winning teams used this. Confirm at booth: "Is 0x1111113c…a90a the official Aqua on Sepolia?"
export const AQUA_ADDRESS           = '0x1111113ccf1426a8e30e2bff5e005d929bf6a90a' as `0x${string}`;

// SwapVM router on Sepolia (v1.0.2) — Takarabako used this.
// Differs from mainnet router (0x111111338c…0de). Ask booth which version matches Aqua above.
export const AQUA_ROUTER_ADDRESS    = '0x1111113db0e0ef9d0e3a50d5f094a3a57a26c0de' as `0x${string}`;

// ── ABIs ─────────────────────────────────────────────────────────
export const PARLAY_ROUTER_ABI = [
  {
    name: 'buyParlay',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'legs',     type: 'bytes[]'  },
      { name: 'usdcIn',   type: 'uint256'  },
      { name: 'minUnits', type: 'uint256'  },
    ],
    outputs: [{ name: 'ticketId', type: 'uint256' }],
  },
  {
    name: 'quoteParlay',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'legs', type: 'bytes[]' }],
    outputs: [{ name: 'price', type: 'uint256' }],
  },
] as const;

export const PARLAY_VAULT_ABI = [
  {
    name: 'cashOut',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'ticketId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'claim',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'ticketId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'getTicket',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'ticketId', type: 'uint256' }],
    outputs: [
      { name: 'owner',      type: 'address' },
      { name: 'stakeUsdc',  type: 'uint256' },
      { name: 'payoutUnits',type: 'uint256' },
      { name: 'settled',    type: 'bool'    },
    ],
  },
] as const;

export const MARKET_RESOLVER_ABI = [
  {
    // Called by Chainlink CRE Automation when a match result is published
    name: 'resolveMarket',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'marketId', type: 'bytes32' },
      { name: 'winner',   type: 'uint8'   }, // 0 = home, 1 = away, 2 = draw
    ],
    outputs: [],
  },
] as const;
