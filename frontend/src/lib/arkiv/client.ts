/**
 * Arkiv client setup.
 * Exports a publicClient (read-only) and a walletClient (write).
 *
 * Required env vars:
 *   NEXT_PUBLIC_ARKIV_ACCESS_KEY  — from https://hub.arkiv.network/access-keys
 *   ARKIV_PRIVATE_KEY             — wallet that owns entities (server-side only)
 */

import { createPublicClient, createWalletClient } from "@arkiv-network/sdk"
import { rabdi } from "@arkiv-network/sdk/chains"
import { http, type Hex } from "viem"
import { privateKeyToAccount } from "viem/accounts"

function chain() {
  const accessKey = process.env.NEXT_PUBLIC_ARKIV_ACCESS_KEY ?? ""
  return rabdi({ accessKey })
}

/** Read-only client — safe to use in browser (no private key). */
export function getPublicClient() {
  return createPublicClient({ chain: chain(), transport: http() })
}

/** Write client — server-side only. Requires ARKIV_PRIVATE_KEY env var. */
export function getWalletClient() {
  const pk = (process.env.ARKIV_PRIVATE_KEY ?? "") as Hex
  if (!pk) throw new Error("ARKIV_PRIVATE_KEY not set")
  const account = privateKeyToAccount(pk)
  return createWalletClient({ chain: chain(), transport: http(), account })
}
