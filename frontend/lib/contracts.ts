// ── Chain config ─────────────────────────────────────────────────────────────
export const SEPOLIA_CHAIN_ID      = 11155111;
export const BASE_SEPOLIA_CHAIN_ID = 84532;

// ── CCIP cross-chain contracts ────────────────────────────────────────────────
export const CCIP_GATEWAY_ADDRESS = (process.env.NEXT_PUBLIC_CCIP_GATEWAY ?? '0x99045AC039c7828C4597C3463944EFCE4b2f7611') as `0x${string}`;
// Circle USDC on Base Sepolia — bridged to Circle USDC on Sepolia (0x1c7D4B19…7238) by CCIP
export const BASE_USDC_ADDRESS    = (process.env.NEXT_PUBLIC_BASE_USDC    ?? '0x036CbD53842c5426634e7929541eC2318f3dCF7e') as `0x${string}`;

export const CCIP_GATEWAY_ABI = [
  {
    name: 'sendParlay', type: 'function', stateMutability: 'payable',
    inputs: [
      { name: 'markets',   type: 'address[]' },
      { name: 'outcomes',  type: 'uint256[]' },
      { name: 'stakeUsdc', type: 'uint256'   },
      { name: 'minPayout', type: 'uint256'   },
    ],
    outputs: [{ name: 'messageId', type: 'bytes32' }],
  },
  {
    name: 'estimateFee', type: 'function', stateMutability: 'view',
    inputs: [
      { name: 'markets',   type: 'address[]' },
      { name: 'outcomes',  type: 'uint256[]' },
      { name: 'stakeUsdc', type: 'uint256'   },
      { name: 'minPayout', type: 'uint256'   },
    ],
    outputs: [{ name: 'fee', type: 'uint256' }],
  },
] as const;

// ── Contract addresses ────────────────────────────────────────────────────────
// Fill after running: forge script script/Deploy.s.sol --broadcast --rpc-url $SEPOLIA_RPC
export const PARLAY_ROUTER_ADDRESS   = (process.env.NEXT_PUBLIC_PARLAY_ROUTER   ?? '0x0000000000000000000000000000000000000000') as `0x${string}`;
export const PARLAY_VAULT_ADDRESS    = (process.env.NEXT_PUBLIC_PARLAY_VAULT    ?? '0x0000000000000000000000000000000000000000') as `0x${string}`;
export const MARKET_RESOLVER_ADDRESS = (process.env.NEXT_PUBLIC_MARKET_RESOLVER ?? '0x0000000000000000000000000000000000000000') as `0x${string}`;
export const MOCK_USDC_ADDRESS       = (process.env.NEXT_PUBLIC_MOCK_USDC       ?? '0x0000000000000000000000000000000000000000') as `0x${string}`;

// Market addresses — comma-separated in env, e.g. NEXT_PUBLIC_MARKETS=0xABC,0xDEF
// Filters out empty strings, whitespace, and zero addresses from the split.
export const MARKET_ADDRESSES: `0x${string}`[] = (process.env.NEXT_PUBLIC_MARKETS ?? '')
  .split(',')
  .map(a => a.trim())
  .filter(a => a.length > 0 && a !== '0x0000000000000000000000000000000000000000') as `0x${string}`[];

// 1inch Aqua (deployed on Sepolia)
export const AQUA_ADDRESS        = '0x1111113CCf1426A8E30e2bfF5E005d929bF6a90a' as `0x${string}`;

// Aqua ABI — LP calls ship() directly so their wallet is msg.sender (the maker)
export const AQUA_ABI = [
  {
    name: 'ship', type: 'function', stateMutability: 'nonpayable',
    inputs: [
      { name: 'app',      type: 'address'   },
      { name: 'strategy', type: 'bytes'     },
      { name: 'tokens',   type: 'address[]' },
      { name: 'amounts',  type: 'uint256[]' },
    ],
    outputs: [{ name: 'strategyHash', type: 'bytes32' }],
  },
  {
    name: 'dock', type: 'function', stateMutability: 'nonpayable',
    inputs: [
      { name: 'app',          type: 'address'   },
      { name: 'strategyHash', type: 'bytes32'   },
      { name: 'tokens',       type: 'address[]' },
    ],
    outputs: [],
  },
] as const;
// AquaParlayRouter — integrates Aqua.pull() for end-to-end LP→user flow
export const AQUA_PARLAY_ROUTER_ADDRESS = (process.env.NEXT_PUBLIC_AQUA_ROUTER ?? '0xE4EeF51383a53aFFd8d2C6661FfFcCF6578EAb0c') as `0x${string}`;
// Pre-computed strategy hash for [MARKET_A, MARKET_B]
export const DEFAULT_STRATEGY_HASH = (process.env.NEXT_PUBLIC_STRATEGY_HASH ?? '0xb28bcaf3495f18c555df8c3599834584fe338a9d2bd813f699620f28489593b9') as `0x${string}`;

// Chainlink CRE Forwarder on Sepolia
export const CRE_FORWARDER_ADDRESS = '0xf8344cfd5c43616a4366c34e3eee75af79a74482' as `0x${string}`;

// ── ABIs ─────────────────────────────────────────────────────────────────────

export const ERC20_ABI = [
  { name: 'balanceOf',   type: 'function', stateMutability: 'view',       inputs: [{ name: 'owner',   type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'allowance',   type: 'function', stateMutability: 'view',       inputs: [{ name: 'owner',   type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'approve',     type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount',  type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'transfer',    type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to',      type: 'address' }, { name: 'amount',  type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'decimals',    type: 'function', stateMutability: 'view',       inputs: [], outputs: [{ name: '', type: 'uint8' }] },
  { name: 'mint',        type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [] },
] as const;

export const LMSR_MARKET_ABI = [
  { name: 'prices',       type: 'function', stateMutability: 'view',       inputs: [], outputs: [{ name: 'p0', type: 'uint256' }, { name: 'p1', type: 'uint256' }] },
  { name: 'priceOf',      type: 'function', stateMutability: 'view',       inputs: [{ name: 'outcome', type: 'uint256' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'result',       type: 'function', stateMutability: 'view',       inputs: [], outputs: [{ name: '', type: 'uint8' }] },
  { name: 'lp',           type: 'function', stateMutability: 'view',       inputs: [], outputs: [{ name: '', type: 'address' }] },
  { name: 'kickoff',      type: 'function', stateMutability: 'view',       inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'homeTeam',     type: 'function', stateMutability: 'view',       inputs: [], outputs: [{ name: '', type: 'string' }] },
  { name: 'awayTeam',     type: 'function', stateMutability: 'view',       inputs: [], outputs: [{ name: '', type: 'string' }] },
  { name: 'ship',         type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }, { name: '_b', type: 'int256' }], outputs: [] },
  { name: 'dock',         type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  {
    name: 'LiquidityShipped', type: 'event',
    inputs: [{ name: 'lp', type: 'address', indexed: true }, { name: 'amount', type: 'uint256', indexed: false }, { name: 'b', type: 'int256', indexed: false }],
  },
  {
    name: 'LiquidityDocked',  type: 'event',
    inputs: [{ name: 'lp', type: 'address', indexed: true }, { name: 'amount', type: 'uint256', indexed: false }],
  },
] as const;

export const PARLAY_ROUTER_ABI = [
  {
    name: 'buyParlay', type: 'function', stateMutability: 'nonpayable',
    inputs: [
      { name: 'markets',   type: 'address[]' },
      { name: 'outcomes',  type: 'uint256[]' },
      { name: 'stakeUsdc', type: 'uint256'   },
      { name: 'minPayout', type: 'uint256'   },
    ],
    outputs: [{ name: 'ticketId', type: 'uint256' }],
  },
  {
    name: 'quoteParlay', type: 'function', stateMutability: 'view',
    inputs: [
      { name: 'markets',   type: 'address[]' },
      { name: 'outcomes',  type: 'uint256[]' },
      { name: 'stakeUsdc', type: 'uint256'   },
    ],
    outputs: [
      { name: 'combinedPriceWad', type: 'uint256' },
      { name: 'payoutUsdc',       type: 'uint256' },
    ],
  },
  {
    name: 'ParlayBought', type: 'event',
    inputs: [
      { name: 'ticketId',   type: 'uint256', indexed: true },
      { name: 'buyer',      type: 'address', indexed: true },
      { name: 'stakeUsdc',  type: 'uint256', indexed: false },
      { name: 'payoutUsdc', type: 'uint256', indexed: false },
      { name: 'legCount',   type: 'uint8',   indexed: false },
    ],
  },
] as const;

export const PARLAY_VAULT_ABI = [
  { name: 'cashOut',       type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'ticketId', type: 'uint256' }], outputs: [] },
  { name: 'claim',         type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'ticketId', type: 'uint256' }], outputs: [] },
  { name: 'ticketOwner',   type: 'function', stateMutability: 'view',       inputs: [{ name: 'id', type: 'uint256' }], outputs: [{ name: '', type: 'address' }] },
  { name: 'ticketStake',   type: 'function', stateMutability: 'view',       inputs: [{ name: 'id', type: 'uint256' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'ticketPayout',  type: 'function', stateMutability: 'view',       inputs: [{ name: 'id', type: 'uint256' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'ticketSettled', type: 'function', stateMutability: 'view',       inputs: [{ name: 'id', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'ticketLegCount',type: 'function', stateMutability: 'view',       inputs: [{ name: 'id', type: 'uint256' }], outputs: [{ name: '', type: 'uint8' }] },
  {
    name: 'ticketLeg',     type: 'function', stateMutability: 'view',
    inputs: [{ name: 'id', type: 'uint256' }, { name: 'i', type: 'uint8' }],
    outputs: [{ name: 'market', type: 'address' }, { name: 'outcome', type: 'uint256' }, { name: 'price', type: 'uint256' }],
  },
  { name: 'nextTicketId',  type: 'function', stateMutability: 'view',       inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  {
    name: 'TicketMinted', type: 'event',
    inputs: [
      { name: 'ticketId',  type: 'uint256', indexed: true },
      { name: 'owner',     type: 'address', indexed: true },
      { name: 'stakeUsdc', type: 'uint256', indexed: false },
      { name: 'payout',    type: 'uint256', indexed: false },
      { name: 'legCount',  type: 'uint8',   indexed: false },
    ],
  },
] as const;

export const AQUA_PARLAY_ROUTER_ABI = [
  {
    name: 'lpShipAqua', type: 'function', stateMutability: 'nonpayable',
    inputs: [
      { name: 'markets',       type: 'address[]' },
      { name: 'payoutReserve', type: 'uint256'   },
    ],
    outputs: [{ name: 'strategyHash', type: 'bytes32' }],
  },
  {
    name: 'lpDockAqua', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'strategyHash', type: 'bytes32' }],
    outputs: [],
  },
  {
    name: 'buyParlay', type: 'function', stateMutability: 'nonpayable',
    inputs: [
      { name: 'lp',           type: 'address'   },
      { name: 'strategyHash', type: 'bytes32'   },
      { name: 'markets',      type: 'address[]' },
      { name: 'outcomes',     type: 'uint256[]' },
      { name: 'stakeUsdc',    type: 'uint256'   },
      { name: 'minPayout',    type: 'uint256'   },
    ],
    outputs: [{ name: 'ticketId', type: 'uint256' }],
  },
  {
    name: 'quoteParlay', type: 'function', stateMutability: 'view',
    inputs: [
      { name: 'markets',   type: 'address[]' },
      { name: 'outcomes',  type: 'uint256[]' },
      { name: 'stakeUsdc', type: 'uint256'   },
    ],
    outputs: [
      { name: 'combinedPriceWad', type: 'uint256' },
      { name: 'payoutUsdc',       type: 'uint256' },
    ],
  },
  {
    name: 'strategyHashFor', type: 'function', stateMutability: 'pure',
    inputs: [{ name: 'markets', type: 'address[]' }],
    outputs: [{ name: '', type: 'bytes32' }],
  },
  {
    name: 'LiquidityShippedToAqua', type: 'event',
    inputs: [
      { name: 'lp',            type: 'address', indexed: true },
      { name: 'strategyHash',  type: 'bytes32', indexed: true },
      { name: 'payoutReserve', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'ParlayBought', type: 'event',
    inputs: [
      { name: 'ticketId',     type: 'uint256', indexed: true  },
      { name: 'buyer',        type: 'address', indexed: true  },
      { name: 'lp',           type: 'address', indexed: true  },
      { name: 'strategyHash', type: 'bytes32', indexed: false },
      { name: 'stakeUsdc',    type: 'uint256', indexed: false },
      { name: 'payoutUsdc',   type: 'uint256', indexed: false },
      { name: 'legCount',     type: 'uint8',   indexed: false },
    ],
  },
] as const;

export const MARKET_RESOLVER_ABI = [
  { name: 'resolveMarket',      type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'market', type: 'address' }, { name: 'result', type: 'uint8' }], outputs: [] },
  { name: 'resolveMarkets',     type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'markets', type: 'address[]' }, { name: 'results', type: 'uint8[]' }], outputs: [] },
  { name: 'requestSettlement',  type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'matchId', type: 'bytes32' }, { name: 'market', type: 'address' }], outputs: [] },
  { name: 'setCRE',             type: 'function', stateMutability: 'nonpayable', inputs: [{ name: '_cre', type: 'address' }], outputs: [] },
  { name: 'cre',                type: 'function', stateMutability: 'view',       inputs: [], outputs: [{ name: '', type: 'address' }] },
  { name: 'owner',              type: 'function', stateMutability: 'view',       inputs: [], outputs: [{ name: '', type: 'address' }] },
  {
    name: 'receiveReport', type: 'function', stateMutability: 'nonpayable',
    inputs: [
      { name: 'workflowExecutionId', type: 'bytes32' },
      { name: 'workflowName',        type: 'bytes32' },
      { name: 'workflowOwner',       type: 'bytes32' },
      { name: 'data',                type: 'bytes'   },
    ],
    outputs: [],
  },
  { name: 'CREUpdated', type: 'event', inputs: [{ name: 'oldCRE', type: 'address', indexed: false }, { name: 'newCRE', type: 'address', indexed: false }] },
  {
    name: 'SettlementRequested', type: 'event',
    inputs: [
      { name: 'matchId',     type: 'bytes32', indexed: true },
      { name: 'market',      type: 'address', indexed: true },
      { name: 'requestedAt', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'MarketResolved', type: 'event',
    inputs: [{ name: 'market', type: 'address', indexed: true }, { name: 'result', type: 'uint8', indexed: false }],
  },
] as const;
