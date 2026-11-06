'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { parseUnits } from 'viem';
import { useChainId, useSwitchChain } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { useApproveUsdc, useBuyParlayViaAqua, useUsdcAllowance } from '@/lib/hooks';
import { AQUA_PARLAY_ROUTER_ADDRESS, DEFAULT_STRATEGY_HASH } from '@/lib/contracts';

interface LegMeta {
  market:  string;
  teamA:   string;
  teamB:   string;
  outcome: 'home' | 'away';
  price:   number;
}

interface Props {
  markets:       `0x${string}`[];
  outcomeIdxs:   number[];
  stakeUsdc:     number;
  hasOnChain:    boolean;
  lp?:           `0x${string}`;
  strategyHash?: `0x${string}`;
  legsMeta?:     LegMeta[];
  onSuccess?:    () => void;
}

const DEFAULT_LP = (process.env.NEXT_PUBLIC_DEPLOYER ?? '0x588F6b3169F60176c1143f8BaB47bCf3DeEbECdc') as `0x${string}`;
const EXPLORER   = 'https://sepolia.etherscan.io/tx/';

export default function BuyParlayButton({
  markets, outcomeIdxs, stakeUsdc, hasOnChain,
  lp = DEFAULT_LP,
  strategyHash = DEFAULT_STRATEGY_HASH,
  legsMeta, onSuccess,
}: Props) {
  const { address, isConnected } = useAccount();
  const chainId                  = useChainId();
  const { switchChainAsync }     = useSwitchChain();
  const [approving,   setApproving]   = useState(false);
  const [approveTx,   setApproveTx]   = useState('');
  const [buyTx,       setBuyTx]       = useState('');
  const [errorMsg,    setErrorMsg]     = useState('');

  const stakeRaw      = stakeUsdc > 0 ? parseUnits(stakeUsdc.toString(), 6) : 0n;
  const allowance     = useUsdcAllowance(address, AQUA_PARLAY_ROUTER_ADDRESS);
  const needsApproval = stakeRaw > 0n && allowance < stakeRaw;

  const { approve,          isPending: isApproving } = useApproveUsdc();
  const { buyParlayViaAqua, isPending, isConfirming, isSuccess, txHash } = useBuyParlayViaAqua();

  const disabled = !isConnected || !hasOnChain || markets.length === 0 || stakeUsdc <= 0;

  async function handleClick() {
    if (disabled) return;
    setErrorMsg('');
    try {
      // Ensure on Sepolia before any tx
      if (chainId !== sepolia.id) {
        await switchChainAsync({ chainId: sepolia.id });
      }
      if (needsApproval) {
        setApproving(true);
        const hash = await approve(AQUA_PARLAY_ROUTER_ADDRESS, stakeUsdc);
        if (hash) setApproveTx(hash);
        setApproving(false);
      }
      await buyParlayViaAqua(lp, strategyHash, markets, outcomeIdxs.map(i => BigInt(i)), stakeUsdc);
      if (txHash) setBuyTx(txHash);
      if (address && legsMeta) {
        fetch('/api/ticket', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticketId: 0, owner: address, stakeUsdc: stakeRaw.toString(), payout: '0', legs: legsMeta }),
        }).catch(console.warn);
      }
      onSuccess?.();
    } catch (e: any) {
      setApproving(false);
      const msg = e?.shortMessage ?? e?.message ?? 'Transaction failed';
      setErrorMsg(msg);
      console.error('Buy parlay via Aqua failed:', e);
    }
  }

  let label = 'BUY VIA AQUA →';
  if (!isConnected)              label = 'CONNECT WALLET';
  else if (!hasOnChain)          label = 'ADD ON-CHAIN LEGS';
  else if (stakeUsdc <= 0)       label = 'ENTER STAKE';
  else if (approving || isApproving) label = 'APPROVING USDC…';
  else if (isPending)            label = 'CONFIRM IN WALLET…';
  else if (isConfirming)         label = 'CONFIRMING ON-CHAIN…';
  else if (isSuccess)            label = '✓ TICKET MINTED!';
  else if (needsApproval)        label = 'APPROVE + BUY VIA AQUA →';

  const latestTx = txHash ?? buyTx;

  return (
    <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button
        onClick={handleClick}
        disabled={disabled || isPending || isConfirming || isApproving || approving}
        style={{
          width: '100%',
          padding: '14px',
          background: isSuccess ? 'var(--mint)' : errorMsg ? '#fee' : disabled ? '#eee' : 'var(--black)',
          color:      isSuccess ? 'var(--black)' : errorMsg ? '#c00' : disabled ? '#aaa' : 'var(--white)',
          border:     errorMsg ? '1px solid #c00' : 'none',
          cursor: disabled || isPending || isConfirming ? 'not-allowed' : 'pointer',
          fontWeight: 700, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase',
          transition: 'background 0.15s',
        }}
      >
        {label}
      </button>

      {/* Error */}
      {errorMsg && (
        <div style={{ fontSize: 10, color: '#c00', padding: '6px 8px', background: '#fee', border: '1px solid #fcc', lineHeight: 1.4 }}>
          ✕ {errorMsg.slice(0, 120)}
        </div>
      )}

      {/* Approve tx */}
      {approveTx && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: '#f5f5f5', fontSize: 10 }}>
          <span style={{ color: '#888' }}>APPROVE TX</span>
          <a href={`${EXPLORER}${approveTx}`} target="_blank" rel="noreferrer"
            style={{ fontFamily: 'monospace', color: 'var(--black)', textDecoration: 'underline', fontSize: 10 }}>
            {approveTx.slice(0, 12)}…{approveTx.slice(-6)} ↗
          </a>
        </div>
      )}

      {/* Buy tx */}
      {(latestTx || isSuccess) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px', background: isSuccess ? 'var(--mint)' : '#f5f5f5', fontSize: 10 }}>
          <span style={{ fontWeight: 700 }}>■ {isSuccess ? 'TICKET MINTED' : 'TX SUBMITTED'}</span>
          {latestTx && (
            <a href={`${EXPLORER}${latestTx}`} target="_blank" rel="noreferrer"
              style={{ fontFamily: 'monospace', color: 'var(--black)', textDecoration: 'underline', fontSize: 10 }}>
              {latestTx.slice(0, 12)}…{latestTx.slice(-6)} ↗
            </a>
          )}
          {isSuccess && <a href="/tickets" style={{ marginLeft: 'auto', fontWeight: 700, color: 'var(--black)', textDecoration: 'none', fontSize: 10 }}>VIEW TICKET →</a>}
        </div>
      )}
    </div>
  );
}
