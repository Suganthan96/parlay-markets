/**
 * Arkiv write helpers — called server-side when on-chain events occur.
 */

import { ExpirationTime } from "@arkiv-network/sdk"
import { addr, dec, str, bytes } from "@arkiv-network/sdk/schema"
import { stringToBytes }         from "viem"
import { getWalletClient }       from "./client.js"
import { Markets, Tickets, LiveOdds } from "./schema.js"

// ── Markets ───────────────────────────────────────────────────────────────────

export interface MarketInput {
  matchId:       string    // ESPN event ID
  teamA:         string
  teamB:         string
  marketAddress: `0x${string}`
  closesAt:      number    // unix timestamp
}

/** Write a new market entity when LP creates an LmsrMarket on-chain. */
export async function writeMarket(input: MarketInput): Promise<string> {
  const wallet = getWalletClient()
  const { entityKey } = await wallet.createEntity(
    Markets,
    {
      matchId:       input.matchId,
      teamA:         input.teamA,
      teamB:         input.teamB,
      marketAddress: addr(input.marketAddress),
      closesAt:      dec(input.closesAt.toString()),
      status:        "open",
    },
    { expiration: ExpirationTime.fromDays(7 + Math.ceil((input.closesAt - Date.now() / 1000) / 86400)) },
  )
  return entityKey
}

/** Update a market to resolved status after CRE resolves it. */
export async function resolveMarketEntity(
  entityKey:     string,
  outcome:       "home" | "away" | "draw",
): Promise<void> {
  const wallet = getWalletClient()
  await wallet.updateEntity(Markets, entityKey, {
    status:  "resolved",
    outcome,
  })
}

// ── Tickets ───────────────────────────────────────────────────────────────────

export interface LegInput {
  market:  string
  teamA:   string
  teamB:   string
  outcome: "home" | "away"
  price:   number   // WAD fraction as JS number e.g. 0.5
}

export interface TicketInput {
  ticketId:  number
  owner:     `0x${string}`
  stakeUsdc: bigint   // USDC micro-units
  payout:    bigint
  legs:      LegInput[]
}

/** Write a parlay ticket entity when a user buys via ParlayRouter. */
export async function writeTicket(input: TicketInput): Promise<string> {
  const wallet = getWalletClient()
  const { entityKey } = await wallet.createEntity(
    Tickets,
    {
      ticketId:  dec(input.ticketId.toString()),
      owner:     addr(input.owner),
      stake:     dec(input.stakeUsdc.toString()),
      payout:    dec(input.payout.toString()),
      legCount:  dec(input.legs.length.toString()),
      status:    "pending",
      legsJson:  stringToBytes(JSON.stringify(input.legs)),
    },
    { expiration: ExpirationTime.fromDays(30) },
  )
  return entityKey
}

/** Update ticket status after resolution (won/lost) or cash-out. */
export async function updateTicketStatus(
  entityKey: string,
  status:    "won" | "lost" | "cashedout",
): Promise<void> {
  const wallet = getWalletClient()
  await wallet.updateEntity(Tickets, entityKey, { status })
}

// ── Live Odds ─────────────────────────────────────────────────────────────────

export interface OddsInput {
  marketAddress: `0x${string}`
  priceHome:     number   // 0–1 e.g. 0.52
  priceAway:     number
}

/** Write fresh LMSR odds. Entity expires in 5 min — stale data vanishes automatically. */
export async function writeLiveOdds(input: OddsInput): Promise<string> {
  const wallet = getWalletClient()
  const { entityKey } = await wallet.createEntity(
    LiveOdds,
    {
      marketAddress: addr(input.marketAddress),
      priceHome:     dec(input.priceHome.toFixed(18)),
      priceAway:     dec(input.priceAway.toFixed(18)),
      impliedOddsA:  dec((1 / input.priceHome).toFixed(4)),
      impliedOddsB:  dec((1 / input.priceAway).toFixed(4)),
    },
    { expiration: ExpirationTime.fromMinutes(5) },
  )
  return entityKey
}
