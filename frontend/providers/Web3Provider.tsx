'use client';

// ── Chain setup ────────────────────────────────────────────────
// • Sepolia (11155111) — 1inch Aqua, SwapVM, your contracts, Chainlink CRE
// • Arkiv Rabdi (7794095) — Arkiv data schemas only (read/write via ArkivClient,
//   not via wagmi — Arkiv has its own SDK, not an EVM wallet flow)
//
// RainbowKit + wagmi are commented out because @coinbase/cdp-sdk has a broken
// transitive dep (@x402/evm/upto/client) that crashes Next.js compilation.
// Swap the QueryClientProvider wrapper below for the full setup once that is fixed,
// or when you switch to ConnectKit which doesn't pull in cdp-sdk.

import { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

export function Web3Provider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

/*
── Full wagmi + RainbowKit setup (uncomment when cdp-sdk dep is fixed) ──

import { WagmiProvider } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { getDefaultConfig, RainbowKitProvider } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import { http } from 'wagmi';

const config = getDefaultConfig({
  appName: 'Parlay Markets',
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? 'demo',
  chains: [sepolia],
  transports: { [sepolia.id]: http() },
  ssr: true,
});

export function Web3Provider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={new QueryClient()}>
        <RainbowKitProvider>{children}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
*/
