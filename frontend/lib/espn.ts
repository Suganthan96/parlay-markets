import { keccak256, toHex, type Hex } from 'viem';

// Leagues supported by the ESPN API
export const ESPN_LEAGUES = {
  EPL:   'soccer/eng.1',
  NBA:   'basketball/nba',
  NFL:   'football/nfl',
  MLB:   'baseball/mlb',
  UFC:   'mma/ufc',
} as const;

export type EspnLeague = keyof typeof ESPN_LEAGUES;

export const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports';

export function espnEventsUrl(league: EspnLeague): string {
  return `${ESPN_BASE}/${ESPN_LEAGUES[league]}/events`;
}

// Encode an ESPN numeric event ID into the bytes32 matchId expected by
// MarketResolver.requestSettlement(). The CRE workflow treats matchId as
// a big-endian uint256, so BigInt(matchId).toString() recovers the event ID.
export function espnIdToMatchId(espnEventId: string | number): Hex {
  return toHex(BigInt(espnEventId), { size: 32 });
}

// Decode a bytes32 matchId back to its ESPN event ID string.
export function matchIdToEspnId(matchId: Hex): string {
  return BigInt(matchId).toString();
}

// Encode a human-readable match key (e.g. "Man City vs Arsenal") as a
// keccak256 bytes32 — useful for non-numeric external IDs.
export function labelToMatchId(label: string): Hex {
  return keccak256(new TextEncoder().encode(label) as unknown as Hex);
}
