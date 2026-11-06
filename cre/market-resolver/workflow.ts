/**
 * Parlay Markets — CRE Market Resolver Workflow
 *
 * Flow:
 *   1. Someone calls MarketResolver.requestSettlement(matchId, market) on Sepolia
 *      → emits SettlementRequested(bytes32 matchId, address market, uint256 requestedAt)
 *   2. This workflow detects the event log via logTrigger
 *   3. CRE DON fetches the game result from ESPN using consensus across multiple nodes
 *   4. Nodes agree on homeScore / awayScore via median aggregation
 *   5. The workflow encodes (market, outcome) and calls MarketResolver.receiveReport()
 *      via the Chainlink Forwarder — only the authorized CRE forwarder can call it
 *
 * Simulate:
 *   cre workflow simulate market-resolver --target staging-settings --broadcast
 *   → select the EVM log trigger, then provide a tx hash + event index from Sepolia
 */

import {
  EVMClient,
  HTTPClient,
  handler,
  ConsensusAggregationByFields,
  median,
  ignore,
  TxStatus,
  hexToBase64,
  type EVMLog,
  type Runtime,
  type Workflow,
  type SecretsProvider,
} from "@chainlink/cre-sdk"

import {
  SETTLEMENT_REQUESTED_SIG,
  decodeSettlementRequestedLog,
  encodeResolutionPayload,
} from "./contracts/MarketResolver.js"

// ── Config shape (loaded from config.staging.json) ───────────────────────────

interface EvmConfig {
  chainSelectorName:     string
  marketResolverAddress: string
  gasLimit?:             string
}

export interface Config {
  evms:             EvmConfig[]
  sportsApiBaseUrl: string
  aggregationMode:  "majority" | "median"
}

// ── ESPN game result shape ────────────────────────────────────────────────────

interface GameResult {
  homeScore: number
  awayScore: number
  status:    string   // "in" | "post" | "pre"
}

// ── Workflow entrypoint ───────────────────────────────────────────────────────

export default function initWorkflow(
  config:          Config,
  _secretsProvider?: SecretsProvider,
): Workflow<Config> {
  const evmConfig = config.evms[0]
  if (!evmConfig) throw new Error("No EVM config found")

  const { marketResolverAddress, gasLimit = "500000" } = evmConfig
  if (!marketResolverAddress || marketResolverAddress === "0x0000000000000000000000000000000000000000") {
    throw new Error("marketResolverAddress must be set in config")
  }

  // Sepolia chain selector
  const sepoliaSelector = EVMClient.SUPPORTED_CHAIN_SELECTORS["ethereum-testnet-sepolia"]
  const evmClient  = new EVMClient(sepoliaSelector)
  const httpClient = new HTTPClient()

  // ── Log trigger: watch for SettlementRequested events ─────────────────────

  const settlementTrigger = evmClient.logTrigger({
    addresses: [hexToBase64(marketResolverAddress)],
    topics: [
      { values: [hexToBase64(SETTLEMENT_REQUESTED_SIG)] },   // topic[0]: event signature
      {},                                                      // topic[1]: matchId (any)
      {},                                                      // topic[2]: market address (any)
    ],
  })

  // ── Handler ───────────────────────────────────────────────────────────────

  async function onSettlementRequested(
    runtime: Runtime<Config>,
    log:     EVMLog,
  ): Promise<string> {
    const { matchId, market } = decodeSettlementRequestedLog(log)

    // matchId was stored as keccak256(uint256(espnEventId)) but we can recover
    // the numeric ID by treating the bytes32 as a big-endian uint256 string.
    const espnEventId = BigInt(matchId).toString()

    runtime.log(`SettlementRequested: matchId=${matchId} market=${market} espnEventId=${espnEventId}`)

    // ── Consensus HTTP fetch ─────────────────────────────────────────────────

    const fetchGameResult = (
      sendRequester: Parameters<Parameters<typeof httpClient.sendRequest>[1]>[0],
      params: { baseUrl: string; eventId: string },
    ): GameResult => {
      const response = sendRequester
        .sendRequest({
          url:    `${params.baseUrl}/events/${params.eventId}`,
          method: "GET",
        })
        .result()

      // body is Uint8Array — decode to string first
      const bodyText   = new TextDecoder().decode(response.body)
      const body       = JSON.parse(bodyText)
      const competition = body?.events?.[0]?.competitions?.[0]
      const competitors = (competition?.competitors ?? []) as Array<{
        homeAway: string
        score:    string
      }>
      const home   = competitors.find((c) => c.homeAway === "home")
      const away   = competitors.find((c) => c.homeAway === "away")
      const status = competition?.status?.type?.state ?? "post"

      return {
        homeScore: parseInt(home?.score ?? "0", 10),
        awayScore: parseInt(away?.score ?? "0", 10),
        status,
      }
    }

    const getGameResult = httpClient.sendRequest(
      runtime,
      fetchGameResult,
      ConsensusAggregationByFields<GameResult>({
        homeScore: median,
        awayScore: median,
        status:    ignore,   // string field — ignored in consensus
      }),
    )

    const gameResult = getGameResult({
      baseUrl: config.sportsApiBaseUrl,
      eventId: espnEventId,
    }).result()

    // ── Determine outcome ─────────────────────────────────────────────────────

    let outcome: number
    if (gameResult.homeScore > gameResult.awayScore) {
      outcome = 1   // Home wins
    } else if (gameResult.awayScore > gameResult.homeScore) {
      outcome = 2   // Away wins
    } else {
      outcome = 3   // Draw
    }

    runtime.log(
      `Scores: home=${gameResult.homeScore} away=${gameResult.awayScore} → outcome=${outcome}`,
    )

    // ── Create signed CRE report ─────────────────────────────────────────────

    const encodedPayload = encodeResolutionPayload(market, outcome)
    const report = runtime.report({ encodedPayload }).result()

    // ── Write on-chain via CRE Forwarder ─────────────────────────────────────

    const writeResult = evmClient.writeReport(runtime, {
      receiver: marketResolverAddress,
      report,
      gasConfig: { gasLimit },
    }).result()

    if (writeResult.txStatus !== TxStatus.SUCCESS) {
      throw new Error(`Resolution TX failed: txStatus=${writeResult.txStatus}`)
    }

    const txHash = writeResult.txHash
      ? Buffer.from(writeResult.txHash).toString("hex")
      : "unknown"

    runtime.log(`Market ${market} resolved on-chain (tx: 0x${txHash})`)
    return `resolved market=${market} outcome=${outcome} tx=0x${txHash}`
  }

  return [handler(settlementTrigger, onSettlementRequested)]
}
