/**
 * GET /api/odds
 * Reads live LMSR prices from each deployed market on Sepolia.
 * Required env vars:
 *   NEXT_PUBLIC_MARKETS  — comma-separated LmsrMarket addresses
 *   SEPOLIA_RPC_URL      — Alchemy/Infura RPC
 */

import { NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { LMSR_MARKET_ABI } from '@/lib/contracts';

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

  const results: { address: string; priceHome: number; priceAway: number; error?: string }[] = [];

  await Promise.all(
    MARKET_ADDRESSES.map(async (addr) => {
      try {
        const prices = await rpc.readContract({
          address: addr,
          abi: LMSR_MARKET_ABI,
          functionName: 'prices',
        }) as [bigint, bigint];
        results.push({ address: addr, priceHome: Number(prices[0]) / 1e18, priceAway: Number(prices[1]) / 1e18 });
      } catch (e) {
        results.push({ address: addr, priceHome: 0, priceAway: 0, error: String(e) });
      }
    }),
  );

  return NextResponse.json({ ok: true, updatedAt: Date.now(), markets: results });
}
