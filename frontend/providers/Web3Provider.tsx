'use client';

import { ReactNode } from 'react';
import { WagmiProvider, createConfig } from 'wagmi';
import { custom } from 'viem';
import { sepolia } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Primary RPC from env (should be your Alchemy key), then public fallbacks
const PRIMARY_RPC = process.env.NEXT_PUBLIC_RPC_URL ?? '';
const BROADCAST_RPCS = [
  PRIMARY_RPC,
  'https://eth-sepolia.public.blastapi.io',
  'https://rpc.sepolia.org',
  'https://ethereum-sepolia-rpc.publicnode.com',
].filter(Boolean);

async function tryRpc(body: string): Promise<{ data: any }> {
  let lastErr = '';
  for (const rpc of BROADCAST_RPCS) {
    try {
      const res = await fetch(rpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) { lastErr = `HTTP ${res.status}`; continue; }
      const data = await res.json();
      const msg: string = data?.error?.message ?? '';
      if (/rate.limit|too many|quota/i.test(msg)) { lastErr = msg; continue; }
      return { data };
    } catch (e: any) {
      lastErr = e.message;
      console.warn(`[rpc] ${rpc} failed:`, e.message);
    }
  }
  return { data: { jsonrpc: '2.0', error: { code: -32603, message: `All RPCs failed: ${lastErr}` } } };
}

// Build a transport: use window.ethereum for signing but our RPCs for broadcasting
function makeTransport() {
  // Methods that MUST go through MetaMask (need wallet key)
  const WALLET_METHODS = new Set([
    'eth_requestAccounts', 'eth_accounts', 'eth_sign', 'personal_sign',
    'eth_signTypedData', 'eth_signTypedData_v3', 'eth_signTypedData_v4',
    'eth_signTransaction', 'eth_sendTransaction',
    'wallet_switchEthereumChain', 'wallet_addEthereumChain',
    'wallet_watchAsset', 'wallet_getPermissions', 'wallet_requestPermissions',
  ]);

  return custom({
    async request({ method, params }: { method: string; params: unknown[] }) {
      // Wallet/signing methods — must go through MetaMask
      if (WALLET_METHODS.has(method) && (window as any).ethereum) {
        return (window as any).ethereum.request({ method, params });
      }
      // Everything else (reads + chainId + broadcast) — go directly to our RPCs
      const { data } = await tryRpc(
        JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params })
      );
      if (data.error) throw new Error(data.error.message ?? JSON.stringify(data.error));
      return data.result;
    },
  });
}

const wagmiConfig = createConfig({
  chains: [sepolia],
  connectors: [injected()],
  transports: { [sepolia.id]: makeTransport() },
  ssr: true,
});

const queryClient = new QueryClient();

export function Web3Provider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig} reconnectOnMount>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
