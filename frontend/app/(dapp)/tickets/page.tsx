'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { useReadContract, useReadContracts } from 'wagmi';
import { formatUnits } from 'viem';
import { PARLAY_VAULT_ABI, PARLAY_VAULT_ADDRESS, LMSR_MARKET_ABI } from '@/lib/contracts';
import { useCashOut, useClaim } from '@/lib/hooks';
import { useParlayStore } from '@/lib/store';
import { useEffect } from 'react';
import { TxLink } from '@/components/ui/TxLink';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(raw: bigint | undefined): string {
  if (raw === undefined) return '—';
  return Number(formatUnits(raw, 6)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const OUTCOME_LABELS = ['HOME WIN', 'AWAY WIN', 'DRAW'];

// ── Leg row ───────────────────────────────────────────────────────────────────

function LegRow({ ticketId, legIdx, ticketWon, ticketLost }: { ticketId: bigint; legIdx: number; ticketWon?: boolean; ticketLost?: boolean }) {
  const ticketMeta = useParlayStore(s => s.ticketMeta);
  const storedLeg  = ticketMeta[ticketId.toString()]?.legs[legIdx];

  const { data } = useReadContracts({
    contracts: [
      { address: PARLAY_VAULT_ADDRESS, abi: PARLAY_VAULT_ABI, functionName: 'ticketLeg', args: [ticketId, legIdx] },
    ],
  });
  const leg        = data?.[0]?.result as [string, bigint, bigint] | undefined;
  const marketAddr = leg?.[0] as `0x${string}` | undefined;
  const outcomeIdx = leg ? Number(leg[1]) : undefined;
  const price      = leg?.[2];

  const { data: names } = useReadContracts({
    contracts: marketAddr ? [
      { address: marketAddr, abi: LMSR_MARKET_ABI, functionName: 'result' },
    ] : [],
    query: { enabled: !!marketAddr },
  });

  const marketResult = Number(names?.[0]?.result ?? 0); // 0=unresolved, 1=home, 2=away, 3=draw

  // Leg win/loss: derive from ticket settlement first, then market result
  let legStatus: 'live' | 'won' | 'lost' = 'live';
  if (ticketWon) {
    legStatus = 'won'; // ticket won = all legs won
  } else if (ticketLost && marketResult !== 0 && outcomeIdx !== undefined) {
    legStatus = (marketResult - 1) === outcomeIdx ? 'won' : 'lost';
  } else if (ticketLost) {
    legStatus = 'lost'; // ticket lost but can't pinpoint which leg — mark all lost
  } else if (marketResult !== 0 && outcomeIdx !== undefined) {
    legStatus = (marketResult - 1) === outcomeIdx ? 'won' : 'lost';
  }

  // Picked team label — only use on-chain names if stored leg data confirms them
  let pickedLabel: string;
  if (storedLeg) {
    pickedLabel = storedLeg.question;
  } else if (marketAddr) {
    pickedLabel = `${marketAddr.slice(0, 6)}…${marketAddr.slice(-4)}`;
  } else {
    pickedLabel = '…';
  }

  // Match label — only show if stored leg has the real question
  const matchLabel = storedLeg ? null : null;
  const outcomeLabel = storedLeg ? '' : outcomeIdx !== undefined ? (OUTCOME_LABELS[outcomeIdx] ?? '') : '';
  const priceDisplay = storedLeg ? storedLeg.price.toFixed(2) : (price ? (Number(price) / 1e18).toFixed(2) : '?');

  const bg     = legStatus === 'won' ? '#f0fdf4' : legStatus === 'lost' ? '#fff1f0' : 'var(--white)';
  const accent = legStatus === 'won' ? '#16a34a' : legStatus === 'lost' ? '#dc2626' : '#888';
  const icon   = legStatus === 'won' ? '✓' : legStatus === 'lost' ? '✕' : '◌';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--border)', background: bg }}>
      {/* Status icon */}
      <div style={{ width: 28, height: 28, borderRadius: '50%', background: legStatus === 'live' ? '#f4f4f4' : bg, border: `2px solid ${accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: accent }}>{icon}</span>
      </div>

      {/* Match + pick */}
      <div style={{ flex: 1 }}>
        {matchLabel && (
          <div style={{ fontSize: 10, color: '#888', marginBottom: 2, fontFamily: 'var(--font-mono, monospace)', letterSpacing: '0.04em' }}>
            {matchLabel}
          </div>
        )}
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.02em' }}>
          {pickedLabel}
          {!storedLeg && outcomeLabel && (
            <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 500, color: '#888' }}>{outcomeLabel}</span>
          )}
        </div>
      </div>

      {/* Price + resolved outcome */}
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: accent }}>
          {legStatus === 'won' ? 'WON' : legStatus === 'lost' ? 'LOST' : 'PENDING'}
        </div>
        <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>× {priceDisplay}</div>
      </div>
    </div>
  );
}

// ── Ticket card ───────────────────────────────────────────────────────────────

function TicketCard({ ticketId }: { ticketId: bigint }) {
  const { data } = useReadContracts({
    contracts: [
      { address: PARLAY_VAULT_ADDRESS, abi: PARLAY_VAULT_ABI, functionName: 'ticketStake',    args: [ticketId] },
      { address: PARLAY_VAULT_ADDRESS, abi: PARLAY_VAULT_ABI, functionName: 'ticketPayout',   args: [ticketId] },
      { address: PARLAY_VAULT_ADDRESS, abi: PARLAY_VAULT_ABI, functionName: 'ticketSettled',  args: [ticketId] },
      { address: PARLAY_VAULT_ADDRESS, abi: PARLAY_VAULT_ABI, functionName: 'ticketLegCount', args: [ticketId] },
    ],
    query: { refetchInterval: 15_000 },
  });

  const stake    = data?.[0]?.result as bigint | undefined;
  const payout   = data?.[1]?.result as bigint | undefined;
  const settled  = data?.[2]?.result as boolean | undefined;
  const legCount = Number(data?.[3]?.result ?? 0);

  const { cashOut, isPending: isCashingOut, isSuccess: cashOutSuccess, txHash: cashOutTx } = useCashOut();
  const { claim,   isPending: isClaiming,  isSuccess: claimed,        txHash: claimTx    } = useClaim();
  const { markCashedOut, isCashedOut } = useParlayStore();

  const ticketKey   = ticketId.toString();
  const wasEarlyOut = isCashedOut(ticketKey) || cashOutSuccess;

  // Persist cashed-out state to store when tx succeeds
  useEffect(() => { if (cashOutSuccess) markCashedOut(ticketKey); }, [cashOutSuccess]);

  const isWon  = settled === true && payout !== undefined && payout > 0n && !wasEarlyOut;
  const isLost = settled === true && (!payout || payout === 0n);
  const isLive = (settled === false || settled === undefined) && !wasEarlyOut;

  const statusLabel = wasEarlyOut ? '↩ CASHED OUT' : isWon ? '✓ WON' : isLost ? '✕ LOST' : '● LIVE';
  const statusColor = wasEarlyOut ? '#888'          : isWon ? '#16a34a' : isLost ? '#dc2626' : 'var(--mint)';
  const headerBg    = wasEarlyOut ? '#f8f8f8'       : isWon ? '#f0fdf4' : isLost ? '#fff1f0' : 'var(--white)';

  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: '14px 20px', background: headerBg, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="text-label" style={{ fontSize: 11, fontWeight: 800 }}>TICKET #{ticketId.toString()}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: statusColor, letterSpacing: '0.06em' }}>{statusLabel}</span>
          {legCount > 0 && (
            <span style={{ fontSize: 9, color: '#aaa', letterSpacing: '0.06em' }}>{legCount}-LEG PARLAY</span>
          )}
        </div>
      </div>

      {/* Legs */}
      <div>
        {Array.from({ length: legCount }, (_, i) => (
          <LegRow key={i} ticketId={ticketId} legIdx={i} ticketWon={isWon} ticketLost={isLost || wasEarlyOut} />
        ))}
        {legCount === 0 && (
          <div style={{ padding: '20px', color: '#bbb', fontSize: 10 }}>LOADING LEGS…</div>
        )}
      </div>

      {/* Financials */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '1px solid var(--border)' }}>
        <div style={{ padding: '16px 20px', borderRight: '1px solid var(--border)' }}>
          <span className="text-label" style={{ display: 'block', marginBottom: 6, fontSize: 9, color: '#888' }}>■ STAKE</span>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em' }}>${fmt(stake)}</div>
        </div>
        <div style={{ padding: '16px 20px', background: isWon ? '#f0fdf4' : 'transparent' }}>
          <span className="text-label" style={{ display: 'block', marginBottom: 6, fontSize: 9, color: isWon ? '#16a34a' : '#888' }}>
            ■ {isWon ? 'PAYOUT' : isLost ? 'LOST' : 'IF ALL WIN'}
          </span>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', color: isWon ? '#16a34a' : isLost ? '#dc2626' : 'var(--black)' }}>
            {isLost ? '—' : `$${fmt(payout)}`}
          </div>
        </div>
      </div>

      {/* Action */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'center' }}>
        {isLive && !wasEarlyOut && (
          <button
            onClick={() => cashOut(ticketId)}
            disabled={isCashingOut}
            style={{ flex: 1, padding: '14px', background: 'var(--black)', color: 'var(--white)', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}
          >
            {isCashingOut ? 'CONFIRMING…' : 'CASH OUT EARLY →'}
          </button>
        )}
        {wasEarlyOut && (
          <div style={{ flex: 1, display: 'flex', gap: 10, alignItems: 'center', padding: '14px', background: '#f8f8f8' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#888' }}>↩ CASHED OUT EARLY</span>
            {cashOutTx && <TxLink hash={cashOutTx} />}
          </div>
        )}
        {isWon && !claimed && !wasEarlyOut && (
          <button
            onClick={() => claim(ticketId)}
            disabled={isClaiming}
            style={{ flex: 1, padding: '16px', background: '#16a34a', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 13, letterSpacing: '0.06em', textTransform: 'uppercase' }}
          >
            {isClaiming ? 'CLAIMING…' : `CLAIM $${fmt(payout)} →`}
          </button>
        )}
        {claimed && (
          <div style={{ flex: 1, display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a' }}>✓ CLAIMED — FUNDS IN YOUR WALLET</span>
            {claimTx && <TxLink hash={claimTx} />}
          </div>
        )}
        {isLost && !wasEarlyOut && (
          <div style={{ flex: 1, padding: '14px', background: '#fff1f0', textAlign: 'center' }}>
            <span className="text-label" style={{ fontSize: 10, color: '#dc2626' }}>✕ PARLAY LOST — BETTER LUCK NEXT TIME</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function TicketsPage() {
  const { address, isConnected } = useAccount();

  const { data: nextId } = useReadContract({
    address: PARLAY_VAULT_ADDRESS,
    abi: PARLAY_VAULT_ABI,
    functionName: 'nextTicketId',
    query: { refetchInterval: 15_000 },
  });
  const total = Number(nextId ?? 0);

  const ownerCalls = Array.from({ length: total }, (_, i) => ({
    address: PARLAY_VAULT_ADDRESS as `0x${string}`,
    abi: PARLAY_VAULT_ABI,
    functionName: 'ticketOwner' as const,
    args: [BigInt(i)] as [bigint],
  }));
  const { data: owners } = useReadContracts({ contracts: ownerCalls, query: { enabled: total > 0 } });

  const myTicketIds: bigint[] = isConnected && address && owners
    ? owners
        .map((r, i) => ({ owner: r.result as string | undefined, id: BigInt(i) }))
        .filter(({ owner }) => owner?.toLowerCase() === address.toLowerCase())
        .map(({ id }) => id)
    : [];

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>
      {/* Headline */}
      <div style={{ background: 'var(--black)', padding: 'clamp(32px,5vw,72px) clamp(24px,4vw,56px)', borderBottom: '1px solid var(--border)' }}>
        <p className="text-label" style={{ color: '#555', marginBottom: 16, fontSize: 10 }}>■ MY TICKETS · PARLAYVAULT ON-CHAIN</p>
        <h1 className="text-display" style={{ color: 'var(--white)', fontSize: 'clamp(56px,9vw,140px)' }}>CASH OUT<br/>LIVE.</h1>
      </div>

      {/* Stat bar */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', borderBottom: '1px solid var(--border)', background: 'var(--white)' }}>
        <div style={{ padding: '16px 24px', borderRight: '1px solid var(--border)' }}>
          <span className="text-label" style={{ display: 'block', fontSize: 9, color: '#aaa', marginBottom: 4 }}>■ TOTAL TICKETS</span>
          <span style={{ fontWeight: 800, fontSize: 22 }}>{total}</span>
        </div>
        <div style={{ padding: '16px 24px', borderRight: '1px solid var(--border)' }}>
          <span className="text-label" style={{ display: 'block', fontSize: 9, color: '#aaa', marginBottom: 4 }}>■ MY TICKETS</span>
          <span style={{ fontWeight: 800, fontSize: 22 }}>{myTicketIds.length}</span>
        </div>
        <div style={{ padding: '16px 24px' }}>
          <span className="text-label" style={{ display: 'block', fontSize: 9, color: '#aaa', marginBottom: 4 }}>■ VAULT CONTRACT</span>
          <span style={{ fontWeight: 700, fontSize: 11, fontFamily: 'monospace' }}>{PARLAY_VAULT_ADDRESS}</span>
        </div>
      </div>

      {/* Ticket list */}
      <div style={{ padding: 1, display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--border)' }}>
        {!isConnected ? (
          <div style={{ background: 'var(--white)', padding: 48, textAlign: 'center' }}>
            <span className="text-label" style={{ fontSize: 10, color: '#aaa' }}>CONNECT YOUR WALLET TO SEE TICKETS.</span>
          </div>
        ) : total === 0 ? (
          <div style={{ background: 'var(--white)', padding: 48, textAlign: 'center' }}>
            <span className="text-label" style={{ fontSize: 10, color: '#aaa' }}>NO TICKETS MINTED YET.</span>
          </div>
        ) : myTicketIds.length === 0 ? (
          <div style={{ background: 'var(--white)', padding: 48, textAlign: 'center' }}>
            <span className="text-label" style={{ fontSize: 10, color: '#aaa' }}>YOU HAVE NO TICKETS. BUY A PARLAY FIRST.</span>
          </div>
        ) : myTicketIds.map(id => (
          <TicketCard key={id.toString()} ticketId={id} />
        ))}
      </div>
    </div>
  );
}
