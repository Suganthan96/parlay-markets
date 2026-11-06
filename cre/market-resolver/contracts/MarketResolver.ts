/**
 * TypeScript binding for MarketResolver.sol — used by the CRE workflow.
 * Mirrors the pattern of the generated SportsMarket.ts from the CRE sports-resolution template.
 */

import * as cre from "@chainlink/cre-sdk"
import {
  encodeAbiParameters,
  parseAbiParameters,
  type Address,
  type Hex,
} from "viem"

// ── ABI (subset needed by the workflow) ──────────────────────────────────────

const SETTLEMENT_REQUESTED_EVENT = {
  type: "event",
  name: "SettlementRequested",
  inputs: [
    { name: "matchId", type: "bytes32", indexed: true },
    { name: "market",  type: "address", indexed: true },
    { name: "requestedAt", type: "uint256", indexed: false },
  ],
} as const

const RECEIVE_REPORT_FUNCTION = {
  type: "function",
  name: "receiveReport",
  inputs: [
    { name: "workflowExecutionId", type: "bytes32" },
    { name: "workflowName",        type: "bytes32" },
    { name: "workflowOwner",       type: "bytes32" },
    { name: "data",                type: "bytes"   },
  ],
  outputs: [],
  stateMutability: "nonpayable",
} as const

export interface SettlementRequestedEvent {
  matchId: Hex
  market:  Address
  requestedAt: bigint
}

export class MarketResolver {
  private evmClient: cre.capabilities.EVMClient
  private address:   Address

  constructor(evmClient: cre.capabilities.EVMClient, address: Address) {
    this.evmClient = evmClient
    this.address   = address
  }

  // ── Trigger ───────────────────────────────────────────────────────────────

  logTriggerSettlementRequested(): cre.LogTrigger<SettlementRequestedEvent> {
    return this.evmClient.createLogTrigger<SettlementRequestedEvent>({
      contractAddress: this.address,
      eventAbi: SETTLEMENT_REQUESTED_EVENT,
    })
  }

  // ── On-chain write (via CRE Forwarder → receiveReport) ───────────────────

  writeReport(
    runtime:   cre.Runtime,
    reportData: Hex,
    options?:  { gasLimit?: string },
  ): cre.TxResponse {
    return this.evmClient.writeContract(runtime, {
      address:      this.address,
      abi:          [RECEIVE_REPORT_FUNCTION],
      functionName: "receiveReport",
      args:         ["0x", "0x", "0x", reportData],
      gasLimit:     options?.gasLimit ?? "500000",
    })
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function encodeResolutionReport(market: Address, outcome: number): Hex {
  return encodeAbiParameters(
    parseAbiParameters("address market, uint8 outcome"),
    [market, outcome],
  )
}
