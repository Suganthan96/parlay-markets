'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { useReadContract, useReadContracts } from 'wagmi';
import { formatUnits } from 'viem';
import { PARLAY_VAULT_ABI, PARLAY_VAULT_ADDRESS, LMSR_MARKET_ABI } from '@/lib/contracts';
import { useCashOut, useClaim } from '@/lib/hooks';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(raw: bigint | undefined): string {
  if (raw === undefined) return '—';
  return Number(formatUnits(raw, 6)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Leg row ───────────────────────────────────────────────────────────────────

function LegRow({ ticketId, legIdx }: { ticketId: bigint; legIdx: number }) {
  const { data } = useReadContracts({
    contracts: [
      { address: PARLAY_VAULT_ADDRESS, abi: PARLAY_VAULT_ABI, functionName: 'ticketLeg', args: [ticketId, legIdx] },
    ],
  });
  const leg = data?.[0]?.result as [string, bigint, bigint] | undefined;
  const marketAddr = leg?.[0] as `0x${string}` | undefined;
  const outcomeIdx = leg?.[1];
  const price      = leg?.[2];

  const { data: names } = useReadContracts({
    contracts: marketAddr ? [
      { address: marketAddr, abi: LMSR_MARKET_ABI, functionName: 'homeTeam' },
      { address: marketAddr, abi: LMSR_MARKET_ABI, functionName: 'awayTeam' },
      { address: marketAddr, abi: LMSR_MARKET_ABI, functionName: 'result'   },
    ] : [],
    query: { enabled: !!marketAddr },
  });

  const homeTeam   = names?.[0]?.result as string | undefined;
  const awayTeam   = names?.[1]?.result as string | undefined;
  const marketResult = Number(names?.[2]?.result ?? 0); // 0=unresolved, 1=home, 2=away, 3=draw

  const pickedHome = Number(outcomeIdx ?? 0) === 0;
  const pickedTeam = pickedHome ? homeTeam : awayTeam;
  const matchLabel = homeTeam && awayTeam ? `${homeTeam} vs ${awayTeam}` : marketAddr?.slice(0, 10) + '…';

  // Determine leg outcome
  let legStatus: 'live' | 'won' | 'lost' = 'live';
  if (marketResult !== 0) {
    const wonOutcome = marketResult - 1; // 0=home, 1=away
    legStatus = wonOutcome === Number(outcomeIdx ?? 0) ? 'won' : 'lost';
  }

  const bg     = legStatus === 'won' ? 'var(--mint)' : legStatus === 'lost' ? '#fee' : 'var(--light-gray, #f4f4f4)';
  const border = legStatus === 'lost' ? '1px solid #FF5A4E' : '1px solid var(--border)';
  const col    = legStatus === 'lost' ? '#FF5A4E' : 'var(--black)';

  return (
    <span style={{ padding: '3px 10px', background: bg, border, color: col, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'inline-block' }}>
      {legStatus === 'won' ? '✓' : legStatus === 'lost' ? '✕' : '●'}{' '}
      {pickedTeam ?? '?'} · {matchLabel} · {price ? (Number(price) / 1e18).toFixed(2) : '?'}
    </span>
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
  });

  const stake    = data?.[0]?.result as bigint | undefined;
  const payout   = data?.[1]?.result as bigint | undefined;
  const settled  = data?.[2]?.result as boolean | undefined;
  const legCount = Number(data?.[3]?.result ?? 0);

  const { cashOut, isPending: isCashingOut, isSuccess: cashedOut } = useCashOut();
  const { claim,   isPending: isClaiming,  isSuccess: claimed    } = useClaim();

  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)' }}>
      <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="text-label" style={{ fontSize: 10 }}>■ TICKET #{ticketId.toString()}</span>
        <span className="text-label" style={{ fontSize: 9, color: settled ? '#aaa' : 'var(--mint)' }}>
          {settled ? 'SETTLED' : '● LIVE'}
        </span>
      </div>

      {/* Legs */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {Array.from({ length: legCount }, (_, i) => (
          <LegRow key={i} ticketId={ticketId} legIdx={i} />
        ))}
        {legCount === 0 && <span className="text-label" style={{ fontSize: 10, color: '#bbb' }}>LOADING LEGS…</span>}
      </div>

      {/* Financials */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid var(--border)' }}>
        <div style={{ padding: '16px 20px', borderRight: '1px solid var(--border)' }}>
          <span className="text-label" style={{ display: 'block', marginBottom: 6, fontSize: 10 }}>■ STAKE</span>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>${fmt(stake)}</div>
        </div>
        <div style={{ padding: '16px 20px' }}>
          <span className="text-label" style={{ display: 'block', marginBottom: 6, fontSize: 10 }}>■ IF WIN</span>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>${fmt(payout)}</div>
        </div>
      </div>

      {/* Action */}
      <div style={{ padding: '16px 20px' }}>
        {settled === false && (
          <button
            onClick={() => cashOut(ticketId)}
            disabled={isCashingOut || cashedOut}
            style={{ width: '100%', padding: '14px', background: cashedOut ? 'var(--mint)' : 'var(--black)', color: cashedOut ? 'var(--black)' : 'var(--white)', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}
          >
            {cashedOut ? '✓ CASHED OUT' : isCashingOut ? 'CONFIRMING…' : 'CASH OUT NOW →'}
          </button>
        )}
        {settled === true && payout && payout > 0n && (
          <button
            onClick={() => claim(ticketId)}
            disabled={isClaiming || claimed}
            style={{ width: '100%', padding: '14px', background: claimed ? '#eee' : 'var(--mint)', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}
          >
            {claimed ? '✓ CLAIMED' : isClaiming ? 'CLAIMING…' : `CLAIM $${fmt(payout)} →`}
          </button>
        )}
        {settled === true && (!payout || payout === 0n) && (
          <span className="text-label" style={{ fontSize: 10, color: '#FF5A4E' }}>■ TICKET LOST — PARLAY DID NOT HIT</span>
        )}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function TicketsPage() {
  const { address, isConnected } = useAccount();

  // Read total ticket count
  const { data: nextId } = useReadContract({
    address: PARLAY_VAULT_ADDRESS,
    abi: PARLAY_VAULT_ABI,
    functionName: 'nextTicketId',
    query: { refetchInterval: 15_000 },
  });
  const total = Number(nextId ?? 0);

  // Multicall: ticketOwner for every ticket id
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
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--white)' }}>
        <div style={{ padding: '16px 24px', borderRight: '1px solid var(--border)', flex: 1 }}>
          <span className="text-label" style={{ display: 'block', fontSize: 9, color: '#aaa', marginBottom: 4 }}>■ TOTAL TICKETS</span>
          <span style={{ fontWeight: 800, fontSize: 22 }}>{total}</span>
        </div>
        <div style={{ padding: '16px 24px', borderRight: '1px solid var(--border)', flex: 1 }}>
          <span className="text-label" style={{ display: 'block', fontSize: 9, color: '#aaa', marginBottom: 4 }}>■ MY TICKETS</span>
          <span style={{ fontWeight: 800, fontSize: 22 }}>{myTicketIds.length}</span>
        </div>
        <div style={{ padding: '16px 24px', flex: 2 }}>
          <span className="text-label" style={{ display: 'block', fontSize: 9, color: '#aaa', marginBottom: 4 }}>■ VAULT</span>
          <span style={{ fontWeight: 700, fontSize: 11, fontFamily: 'monospace' }}>{PARLAY_VAULT_ADDRESS}</span>
        </div>
      </div>

      {/* Ticket grid */}
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
