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

/**
 * Non-sports market source (crypto/finance/politics/any JSON API). Keyed in Config.sources by the market's
 * matchId (lowercase bytes32 hex). Outcome 1 ("Yes"/home) if `value op threshold` holds, else 2 ("No"/away).
 * Nodes fetch independently and reach consensus on the median of the numeric value found at `path`.
 */
interface ValueSource {
  question:  string
  url:       string
  path:      string                       // dot path into the JSON, e.g. "data.amount"
  op:        "gt" | "gte" | "lt" | "lte"
  threshold: number
}

export interface Config {
  sources?:         Record<string, ValueSource>
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
      { values: [hexToBase64(SETTLEMENT_REQUESTED_SIG)] },
      {},
      {},
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

    const resolveEspn = (): number => {
    // ── Consensus HTTP fetch ─────────────────────────────────────────────────

    const fetchGameResult = (
      sendRequester: Parameters<Parameters<typeof httpClient.sendRequest>[1]>[0],
      params: { baseUrl: string; eventId: string },
    ): GameResult => {
      const response = sendRequester
        .sendRequest({
          url:    `${params.baseUrl}/summary?event=${params.eventId}`,
          method: "GET",
        })
        .result()

      // body is Uint8Array — decode to string first
      const bodyText   = new TextDecoder().decode(response.body)
      const body       = JSON.parse(bodyText)
      const competition = body?.header?.competitions?.[0]
      const competitors = (competition?.competitors ?? []) as Array<{
        homeAway: string
        score:    string
      }>
      const home   = competitors.find((c) => c.homeAway === "home")
      const away   = competitors.find((c) => c.homeAway === "away")
      const status = competition?.status?.type?.state as string | undefined

      if (!home || !away) {
        throw new Error(`ESPN event ${params.eventId}: competitors not found`)
      }
      if (status !== "post") {
        throw new Error(`ESPN event ${params.eventId} not finished (state=${status})`)
      }

      return {
        homeScore: parseInt(home.score, 10),
        awayScore: parseInt(away.score, 10),
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
    return outcome
    }

    const resolveValue = (src: ValueSource): number => {
      const fetchValue = (
        sendRequester: Parameters<Parameters<typeof httpClient.sendRequest>[1]>[0],
        params: { url: string; path: string },
      ): { value: number } => {
        const response = sendRequester.sendRequest({ url: params.url, method: "GET" }).result()
        let node: unknown = JSON.parse(new TextDecoder().decode(response.body))
        for (const key of params.path.split(".")) node = (node as Record<string, unknown> | undefined)?.[key]
        const value = Number(node)
        if (!Number.isFinite(value)) throw new Error(`no numeric value at "${params.path}" in ${params.url}`)
        return { value }
      }
      const get = httpClient.sendRequest(runtime, fetchValue, ConsensusAggregationByFields<{ value: number }>({ value: median }))
      const { value } = get({ url: src.url, path: src.path }).result()
      const holds = { gt: value > src.threshold, gte: value >= src.threshold, lt: value < src.threshold, lte: value <= src.threshold }[src.op]
      runtime.log(`"${src.question}": value=${value} ${src.op} ${src.threshold} → ${holds}`)
      return holds ? 1 : 2
    }

    const source  = config.sources?.[matchId.toLowerCase()]
    const outcome = source ? resolveValue(source) : resolveEspn()

    // ── Create signed CRE report ─────────────────────────────────────────────

    const reportRequest = {
      encodedPayload: hexToBase64(encodeResolutionPayload(market, outcome)),
      encoderName:   "evm",
      signingAlgo:   "ecdsa",
      hashingAlgo:   "keccak256",
    }
    const report = runtime.report(reportRequest).result()

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
