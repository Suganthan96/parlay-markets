// Continuous CRE settlement monitor.
// Every N seconds: find markets past kickoff & unresolved -> requestSettlement() -> run the
// CRE workflow on the emitted SettlementRequested log -> append every step to monitor.log.jsonl.
// This runs `cre workflow simulate` locally (not a deployed CRE workflow).
//   node cre/monitor.mjs          # loop
//   node cre/monitor.mjs --once   # single pass (used by the "run now" button)
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { readFileSync, appendFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(path.join(here, '../frontend/package.json'))
const { createPublicClient, createWalletClient, http, parseAbi, parseAbiItem, toHex } = require('viem')
const { privateKeyToAccount } = require('viem/accounts')
const { sepolia } = require('viem/chains')

process.env.PATH = `${process.env.PATH}:${process.env.HOME}/.cre/bin:${process.env.HOME}/.bun/bin`
const cfg = JSON.parse(readFileSync(path.join(here, 'monitor.config.json'), 'utf8'))
const LOG = path.join(here, 'monitor.log.jsonl')
const LOCK = path.join(here, 'monitor.lock')
const once = process.argv.includes('--once')

const env = Object.fromEntries(
  readFileSync(path.join(here, '.env'), 'utf8').split('\n')
    .filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
)
const account = privateKeyToAccount(env.CRE_ETH_PRIVATE_KEY.startsWith('0x') ? env.CRE_ETH_PRIVATE_KEY : `0x${env.CRE_ETH_PRIVATE_KEY}`)
const rpc = 'https://ethereum-sepolia-rpc.publicnode.com'
const pub = createPublicClient({ chain: sepolia, transport: http(rpc) })
// publicnode/Alchemy-free restrict address-less eth_getLogs; Tenderly's public gateway allows it.
const logClient = createPublicClient({ chain: sepolia, transport: http('https://sepolia.gateway.tenderly.co') })
const wallet = createWalletClient({ account, chain: sepolia, transport: http(rpc) })

const marketAbi = parseAbi([
  'function kickoff() view returns (uint256)', 'function result() view returns (uint8)',
  'function matchId() view returns (bytes32)', 'function resolver() view returns (address)',
  'function homeTeam() view returns (string)', 'function awayTeam() view returns (string)',
])
const MARKETS_FILE = path.join(here, 'monitor.markets.json')
const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1'

// Discover markets from chain events: every LmsrMarket emits MarketCreated(matchId, home, away, kickoff)
// on deployment. We scan those logs (from cfg.fromBlock, incrementally) and keep the markets whose
// resolver() is the CRE-enabled resolver and whose matchId is an ESPN event id. Nothing is hardcoded:
// a market created after the monitor starts is picked up on the next pass.
const createdEvent = parseAbiItem('event MarketCreated(bytes32 indexed matchId, string home, string away, uint256 kickoff)')
const known = new Map()
// Non-sports markets: the workflow config's `sources` map (keyed by matchId) tells CRE which API/threshold to use.
const sourcesFor = () => JSON.parse(readFileSync(path.join(here, 'market-resolver/config.staging.json'), 'utf8')).sources ?? {}
let scannedTo = BigInt(cfg.fromBlock) - 1n

async function discover() {
  const head = await logClient.getBlockNumber()
  for (let from = scannedTo + 1n; from <= head; from += 5000n) {
    const to = from + 4999n > head ? head : from + 4999n
    const logs = await logClient.getLogs({ event: createdEvent, fromBlock: from, toBlock: to })
    for (const l of logs) {
      const market = l.address
      if (known.has(market)) continue
      const resolver = await pub.readContract({ address: market, abi: marketAbi, functionName: 'resolver' })
      const id = BigInt(l.args.matchId)
      const source = sourcesFor()[l.args.matchId.toLowerCase()]
      const eligible = resolver.toLowerCase() === cfg.resolver.toLowerCase() && (id < 2n ** 32n || !!source)
      const key = source ? l.args.matchId.slice(0, 10) : String(id)   // id used in logs/UI
      const m = { market, matchId: l.args.matchId, espnId: key, kind: source ? 'value' : 'espn', label: source ? source.question : `${l.args.home} vs ${l.args.away}`, eligible }
      known.set(market, m)
      if (eligible) log(m, 'watching', `new market discovered from MarketCreated event: ${m.label} (${market})`, { tx: l.transactionHash })
    }
    scannedTo = to
  }
  const out = []
  for (const m of known.values()) {
    const result = await pub.readContract({ address: m.market, abi: marketAbi, functionName: 'result' })
    out.push({ ...m, result })
    known.set(m.market, m)
  }
  writeFileSync(MARKETS_FILE, JSON.stringify(out, null, 2))
  return out
}

async function espnState(id) {
  const b = await (await fetch(`${ESPN}/summary?event=${id}`)).json()
  return b?.header?.competitions?.[0]?.status?.type?.state
}
const resolverAbi = parseAbi(['function requestSettlement(bytes32 matchId, address market)'])

const log = (m, stage, msg, extra = {}) =>
  appendFileSync(LOG, JSON.stringify({ t: Date.now(), espnId: m?.espnId ?? null, stage, msg, ...extra }) + '\n')

function runCre(m, txHash) {
  return new Promise((resolve) => {
    const args = ['workflow', 'simulate', 'market-resolver', '--target', cfg.target, '--non-interactive',
      '--trigger-index', '0', '--evm-tx-hash', txHash, '--evm-event-index', '0', '--broadcast', '--limits=none']
    log(m, 'fetching', `$ cre ${args.join(' ')}`)
    const p = spawn('cre', args, { cwd: here, env: process.env })
    p.on('error', (e) => { log(m, 'error', `cre CLI not runnable: ${e.message}. Install the CRE CLI and run 'cre login'.`); resolve(null) })
    let out = ''
    const onData = (d) => d.toString().split('\n').filter(Boolean).forEach((line) => {
      out += line + '\n'; log(m, 'fetching', line, { raw: true })
    })
    p.stdout.on('data', onData); p.stderr.on('data', onData)
    p.on('close', (code) => { if (code === -2) return resolve(null); resolve(code === 0 ? out : (log(m, 'error', `cre exited with code ${code}`), null)) })
  })
}

async function pass() {
  const markets = await discover()
  log(null, 'watching', `watching ${markets.filter((m) => m.eligible).length} markets discovered from on-chain MarketCreated events`)
  for (const m of markets) {
    try {
      if (!m.eligible) continue
      const [kickoff, result] = await Promise.all([
        pub.readContract({ address: m.market, abi: marketAbi, functionName: 'kickoff' }),
        pub.readContract({ address: m.market, abi: marketAbi, functionName: 'result' }),
      ])
      if (result !== 0) { continue } // already resolved
      if (BigInt(Math.floor(Date.now() / 1000)) < kickoff) { log(m, 'watching', `${m.label}: kickoff not reached, watching`); continue }
      const state = m.kind === 'value' ? 'post' : await espnState(m.espnId)
      if (state !== 'post') { log(m, 'watching', `${m.label}: past kickoff but ESPN state is "${state}" — not finished, waiting`); continue }
      log(m, 'watching', `${m.label}: resolution time reached, unresolved on-chain -> requesting settlement`)
      const matchId = m.kind === 'value' ? m.matchId : toHex(BigInt(m.espnId), { size: 32 })
      const hash = await wallet.writeContract({ address: cfg.resolver, abi: resolverAbi, functionName: 'requestSettlement', args: [matchId, m.market] })
      await pub.waitForTransactionReceipt({ hash })
      log(m, 'requested', `SettlementRequested emitted`, { tx: hash })
      const out = await runCre(m, hash)
      if (!out) continue
      const tx = out.match(/tx=(0x[0-9a-fA-F]+)/)?.[1]
      const outcome = out.match(/outcome=(\d)/)?.[1]
      const scores = out.match(/Scores: home=(\d+) away=(\d+)/)
      const val = out.match(/value=([\d.]+) (gt|gte|lt|lte) ([\d.]+) → (true|false)/)
      let after = 0
      for (let i = 0; i < 6 && after === 0; i++) { // public RPCs can lag a block behind the write
        after = await pub.readContract({ address: m.market, abi: marketAbi, functionName: 'result' })
        if (after === 0) await new Promise((r) => setTimeout(r, 4000))
      }
      if (after !== 0) log(m, 'resolved', `${m.label} resolved on-chain (result=${after}${scores ? `, ${scores[1]}-${scores[2]}` : ''}${val ? `, value ${val[1]} ${val[2]} ${val[3]} → ${val[4] === 'true' ? 'YES' : 'NO'}` : ''})`, { tx, outcome: Number(after) })
      else log(m, 'error', 'CRE finished but market is still unresolved (is the resolver cre() set to the simulation forwarder?)')
    } catch (e) {
      log(m, 'error', String(e.shortMessage ?? e.message))
    }
  }
}

if (process.argv.includes('--discover')) { console.log(JSON.stringify(await discover(), null, 2)); process.exit(0) }
if (existsSync(LOCK) && Date.now() - Number(readFileSync(LOCK, 'utf8')) < 10 * 60 * 1000 && !once) {
  console.error('monitor already running'); process.exit(0)
}
if (!once) writeFileSync(LOCK, String(Date.now()))
process.on('exit', () => { if (!once) try { unlinkSync(LOCK) } catch {} })
process.on('SIGINT', () => process.exit(0))
log(null, 'watching', `monitor started (${once ? 'single pass' : `every ${cfg.intervalSeconds}s`}), signer ${account.address}`)
do {
  await pass()
  if (!once) { writeFileSync(LOCK, String(Date.now())); await new Promise((r) => setTimeout(r, cfg.intervalSeconds * 1000)) }
} while (!once)
