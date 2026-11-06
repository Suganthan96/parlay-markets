/**
 * Arkiv entity schemas for Parlay Markets.
 *
 * Three entity types:
 *   parlay.markets   — one per LMSR match market; expires 7 days after match close
 *   parlay.tickets   — one per parlay bet; expires 30 days; owned by bettor wallet
 *   parlay.liveodds  — ephemeral LMSR prices; expires 5 minutes (stays fresh automatically)
 */

import { addr, bytes, dec, defineSchema, str } from "@arkiv-network/sdk/schema"

// ── Match markets ─────────────────────────────────────────────────────────────
// Written by the LP/deployer when markets are created on-chain.
// Anyone can query to build the markets list page.
export const Markets = defineSchema("parlay.markets", {
  matchId:       str().indexed(),         // ESPN event ID (e.g. "401559012")
  teamA:         str().indexed(),         // home team name
  teamB:         str().indexed(),         // away team name
  marketAddress: addr().indexed(),        // LmsrMarket contract address on Sepolia
  closesAt:      dec().indexed(),         // unix timestamp when betting closes
  status:        str().indexed(),         // "open" | "resolved"
  outcome:       str().optional(),        // "home" | "away" | "draw" | null
})

// ── Parlay tickets ────────────────────────────────────────────────────────────
// Written by the dApp when a user places a bet.
// Owner = the bettor's wallet. Only the bettor can update their own tickets.
export const Tickets = defineSchema("parlay.tickets", {
  ticketId:   dec().indexed(),   // on-chain ticket ID from ParlayVault
  owner:      addr().indexed(),  // bettor's wallet address
  stake:      dec().indexed(),   // stake in USDC micro-units (6 dec)
  payout:     dec(),             // potential payout in USDC micro-units
  legCount:   dec().indexed(),   // number of legs
  status:     str().indexed(),   // "pending" | "won" | "lost" | "cashedout"
  legsJson:   bytes(),           // JSON: [{market, teamA, teamB, outcome, price}...]
})

// ── Live odds ─────────────────────────────────────────────────────────────────
// Written whenever LMSR prices are refreshed (every few minutes).
// Expires in 5 minutes — stale entries vanish automatically.
export const LiveOdds = defineSchema("parlay.liveodds", {
  marketAddress: addr().indexed(),   // LmsrMarket contract address
  priceHome:     dec().indexed(),    // LMSR price for Home (WAD fraction as decimal)
  priceAway:     dec().indexed(),    // LMSR price for Away (WAD fraction as decimal)
  impliedOddsA:  dec(),              // 1/priceHome
  impliedOddsB:  dec(),              // 1/priceAway
})
