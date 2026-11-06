/**
 * ABI definitions and helpers for MarketResolver.sol.
 * Used by the CRE workflow to watch for SettlementRequested events
 * and encode the resolution report.
 */

import { type EVMLog, bytesToHex } from "@chainlink/cre-sdk"
import {
  encodeAbiParameters,
  parseAbiParameters,
  keccak256,
  toBytes,
  type Address,
  type Hex,
} from "viem"

// ── Event signature hash ──────────────────────────────────────────────────────

export const SETTLEMENT_REQUESTED_SIG = keccak256(
  toBytes("SettlementRequested(bytes32,address,uint256)"),
) as Hex

// ── Decoded event shape ───────────────────────────────────────────────────────

export interface SettlementRequestedEvent {
  matchId: Hex
  market:  Address
}

/**
 * Decode a raw EVMLog from the logTrigger into a SettlementRequestedEvent.
 * topics (each 32 bytes): [eventSig, bytes32 matchId, address market]
 */
export function decodeSettlementRequestedLog(log: EVMLog): SettlementRequestedEvent {
  if (!log.topics || log.topics.length < 3) {
    throw new Error("SettlementRequested: unexpected log topics length")
  }
  const matchId  = bytesToHex(log.topics[1]) as Hex
  const topicHex = bytesToHex(log.topics[2])
  // address is right-aligned in the 32-byte topic — take the last 40 hex chars (20 bytes)
  const market   = `0x${topicHex.slice(-40)}` as Address
  return { matchId, market }
}

// ── Report encoding ──────────────────────────────────────────────────────────

/**
 * ABI-encode (market, outcome) for the CRE report body.
 * Returns raw hex for use with prepareReportRequest().
 */
export function encodeResolutionPayload(market: Address, outcome: number): Hex {
  return encodeAbiParameters(
    parseAbiParameters("address market, uint8 outcome"),
    [market, outcome],
  )
}
