// ── Arkiv Rabdi testnet ──────────────────────────────────────────
// Arkiv runs on its own chain (Rabdi). It is NOT on Sepolia.
// All data schemas (markets, slips, desks, results) live here.
// Your contracts + Aqua + Chainlink CRE are on Sepolia (11155111).
export const RABDI_CHAIN_ID = 7794095;
export const RABDI_RPC = 'https://rpc.rabdi.db-chain.testnet.arkiv.network';

export const SCHEMAS = {
  markets: 'parlaymarkets.markets',
  desks:   'parlaymarkets.desks',
  slips:   'parlaymarkets.slips',
  results: 'parlaymarkets.results',
} as const;

// ── Entity owner constants (fill in after deploy) ───────────────
// TRUSTED_WALLET  = your deployer wallet — markets + desks are filtered by this owner
// ORACLE_RELAYER  = the wallet that Chainlink CRE uses to write results
export const TRUSTED_WALLET  = '0x0000000000000000000000000000000000000000' as `0x${string}`;
export const ORACLE_RELAYER  = '0x0000000000000000000000000000000000000000' as `0x${string}`;

// ── Helpers (stubbed — swap for real ArkivClient calls) ─────────
export async function listMarkets() {
  // ArkivClient.query(SCHEMAS.markets, { owner: TRUSTED_WALLET })
  return [];
}

export async function listSlips() {
  // ArkivClient.query(SCHEMAS.slips)
  return [];
}

export async function listResults() {
  // Always filter by ORACLE_RELAYER owner to prevent spoofed results
  // ArkivClient.query(SCHEMAS.results, { owner: ORACLE_RELAYER })
  return [];
}

export async function createSlip(legs: unknown[], walletAddress: `0x${string}`) {
  // ArkivClient.create(SCHEMAS.slips, { legs, creator: walletAddress })
  void legs; void walletAddress;
}

export async function copySlip(originalKey: string, walletAddress: `0x${string}`) {
  // ArkivClient.create(SCHEMAS.slips, { copiedFrom: originalKey, creator: walletAddress })
  void originalKey; void walletAddress;
}
