'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { parseUnits } from 'viem';
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
  markets:      `0x${string}`[];
  outcomeIdxs:  number[];
  stakeUsdc:    number;
  hasOnChain:   boolean;
  lp?:          `0x${string}`;          // defaults to deployer (env or hardcoded)
  strategyHash?: `0x${string}`;         // defaults to DEFAULT_STRATEGY_HASH
  legsMeta?:    LegMeta[];
  onSuccess?:   () => void;
}

const DEFAULT_LP = (process.env.NEXT_PUBLIC_DEPLOYER ?? '0x588F6b3169F60176c1143f8BaB47bCf3DeEbECdc') as `0x${string}`;

export default function BuyParlayButton({
  markets, outcomeIdxs, stakeUsdc, hasOnChain,
  lp = DEFAULT_LP,
  strategyHash = DEFAULT_STRATEGY_HASH,
  legsMeta, onSuccess,
}: Props) {
  const { address, isConnected } = useAccount();
  const [approving, setApproving] = useState(false);

  const stakeRaw   = stakeUsdc > 0 ? parseUnits(stakeUsdc.toString(), 6) : 0n;
  const allowance  = useUsdcAllowance(address, AQUA_PARLAY_ROUTER_ADDRESS);
  const needsApproval = stakeRaw > 0n && allowance < stakeRaw;

  const { approve,          isPending: isApproving } = useApproveUsdc();
  const { buyParlayViaAqua, isPending, isConfirming, isSuccess } = useBuyParlayViaAqua();

  const disabled = !isConnected || !hasOnChain || markets.length === 0 || stakeUsdc <= 0;

  async function handleClick() {
    if (disabled) return;
    try {
      if (needsApproval) {
        setApproving(true);
        await approve(AQUA_PARLAY_ROUTER_ADDRESS, stakeUsdc);
        setApproving(false);
      }
      await buyParlayViaAqua(
        lp,
        strategyHash,
        markets,
        outcomeIdxs.map(i => BigInt(i)),
        stakeUsdc,
      );
      if (address && legsMeta) {
        fetch('/api/ticket', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticketId:  0,
            owner:     address,
            stakeUsdc: stakeRaw.toString(),
            payout:    '0',
            legs:      legsMeta,
          }),
        }).catch(console.warn);
      }
      onSuccess?.();
    } catch (e) {
      setApproving(false);
      console.error('Buy parlay via Aqua failed:', e);
    }
  }

  let label = 'BUY VIA AQUA →';
  if (!isConnected)             label = 'CONNECT WALLET';
  else if (!hasOnChain)         label = 'ADD ON-CHAIN LEGS';
  else if (stakeUsdc <= 0)      label = 'ENTER STAKE';
  else if (approving || isApproving) label = 'APPROVING USDC…';
  else if (isPending)           label = 'CONFIRM IN WALLET…';
  else if (isConfirming)        label = 'CONFIRMING TX…';
  else if (isSuccess)           label = '✓ TICKET MINTED!';
  else if (needsApproval)       label = 'APPROVE + BUY VIA AQUA →';

  return (
    <button
      onClick={handleClick}
      disabled={disabled || isPending || isConfirming || isApproving || approving}
      style={{
        flex: 2,
        padding: '14px',
        background: isSuccess ? 'var(--mint)' : disabled ? '#eee' : 'var(--black)',
        color:      isSuccess ? 'var(--black)' : disabled ? '#aaa' : 'var(--white)',
        border: 'none',
        cursor: disabled || isPending || isConfirming ? 'not-allowed' : 'pointer',
        fontWeight: 700,
        fontSize: 11,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        transition: 'background 0.15s',
      }}
    >
      {label}
    </button>
  );
}
