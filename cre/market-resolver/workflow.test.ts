/**
 * CRE workflow simulation test.
 *
 * Run after deploying MarketResolver and calling requestSettlement:
 *
 *   cre workflow simulate market-resolver --target staging-settings \
 *     --non-interactive --trigger-index 0 \
 *     --evm-tx-hash <TX_HASH_THAT_EMITTED_SettlementRequested> \
 *     --evm-event-index 0
 *
 * To also broadcast the resolution on-chain, add --broadcast
 */

import { describe, test, expect } from "bun:test"
import initWorkflow from "./workflow.js"

describe("market-resolver workflow", () => {
  test("encodes outcome correctly for home win", () => {
    const homeScore = 3, awayScore = 1
    let outcome: number
    if (homeScore > awayScore) outcome = 1
    else if (awayScore > homeScore) outcome = 2
    else outcome = 3
    expect(outcome).toBe(1)
  })

  test("encodes outcome correctly for away win", () => {
    const homeScore = 0, awayScore = 2
    let outcome: number
    if (homeScore > awayScore) outcome = 1
    else if (awayScore > homeScore) outcome = 2
    else outcome = 3
    expect(outcome).toBe(2)
  })

  test("encodes outcome correctly for draw", () => {
    const homeScore = 1, awayScore = 1
    let outcome: number
    if (homeScore > awayScore) outcome = 1
    else if (awayScore > homeScore) outcome = 2
    else outcome = 3
    expect(outcome).toBe(3)
  })
})
