/**
 * Arkiv read helpers — safe to call from Next.js server components or API routes.
 */

import { addr, dec, str } from "@arkiv-network/sdk/schema"
import { hexToString }    from "viem"
import { getPublicClient } from "./client.js"
import { Markets, Tickets, LiveOdds } from "./schema.js"

// ── Markets ───────────────────────────────────────────────────────────────────

export interface MarketRecord {
  $key:          string
  matchId:       string
  teamA:         string
  teamB:         string
  marketAddress: string
  closesAt:      number
  status:        string
  outcome?:      string
}

/** Fetch all open markets ordered by closing time. */
export async function getOpenMarkets(): Promise<MarketRecord[]> {
  const pub = getPublicClient()
  const { entities } = await pub
    .select({ $key: true, matchId: true, teamA: true, teamB: true,
              marketAddress: true, closesAt: true, status: true, outcome: true })
    .from(Markets)
    .where(`status = str('open')`)
    .orderBy("closesAt", "ASC")
    .fetch()

  return entities.map((e) => ({
    $key:          e.$key,
    matchId:       e.matchId.value,
    teamA:         e.teamA.value,
    teamB:         e.teamB.value,
    marketAddress: e.marketAddress.value,
    closesAt:      Number(e.closesAt.value),
    status:        e.status.value,
    outcome:       e.outcome?.value,
  }))
}

/** Fetch a single market by contract address. */
export async function getMarket(marketAddress: `0x${string}`): Promise<MarketRecord | null> {
  const pub = getPublicClient()
  const { entities } = await pub
    .select({ $key: true, matchId: true, teamA: true, teamB: true,
              marketAddress: true, closesAt: true, status: true, outcome: true })
    .from(Markets)
    .where(`marketAddress = addr('${marketAddress}')`)
    .fetch()

  const e = entities[0]
  if (!e) return null
  return {
    $key:          e.$key,
    matchId:       e.matchId.value,
    teamA:         e.teamA.value,
    teamB:         e.teamB.value,
    marketAddress: e.marketAddress.value,
    closesAt:      Number(e.closesAt.value),
    status:        e.status.value,
    outcome:       e.outcome?.value,
  }
}

// ── Tickets ───────────────────────────────────────────────────────────────────

export interface TicketRecord {
  $key:      string
  ticketId:  number
  stake:     bigint
  payout:    bigint
  legCount:  number
  status:    string
  legs:      unknown[]
}

/** Fetch all tickets owned by a wallet address. */
export async function getTicketsByOwner(owner: `0x${string}`): Promise<TicketRecord[]> {
  const pub = getPublicClient()
  const { entities } = await pub
    .select({ $key: true, ticketId: true, stake: true, payout: true,
              legCount: true, status: true, legsJson: true })
    .from(Tickets)
    .ownedBy(owner)
    .fetch()

  return entities.map((e) => ({
    $key:     e.$key,
    ticketId: Number(e.ticketId.value),
    stake:    BigInt(e.stake.value),
    payout:   BigInt(e.payout.value),
    legCount: Number(e.legCount.value),
    status:   e.status.value,
    legs:     JSON.parse(hexToString(e.legsJson.value)),
  }))
}

/** Fetch pending tickets across all users (for admin/resolver views). */
export async function getPendingTickets(): Promise<TicketRecord[]> {
  const pub = getPublicClient()
  const { entities } = await pub
    .select({ $key: true, ticketId: true, stake: true, payout: true,
              legCount: true, status: true, legsJson: true })
    .from(Tickets)
    .where(`status = str('pending')`)
    .fetch()

  return entities.map((e) => ({
    $key:     e.$key,
    ticketId: Number(e.ticketId.value),
    stake:    BigInt(e.stake.value),
    payout:   BigInt(e.payout.value),
    legCount: Number(e.legCount.value),
    status:   e.status.value,
    legs:     JSON.parse(hexToString(e.legsJson.value)),
  }))
}

// ── Live Odds ─────────────────────────────────────────────────────────────────

export interface OddsRecord {
  $key:          string
  marketAddress: string
  priceHome:     number
  priceAway:     number
  impliedOddsA:  number
  impliedOddsB:  number
}

/** Get the latest (most recent non-expired) odds for a market. */
export async function getLiveOdds(marketAddress: `0x${string}`): Promise<OddsRecord | null> {
  const pub = getPublicClient()
  const { entities } = await pub
    .select({ $key: true, marketAddress: true,
              priceHome: true, priceAway: true,
              impliedOddsA: true, impliedOddsB: true })
    .from(LiveOdds)
    .where(`marketAddress = addr('${marketAddress}')`)
    .orderBy("$expiresAt", "DESC")
    .limit(1)
    .fetch()

  const e = entities[0]
  if (!e) return null
  return {
    $key:          e.$key,
    marketAddress: e.marketAddress.value,
    priceHome:     Number(e.priceHome.value),
    priceAway:     Number(e.priceAway.value),
    impliedOddsA:  Number(e.impliedOddsA.value),
    impliedOddsB:  Number(e.impliedOddsB.value),
  }
}
