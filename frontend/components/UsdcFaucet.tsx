'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { useMintUsdc, useUsdcBalance } from '@/lib/hooks';

export default function UsdcFaucet() {
  const { address, isConnected } = useAccount();
  const [amount, setAmount]      = useState('1000');
  const [done, setDone]          = useState(false);

  const { mint, isPending }         = useMintUsdc();
  const { formatted: bal, isLoading } = useUsdcBalance(address);

  if (!isConnected) return null;

  async function handleMint() {
    if (!address) return;
    await mint(address, parseFloat(amount) || 1000);
    setDone(true);
    setTimeout(() => setDone(false), 4000);
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 24px', background: '#1a1a1a', borderTop: '1px solid #333' }}>
      <span className="text-label" style={{ fontSize: 9, color: '#666', flexShrink: 0 }}>■ DEVNET FAUCET</span>
      <span style={{ color: 'var(--mint)', fontWeight: 700, fontSize: 12, minWidth: 80 }}>
        {isLoading ? '…' : `$${bal} USDC`}
      </span>
      <input
        type="number" value={amount} onChange={e => setAmount(e.target.value)} min="1"
        style={{ width: 80, background: '#333', border: '1px solid #444', color: '#fff', padding: '4px 8px', fontSize: 12, outline: 'none', fontFamily: 'inherit' }}
      />
      <button
        onClick={handleMint}
        disabled={isPending || done}
        style={{ padding: '5px 14px', background: done ? '#555' : 'var(--mint)', color: 'var(--black)', border: 'none', cursor: isPending ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}
      >
        {done ? '✓ MINTED' : isPending ? 'MINTING…' : 'MINT →'}
      </button>
    </div>
  );
}
