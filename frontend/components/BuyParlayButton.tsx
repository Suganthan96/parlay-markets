'use client';

import { useState } from 'react';
import { useAccount, useConnect, useReadContract } from 'wagmi';
import { parseUnits } from 'viem';
import { useChainId, useSwitchChain } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';
import { useApproveUsdc, useBuyParlayViaAqua, useUsdcAllowance } from '@/lib/hooks';
import { AQUA_PARLAY_ROUTER_ADDRESS, DEFAULT_STRATEGY_HASH, PARLAY_VAULT_ADDRESS, PARLAY_VAULT_ABI } from '@/lib/contracts';
import { useParlayStore } from '@/lib/store';

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
  stakeLabel?:   string;
  onSuccess?:    () => void;
}

const DEFAULT_LP = (process.env.NEXT_PUBLIC_DEPLOYER ?? '0x588F6b3169F60176c1143f8BaB47bCf3DeEbECdc') as `0x${string}`;
const EXPLORER   = 'https://sepolia.etherscan.io/tx/';

export default function BuyParlayButton({
  markets, outcomeIdxs, stakeUsdc, hasOnChain,
  lp = DEFAULT_LP,
  strategyHash = DEFAULT_STRATEGY_HASH,
  legsMeta, stakeLabel, onSuccess,
}: Props) {
  const { address, isConnected } = useAccount();
  const { connectAsync }         = useConnect();
  const chainId                  = useChainId();
  const { switchChainAsync }     = useSwitchChain();
  const [approving,   setApproving]   = useState(false);
  const [approveTx,   setApproveTx]   = useState('');
  const [buyTx,       setBuyTx]       = useState('');
  const [errorMsg,    setErrorMsg]     = useState('');

  const { data: nextTicketIdData } = useReadContract({
    address: PARLAY_VAULT_ADDRESS,
    abi: PARLAY_VAULT_ABI,
    functionName: 'nextTicketId',
  });
  const { legs, saveTicketMeta } = useParlayStore();

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
      // Re-authorize if MetaMask session expired (EIP-1193 error 4100)
      if (!isConnected) {
        await connectAsync({ connector: injected() });
      }
      // Ensure on Sepolia before any tx
      if (chainId !== sepolia.id) {
        await switchChainAsync({ chainId: sepolia.id });
      }
      if (needsApproval) {
        setApproving(true);
        const approveTimeout = setTimeout(() => {
          setApproving(false);
          setErrorMsg('Approval timed out — check MetaMask for a pending popup, then retry.');
        }, 60_000);
        try {
          const hash = await approve(AQUA_PARLAY_ROUTER_ADDRESS, stakeUsdc);
          clearTimeout(approveTimeout);
          if (hash) setApproveTx(hash);
        } finally {
          clearTimeout(approveTimeout);
          setApproving(false);
        }
      }
      const expectedTicketId = nextTicketIdData?.toString() ?? Date.now().toString();
      await buyParlayViaAqua(lp, strategyHash, markets, outcomeIdxs.map(i => BigInt(i)), stakeUsdc);
      if (txHash) setBuyTx(txHash);
      // Save question labels so tickets page can show real market names
      saveTicketMeta(expectedTicketId, {
        txHash: txHash ?? '',
        stake: stakeUsdc,
        timestamp: Date.now(),
        legs: legs.map(l => ({ question: l.marketLabel, outcome: l.outcome, price: l.price })),
      });
      onSuccess?.();
    } catch (e: any) {
      setApproving(false);
      // EIP-1193 error 4100: wallet not authorized — re-trigger connect
      const isAuthError = e?.code === 4100 || e?.details?.includes('authorized') || e?.message?.includes('authorized');
      if (isAuthError) {
        try {
          await connectAsync({ connector: injected() });
          setErrorMsg('Wallet reconnected — please try again.');
        } catch {
          setErrorMsg('Wallet not authorized. Click CONNECT in the nav and try again.');
        }
        return;
      }
      const msg = e?.shortMessage ?? e?.message ?? 'Transaction failed';
      setErrorMsg(msg);
      console.error('Buy parlay via Aqua failed:', e);
    }
  }

  let label = stakeLabel ? stakeLabel.toUpperCase() + ' →' : 'BUY VIA AQUA →';
  if (!isConnected)                  label = 'CONNECT WALLET';
  else if (!hasOnChain)              label = 'ADD ON-CHAIN LEGS';
  else if (stakeUsdc <= 0)           label = 'ENTER STAKE AMOUNT';
  else if (approving || isApproving) label = 'APPROVING USDC…';
  else if (isPending)                label = 'CONFIRM IN WALLET…';
  else if (isConfirming)             label = 'CONFIRMING ON-CHAIN…';
  else if (isSuccess)                label = '✓ TICKET MINTED!';
  else if (needsApproval)            label = (stakeLabel ? stakeLabel.toUpperCase() : 'BUY VIA AQUA') + ' →';

  const latestTx = txHash ?? buyTx;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <button
        onClick={handleClick}
        disabled={disabled || isPending || isConfirming || isApproving || approving}
        style={{
          width: '100%',
          padding: '18px 24px',
          background: isSuccess ? 'var(--mint)' : errorMsg ? '#fee' : disabled ? '#f0f0f0' : 'var(--black)',
          color:      isSuccess ? 'var(--black)' : errorMsg ? '#c00' : disabled ? '#aaa' : 'var(--white)',
          border:     errorMsg ? '1px solid #c00' : '2px solid transparent',
          cursor: disabled || isPending || isConfirming ? 'not-allowed' : 'pointer',
          fontWeight: 800, fontSize: 15, letterSpacing: '0.04em', textTransform: 'uppercase',
          transition: 'background 0.15s',
          borderRadius: 2,
        }}
      >
        {label}
      </button>

      {/* Error */}
      {errorMsg && (
        <div style={{ fontSize: 12, color: '#c00', padding: '10px 14px', background: '#fff5f5', border: '1px solid #fcc', lineHeight: 1.5, borderRadius: 2 }}>
          ✕ {errorMsg.slice(0, 160)}
        </div>
      )}

      {/* Approve tx */}
      {approveTx && (
        <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 8, padding: '10px 14px', background: '#f8f8f8', border: '1px solid var(--border)', fontSize: 12, alignItems: 'center' }}>
          <span style={{ color: '#888', fontWeight: 700 }}>Approve tx</span>
          <a href={`${EXPLORER}${approveTx}`} target="_blank" rel="noreferrer"
            style={{ fontFamily: 'monospace', color: 'var(--black)', textDecoration: 'underline', fontSize: 11 }}>
            {approveTx.slice(0, 14)}…{approveTx.slice(-6)} ↗
          </a>
        </div>
      )}

      {/* Buy tx */}
      {(latestTx || isSuccess) && (
        <div style={{ padding: '12px 14px', background: isSuccess ? 'var(--mint)' : '#f8f8f8', border: `1px solid ${isSuccess ? 'var(--mint)' : 'var(--border)'}`, borderRadius: 2 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: latestTx ? 6 : 0 }}>
            <span style={{ fontWeight: 800, fontSize: 13 }}>
              {isSuccess ? '■ Ticket minted' : '■ Tx submitted'}
            </span>
            {isSuccess && (
              <a href="/tickets" style={{ fontWeight: 700, color: 'var(--black)', textDecoration: 'none', fontSize: 11, letterSpacing: '0.04em' }}>
                VIEW TICKET →
              </a>
            )}
          </div>
          {latestTx && (
            <a href={`${EXPLORER}${latestTx}`} target="_blank" rel="noreferrer"
              style={{ fontFamily: 'monospace', color: 'var(--black)', textDecoration: 'underline', fontSize: 11 }}>
              {latestTx.slice(0, 14)}…{latestTx.slice(-6)} ↗
            </a>
          )}
        </div>
      )}
    </div>
  );
}
