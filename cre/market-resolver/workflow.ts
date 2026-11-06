/**
 * Parlay Markets — CRE Market Resolver Workflow
 *
 * Flow:
 *   1. Someone calls MarketResolver.requestSettlement(matchId, market) on Sepolia
 *      → emits SettlementRequested(matchId, market, requestedAt)
 *   2. This workflow detects the event log via logTriggerSettlementRequested()
 *   3. CRE DON fetches the game result from ESPN (or the configured sports API)
 *      using consensus across multiple nodes
 *   4. Nodes agree on homeScore / awayScore via median aggregation
 *   5. The workflow encodes (market, outcome) and calls MarketResolver.receiveReport()
 *      via the Chainlink Forwarder — only the authorized CRE forwarder address can trigger
 *
 * Simulate:
 *   cre workflow simulate market-resolver --target staging-settings \
 *     --non-interactive --trigger-index 0 \
 *     --evm-tx-hash 0xTX_HASH --evm-event-index 0
 */

import * as cre from "@chainlink/cre-sdk"
import { type Address } from "viem"

import {
  MarketResolver,
  encodeResolutionReport,
  type SettlementRequestedEvent,
} from "./contracts/MarketResolver.js"

// ── Config shape (loaded from config.staging.json) ───────────────────────────

interface EvmConfig {
  chainSelectorName: string
  marketResolverAddress: string
  gasLimit?: string
}

interface Config {
  evms:             EvmConfig[]
  sportsApiBaseUrl: string
  aggregationMode:  "majority" | "median"
}

// ── ESPN game result shape ────────────────────────────────────────────────────

interface GameResult {
  homeScore: number
  awayScore: number
  status:    string   // "in", "post", "pre"
}

// ── Workflow entrypoint ───────────────────────────────────────────────────────

export default function initWorkflow(
  runtime: cre.Runtime,
  config:  Config,
): cre.Handler[] {
  const evmConfig = config.evms[0]
  if (!evmConfig) throw new Error("No EVM config found")

  const network = cre.getNetwork({
    chainFamily:      "evm",
    chainSelectorName: evmConfig.chainSelectorName,
  })
  if (!network) throw new Error(`Network not found: ${evmConfig.chainSelectorName}`)

  const evmClient = new cre.capabilities.EVMClient(network.chainSelector.selector)
  const resolver  = new MarketResolver(
    evmClient,
    evmConfig.marketResolverAddress as Address,
  )

  // ── Event handler ─────────────────────────────────────────────────────────

  async function onSettlementRequested(
    runtime:  cre.Runtime,
    event:    SettlementRequestedEvent,
  ): Promise<void> {
    const { matchId, market } = event

    // matchId was encoded as keccak256(gameId string). We recover the hex string
    // and use it as the ESPN event ID directly.
    const espnEventId = BigInt(matchId).toString()

    // Fetch game result with DON consensus (multiple nodes → median aggregation).
    const httpClient = new cre.capabilities.HTTPClient()

    const gameResult = httpClient
      .sendRequest(
        runtime,
        fetchGameResult,
        cre.ConsensusAggregationByFields<GameResult>({
          homeScore: cre.median,
          awayScore: cre.median,
        }),
      )({ baseUrl: config.sportsApiBaseUrl, eventId: espnEventId })
      .result()

    // Determine outcome: 1=Home, 2=Away, 3=Draw
    let outcome: 1 | 2 | 3
    if (gameResult.homeScore > gameResult.awayScore) {
      outcome = 1
    } else if (gameResult.awayScore > gameResult.homeScore) {
      outcome = 2
    } else {
      outcome = 3
    }

    console.log(`SettlementRequested matchId=${matchId} market=${market}`)
    console.log(`Result: homeScore=${gameResult.homeScore} awayScore=${gameResult.awayScore} → outcome=${outcome}`)

    // Write the resolution report on-chain via the CRE Forwarder.
    const reportData = encodeResolutionReport(market, outcome)
    const resp = resolver.writeReport(runtime, reportData, {
      gasLimit: evmConfig.gasLimit ?? "500000",
    })

    if (resp.txStatus !== cre.TxStatus.SUCCESS) {
      throw new Error(`Resolution TX failed: ${resp.errorMessage ?? resp.txStatus}`)
    }

    console.log(`Market ${market} resolved on-chain (tx: ${resp.txHash})`)
  }

  return [cre.handler(resolver.logTriggerSettlementRequested(), onSettlementRequested)]
}

// ── ESPN HTTP fetcher (runs inside the DON) ───────────────────────────────────

interface FetchConfig {
  baseUrl: string
  eventId: string
}

function fetchGameResult(
  sendRequester: cre.HTTPSendRequester,
  config: FetchConfig,
): GameResult {
  const response = sendRequester
    .sendRequest({
      url:    `${config.baseUrl}/events/${config.eventId}`,
      method: "GET",
    })
    .result()

  const body = JSON.parse(response.body)

  // ESPN scoreboard response shape:
  // { events: [{ competitions: [{ competitors: [{ homeAway, score }] }] }] }
  const competition = body?.events?.[0]?.competitions?.[0]
  const competitors  = (competition?.competitors ?? []) as Array<{
    homeAway: string
    score:    string
  }>
  const home = competitors.find((c) => c.homeAway === "home")
  const away = competitors.find((c) => c.homeAway === "away")

  const status = competition?.status?.type?.state ?? "post"

  return {
    homeScore: parseInt(home?.score ?? "0", 10),
    awayScore: parseInt(away?.score ?? "0", 10),
    status,
  }
}
