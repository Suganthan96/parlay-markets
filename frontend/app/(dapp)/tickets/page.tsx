'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useReadContract, useReadContracts, useSimulateContract } from 'wagmi';
import { formatUnits } from 'viem';
import { PARLAY_VAULT_ABI, PARLAY_VAULT_ADDRESS, LMSR_MARKET_ABI, MARKET_RESOLVER_ABI, MARKET_RESOLVER_ADDRESS, MARKET_ADDRESSES } from '@/lib/contracts';
import { useCashOut, useClaim, useResolveMarket } from '@/lib/hooks';
import { useParlayStore } from '@/lib/store';
import { TxLink } from '@/components/ui/TxLink';

function fmt(raw: bigint | undefined): string {
  if (raw === undefined) return '—';
  return Number(formatUnits(raw, 6)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const OUTCOME_LABELS = ['HOME WIN', 'AWAY WIN', 'DRAW'];

// ── Leg row ───────────────────────────────────────────────────────────────────

function LegRow({ ticketId, legIdx, ticketWon, ticketLost }: {
  ticketId: bigint; legIdx: number; ticketWon: boolean; ticketLost: boolean;
}) {
  const ticketMeta = useParlayStore(s => s.ticketMeta);
  const storedLeg  = ticketMeta[ticketId.toString()]?.legs[legIdx];

  const { data } = useReadContracts({
    contracts: [
      { chainId: 11155111, address: PARLAY_VAULT_ADDRESS, abi: PARLAY_VAULT_ABI, functionName: 'ticketLeg', args: [ticketId, legIdx] },
    ],
  });
  const leg        = data?.[0]?.result as [string, bigint, bigint] | undefined;
  const marketAddr = leg?.[0] as `0x${string}` | undefined;
  const outcomeIdx = leg ? Number(leg[1]) : undefined;
  const price      = leg?.[2];

  // Leg status derives ONLY from vault settlement — never from raw market result
  // (market result can be non-zero for test markets without the ticket being settled)
  const legStatus: 'live' | 'won' | 'lost' =
    ticketWon ? 'won' : ticketLost ? 'lost' : 'live';

  const label: string = storedLeg
    ? `${storedLeg.question}${storedLeg.outcome ? ` · ${storedLeg.outcome}` : ''}`
    : marketAddr
      ? `${marketAddr.slice(0, 8)}…${marketAddr.slice(-6)}  ${outcomeIdx !== undefined ? (OUTCOME_LABELS[outcomeIdx] ?? '') : ''}`
      : '…';

  const priceDisplay = storedLeg
    ? storedLeg.price.toFixed(2)
    : price ? (Number(price) / 1e18).toFixed(2) : '?';

  const accent = legStatus === 'won' ? '#16a34a' : legStatus === 'lost' ? '#dc2626' : '#999';
  const bg     = legStatus === 'won' ? '#f0fdf4' : legStatus === 'lost' ? '#fff5f5' : 'var(--white)';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', borderBottom: '1px solid var(--border)', background: bg }}>
      <span style={{ fontSize: 14, color: accent, minWidth: 16, textAlign: 'center' }}>
        {legStatus === 'won' ? '✓' : legStatus === 'lost' ? '✕' : '◌'}
      </span>
      <div style={{ flex: 1, fontSize: 12, fontWeight: 600, color: legStatus === 'live' ? '#333' : accent, lineHeight: 1.3 }}>
        {label}
      </div>
      <div style={{ textAlign: 'right', fontSize: 11, color: accent, fontWeight: 700, letterSpacing: '0.04em' }}>
        {legStatus === 'won' ? '✓ WON' : legStatus === 'lost' ? '✕ LOST' : 'PENDING'}
        <div style={{ color: '#aaa', fontWeight: 400, fontSize: 10, marginTop: 1 }}>×{priceDisplay}</div>
      </div>
    </div>
  );
}

// ── Ticket card (collapsible) ─────────────────────────────────────────────────

function TicketCard({ ticketId }: { ticketId: bigint }) {
  const { data, refetch } = useReadContracts({
    contracts: [
      { chainId: 11155111, address: PARLAY_VAULT_ADDRESS, abi: PARLAY_VAULT_ABI, functionName: 'ticketStake',    args: [ticketId] },
      { chainId: 11155111, address: PARLAY_VAULT_ADDRESS, abi: PARLAY_VAULT_ABI, functionName: 'ticketPayout',   args: [ticketId] },
      { chainId: 11155111, address: PARLAY_VAULT_ADDRESS, abi: PARLAY_VAULT_ABI, functionName: 'ticketSettled',  args: [ticketId] },
      { chainId: 11155111, address: PARLAY_VAULT_ADDRESS, abi: PARLAY_VAULT_ABI, functionName: 'ticketLegCount', args: [ticketId] },
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

  useEffect(() => { if (cashOutSuccess) markCashedOut(ticketKey); }, [cashOutSuccess]);

  // Always simulate claim — this is the only reliable way to know if all legs resolved+won.
  // settled=true means cashedOut||claimed (AFTER the fact), so we can't use it to show CLAIM.
  const { data: claimSim, error: claimSimErr } = useSimulateContract({
    address: PARLAY_VAULT_ADDRESS,
    abi: PARLAY_VAULT_ABI,
    functionName: 'claim',
    args: [ticketId],
    query: { enabled: !wasEarlyOut && !claimed },
  });

  const claimErrMsg = (claimSimErr as any)?.shortMessage ?? (claimSimErr as any)?.message ?? '';

  // isWon: claim simulation passes → all legs resolved and all won
  const isWon  = !!claimSim && !claimSimErr && payout !== undefined && payout > 0n;
  // isLost: sim fails with "leg lost" or vault says settled but we can't claim (already closed)
  const isLost = !isWon && !wasEarlyOut && !claimed &&
    (claimErrMsg.includes('leg lost') || (settled === true && !!claimSimErr));
  const isLive = !isWon && !isLost && !wasEarlyOut && !claimed;
  const wasSettledNotWon = settled === true && !wasEarlyOut && !claimed && !isWon;

  const statusLabel = wasEarlyOut || wasSettledNotWon ? '↩ SETTLED' : isWon ? '✓ WON' : isLost ? '✕ LOST' : '● LIVE';
  const statusColor = wasEarlyOut || wasSettledNotWon ? '#888' : isWon ? '#16a34a' : isLost ? '#dc2626' : '#00b894';
  const headerBg    = isWon ? '#f0fdf4' : isLost ? '#fff5f5' : (wasEarlyOut || wasSettledNotWon) ? '#fafafa' : 'var(--white)';

  const [expanded, setExpanded] = useState(true);

  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', overflow: 'hidden' }}>

      {/* Compact header row — always visible, click to toggle */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          padding: '12px 20px', background: headerBg, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 12,
          borderBottom: expanded ? '1px solid var(--border)' : 'none',
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', minWidth: 80 }}>
          TICKET #{ticketKey}
        </span>
        <span style={{ fontSize: 11, fontWeight: 800, color: statusColor, letterSpacing: '0.05em', flex: 1 }}>
          {statusLabel}
        </span>
        {legCount > 0 && (
          <span style={{ fontSize: 9, color: '#aaa', letterSpacing: '0.06em' }}>{legCount}-LEG</span>
        )}
        <span style={{ fontSize: 11, fontWeight: 700, color: '#333' }}>
          ${fmt(stake)}
        </span>
        {isWon && (
          <span style={{ fontSize: 11, fontWeight: 800, color: '#16a34a' }}>→ ${fmt(payout)}</span>
        )}
        <span style={{ fontSize: 14, color: '#ccc', marginLeft: 4 }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {/* Expandable body */}
      {expanded && (
        <>
          {/* Legs */}
          <div>
            {Array.from({ length: legCount }, (_, i) => (
              <LegRow key={i} ticketId={ticketId} legIdx={i} ticketWon={isWon} ticketLost={isLost || wasEarlyOut} />
            ))}
            {legCount === 0 && (
              <div style={{ padding: '16px 20px', color: '#ccc', fontSize: 10 }}>LOADING…</div>
            )}
          </div>

          {/* Financials */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '1px solid var(--border)' }}>
            <div style={{ padding: '14px 20px', borderRight: '1px solid var(--border)' }}>
              <span className="text-label" style={{ display: 'block', marginBottom: 4, fontSize: 9, color: '#aaa' }}>■ STAKE</span>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em' }}>${fmt(stake)}</div>
            </div>
            <div style={{ padding: '14px 20px', background: isWon ? '#f0fdf4' : 'transparent' }}>
              <span className="text-label" style={{ display: 'block', marginBottom: 4, fontSize: 9, color: isWon ? '#16a34a' : '#aaa' }}>
                ■ {isWon ? 'PAYOUT' : isLost ? 'LOST' : 'IF ALL WIN'}
              </span>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', color: isWon ? '#16a34a' : isLost ? '#dc2626' : 'var(--black)' }}>
                {isLost ? '—' : `$${fmt(payout)}`}
              </div>
            </div>
          </div>

          {/* Action button */}
          <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'center' }}>
            {isLive && (
              <button
                onClick={e => { e.stopPropagation(); cashOut(ticketId); }}
                disabled={isCashingOut}
                style={{ flex: 1, padding: '13px', background: 'var(--black)', color: 'var(--white)', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}
              >
                {isCashingOut ? 'CONFIRMING…' : 'CASH OUT EARLY →'}
              </button>
            )}
            {wasEarlyOut && (
              <div style={{ flex: 1, display: 'flex', gap: 10, alignItems: 'center', padding: '13px', background: '#fafafa' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#888' }}>↩ CASHED OUT EARLY</span>
                {cashOutTx && <TxLink hash={cashOutTx} />}
              </div>
            )}
            {isWon && !claimed && (
              <button
                onClick={e => { e.stopPropagation(); claim(ticketId); }}
                disabled={isClaiming}
                style={{ flex: 1, padding: '14px', background: '#16a34a', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 13, letterSpacing: '0.06em', textTransform: 'uppercase' }}
              >
                {isClaiming ? 'CLAIMING…' : 'CLAIM →'}
              </button>
            )}
            {claimed && (
              <div style={{ flex: 1, display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a' }}>✓ CLAIMED — FUNDS IN YOUR WALLET</span>
                {claimTx && <TxLink hash={claimTx} />}
              </div>
            )}
            {isLost && !wasSettledNotWon && (
              <div style={{ flex: 1, padding: '13px', background: '#fff5f5', textAlign: 'center' }}>
                <span className="text-label" style={{ fontSize: 10, color: '#dc2626' }}>✕ PARLAY LOST — BETTER LUCK NEXT TIME</span>
              </div>
            )}
            {wasSettledNotWon && (
              <div style={{ flex: 1, padding: '13px', background: '#fafafa', textAlign: 'center' }}>
                <span className="text-label" style={{ fontSize: 10, color: '#888' }}>↩ ALREADY SETTLED — FUNDS WERE PREVIOUSLY WITHDRAWN</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Owner: Resolve Market panel ───────────────────────────────────────────────

const DEPLOYER = (process.env.NEXT_PUBLIC_DEPLOYER ?? '').toLowerCase();

function MarketCard({ addr, index, isPending, done, onResolve }: {
  addr: `0x${string}`; index: number; isPending: boolean;
  done: Record<string, number>; onResolve: (addr: `0x${string}`, result: 1|2|3) => void;
}) {
  const { data } = useReadContracts({
    contracts: [
      { chainId: 11155111, address: addr, abi: LMSR_MARKET_ABI, functionName: 'homeTeam' },
      { chainId: 11155111, address: addr, abi: LMSR_MARKET_ABI, functionName: 'awayTeam' },
    ],
  });
  const homeTeam = data?.[0]?.result as string | undefined;
  const awayTeam = data?.[1]?.result as string | undefined;
  const label = homeTeam && awayTeam ? `${homeTeam} vs ${awayTeam}` : addr.slice(0, 10) + '…';

  return (
    <div style={{ background: '#fff', border: '1px solid #fcd34d', padding: '12px 16px', minWidth: 260 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#78350f', marginBottom: 8 }}>
        MARKET {index + 1} · {label}
      </div>
      <div style={{ fontSize: 9, fontFamily: 'monospace', color: '#aaa', marginBottom: 10 }}>{addr}</div>
      {done[addr] ? (
        <div style={{ fontSize: 10, color: '#16a34a', fontWeight: 700 }}>
          ✓ RESOLVED → {done[addr] === 1 ? 'HOME WIN' : done[addr] === 2 ? 'AWAY WIN' : 'DRAW'}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8 }}>
          {(['HOME WIN', 'AWAY WIN', 'DRAW'] as const).map((lbl, ri) => (
            <button
              key={lbl}
              disabled={isPending}
              onClick={() => onResolve(addr, (ri + 1) as 1|2|3)}
              style={{ flex: 1, padding: '8px 4px', fontSize: 9, fontWeight: 800, letterSpacing: '0.05em', background: '#78350f', color: '#fff', border: 'none', cursor: 'pointer', textTransform: 'uppercase' }}
            >
              {isPending ? '…' : lbl}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ResolvePanel() {
  const { address } = useAccount();
  const { resolveMarket, isPending } = useResolveMarket();
  const [done, setDone] = useState<Record<string, number>>({});

  if (!address || address.toLowerCase() !== DEPLOYER) return null;

  return (
    <div style={{ gridColumn: '1 / -1', border: '2px solid #f59e0b', background: '#fffbeb', padding: 20, marginBottom: 8 }}>
      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', color: '#92400e', marginBottom: 12 }}>
        ■ OWNER — RESOLVE MARKETS (CHAINLINK CRE DEMO TRIGGER)
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        {MARKET_ADDRESSES.map((addr, i) => (
          <MarketCard
            key={addr}
            addr={addr as `0x${string}`}
            index={i}
            isPending={isPending}
            done={done}
            onResolve={(a, r) => resolveMarket(a, r).then(() => setDone(d => ({ ...d, [a]: r })))}
          />
        ))}
      </div>
      <div style={{ marginTop: 10, fontSize: 9, color: '#92400e' }}>
        After resolving, winners will see a green CLAIM → button on their tickets within 15s.
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function TicketsPage() {
  const { address, isConnected } = useAccount();

  const { data: nextId } = useReadContract({
    chainId: 11155111,
    address: PARLAY_VAULT_ADDRESS,
    abi: PARLAY_VAULT_ABI,
    functionName: 'nextTicketId',
    query: { refetchInterval: 15_000 },
  });
  const total = Math.max(Number(nextId ?? 1n) - 1, 0); // ticket ids start at 1

  const ownerCalls = Array.from({ length: total }, (_, i) => ({
    chainId: 11155111 as const,
    address: PARLAY_VAULT_ADDRESS as `0x${string}`,
    abi: PARLAY_VAULT_ABI,
    functionName: 'ticketOwner' as const,
    args: [BigInt(i + 1)] as [bigint],
  }));
  const { data: owners } = useReadContracts({ contracts: ownerCalls, query: { enabled: total > 0 } });

  const myTicketIds: bigint[] = isConnected && address && owners
    ? owners
        .map((r, i) => ({ owner: r.result as string | undefined, id: BigInt(i + 1) }))
        .filter(({ owner }) => owner?.toLowerCase() === address.toLowerCase())
        .map(({ id }) => id)
    : [];

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>
      <div style={{ background: 'var(--black)', padding: 'clamp(32px,5vw,72px) clamp(24px,4vw,56px)', borderBottom: '1px solid var(--border)' }}>
        <p className="text-label" style={{ color: '#555', marginBottom: 16, fontSize: 10 }}>■ MY TICKETS · PARLAYVAULT ON-CHAIN · AUTO-REFRESHES EVERY 15s</p>
        <h1 className="text-display" style={{ color: 'var(--white)', fontSize: 'clamp(56px,9vw,140px)' }}>CASH OUT<br/>LIVE.</h1>
      </div>

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

      <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 16, alignItems: 'start' }}>
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
