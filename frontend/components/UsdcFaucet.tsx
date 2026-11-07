'use client';

import { useAccount } from 'wagmi';
import { useUsdcBalance } from '@/lib/hooks';

export default function UsdcFaucet() {
  const { address, isConnected } = useAccount();

  const { formatted: bal, isLoading } = useUsdcBalance(address);

  if (!isConnected) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 24px', background: '#1a1a1a', borderTop: '1px solid #333' }}>
      <span className="text-label" style={{ fontSize: 9, color: '#666', flexShrink: 0 }}>■ TESTNET USDC</span>
      <span style={{ color: 'var(--mint)', fontWeight: 700, fontSize: 12, minWidth: 80 }}>
        {isLoading ? '…' : `$${bal} USDC`}
      </span>
      <a
        href="https://faucet.circle.com" target="_blank" rel="noreferrer"
        style={{ padding: '5px 14px', background: 'var(--mint)', color: 'var(--black)', fontWeight: 700, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', textDecoration: 'none' }}
      >
        GET TEST USDC (CIRCLE) ↗
      </a>
    </div>
  );
}
