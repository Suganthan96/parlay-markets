/**
 * GET /api/odds
 * Reads live LMSR prices from each deployed market on Sepolia,
 * then writes a fresh LiveOdds entity to Arkiv (5-min TTL).
 *
 * Called by a cron job or on-demand from the frontend to keep odds fresh.
 * Returns JSON with the current prices for all markets.
 *
 * Required env vars:
 *   NEXT_PUBLIC_MARKETS      — comma-separated LmsrMarket addresses
 *   SEPOLIA_RPC_URL          — Alchemy/Infura RPC
 *   ARKIV_PRIVATE_KEY        — server wallet that writes to Arkiv
 *   NEXT_PUBLIC_ARKIV_ACCESS_KEY
 */

import { NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { LMSR_MARKET_ABI } from '@/lib/contracts';
import { writeLiveOdds } from '@/src/lib/arkiv/write';

const MARKET_ADDRESSES: `0x${string}`[] =
  (process.env.NEXT_PUBLIC_MARKETS ?? '').split(',').filter(Boolean) as `0x${string}`[];

const rpc = createPublicClient({
  chain: sepolia,
  transport: http(process.env.SEPOLIA_RPC_URL ?? 'https://rpc.sepolia.org'),
});

export async function GET() {
  if (MARKET_ADDRESSES.length === 0) {
    return NextResponse.json({ ok: true, markets: [], note: 'No markets configured' });
  }

  const results: { address: string; priceHome: number; priceAway: number; arkivKey?: string; error?: string }[] = [];

  await Promise.all(
    MARKET_ADDRESSES.map(async (addr) => {
      try {
        const prices = await rpc.readContract({
          address: addr,
          abi: LMSR_MARKET_ABI,
          functionName: 'prices',
        }) as [bigint, bigint];

        const priceHome = Number(prices[0]) / 1e18;
        const priceAway = Number(prices[1]) / 1e18;

        // Write to Arkiv (best-effort — don't fail the response if Arkiv is down)
        let arkivKey: string | undefined;
        if (process.env.ARKIV_PRIVATE_KEY) {
          try {
            arkivKey = await writeLiveOdds({ marketAddress: addr, priceHome, priceAway });
          } catch (e) {
            console.warn('Arkiv write failed for', addr, e);
          }
        }

        results.push({ address: addr, priceHome, priceAway, arkivKey });
      } catch (e) {
        results.push({ address: addr, priceHome: 0, priceAway: 0, error: String(e) });
      }
    }),
  );

  return NextResponse.json({ ok: true, updatedAt: Date.now(), markets: results });
}
