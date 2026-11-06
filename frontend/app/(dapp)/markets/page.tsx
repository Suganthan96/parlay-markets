'use client';

import Link from 'next/link';
import { useParlayStore } from '@/lib/store';
import { Countdown } from '@/components/ui/Countdown';
import { ProbabilityBar } from '@/components/ui/ProbabilityBar';
import { useMarketInfo } from '@/lib/hooks';
import { MARKET_ADDRESSES } from '@/lib/contracts';

// ── Single market card backed by live on-chain reads ─────────────────────────

function MarketCard({ address }: { address: `0x${string}` }) {
  const { addLeg, hasMarket } = useParlayStore();
  const info = useMarketInfo(address);
  const inParlay = hasMarket(address);

  if (!info?.homeTeam) {
    return (
      <div style={{ background: 'var(--white)', border: '1px solid var(--border)', minHeight: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="text-label" style={{ fontSize: 10, color: '#bbb' }}>LOADING…</span>
      </div>
    );
  }

  // result: 0=Unresolved, 1=Home, 2=Away, 3=Draw
  const resolved  = info.result !== 0;
  const winnerIdx = info.result; // 1=home,2=away
  const status    = resolved ? 'resolved' : (info.kickoff * 1000 < Date.now() ? 'live' : 'open');

  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)' }}>
      {/* Header */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="text-label" style={{ fontSize: 10, color: '#888' }}>SEPOLIA · LMSR</span>
        {status === 'open'     && <Countdown target={info.kickoff} />}
        {status === 'live'     && <span className="text-label" style={{ fontSize: 10, color: 'var(--mint)' }}>● LIVE</span>}
        {status === 'resolved' && <span className="text-label" style={{ fontSize: 10 }}>FINAL</span>}
      </div>

      {/* Teams + live prices */}
      <div style={{ padding: '20px 16px', display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>{info.homeTeam}</div>
          <div style={{
            fontSize: 40, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, marginTop: 4,
            color: resolved ? (winnerIdx === 1 ? 'var(--black)' : '#ccc') : 'var(--black)',
          }}>
            {info.homePrice.toFixed(2)}
          </div>
        </div>
        <span className="text-label" style={{ fontSize: 10, color: '#bbb' }}>VS</span>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>{info.awayTeam}</div>
          <div style={{
            fontSize: 40, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, marginTop: 4,
            color: resolved ? (winnerIdx === 2 ? 'var(--black)' : '#ccc') : 'var(--black)',
          }}>
            {info.awayPrice.toFixed(2)}
          </div>
        </div>
      </div>

      <div style={{ padding: '0 16px 12px' }}>
        <ProbabilityBar pct={info.homePrice} />
      </div>

      {/* Resolved stamp */}
      {resolved && (
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', background: 'var(--mint)' }}>
          <span className="text-label" style={{ fontSize: 10 }}>
            WINNER: {winnerIdx === 1 ? info.homeTeam : winnerIdx === 2 ? info.awayTeam : 'DRAW'}
          </span>
          <div className="text-label" style={{ fontSize: 9, color: '#555', marginTop: 4 }}>■ RESOLVED VIA CHAINLINK CRE</div>
        </div>
      )}

      {/* Add to parlay / Go to builder */}
      {!resolved && (
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
          <button
            onClick={() => addLeg({
              marketId:    address,
              marketLabel: `${info.homeTeam} vs ${info.awayTeam}`,
              outcome:     info.homeTeam!,
              price:       info.homePrice,
              marketAddress: address,
              outcomeIdx:  0,
            })}
            disabled={inParlay}
            style={{
              flex: 1, padding: '10px',
              background: inParlay ? 'var(--mint)' : 'var(--black)',
              color:      inParlay ? 'var(--black)' : 'var(--white)',
              border: 'none', cursor: inParlay ? 'default' : 'pointer',
              fontWeight: 700, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
            }}
          >
            {inParlay ? '✓ ADDED' : '+ ADD TO PARLAY'}
          </button>
          <Link href="/parlay" style={{
            flex: 1, padding: '10px', background: 'var(--white)', color: 'var(--black)',
            border: '1px solid var(--black)', textDecoration: 'none', textAlign: 'center',
            fontWeight: 700, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>BUILD →</Link>
        </div>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function MarketsPage() {
  const noMarkets = MARKET_ADDRESSES.length === 0;

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>
      <div className="page-grid" style={{ borderBottom: 'none' }}>
        <div className="gc-1-2 flex flex-col justify-end cell-pad-lg" style={{ background: 'var(--black)', minHeight: 'clamp(200px,28vh,340px)' }}>
          <p className="text-label" style={{ color: '#666', marginBottom: 16, fontSize: 10 }}>■ 1INCH AQUA × LMSR PRICING</p>
          <h1 className="text-display" style={{ color: 'var(--white)', fontSize: 'clamp(56px,8vw,120px)' }}>Markets</h1>
        </div>
        <div className="gc-3 flex flex-col justify-between cell-pad" style={{ borderLeft: '1px solid var(--border)', minHeight: 'clamp(200px,28vh,340px)' }}>
          <p className="text-body" style={{ lineHeight: 1.6 }}>
            Live outcome prices from LMSR on-chain. Add legs to build a parlay. Odds refresh every 15 s.
          </p>
          <Link href="/parlay" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none', fontWeight: 700, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Build a parlay <span style={{ background: 'var(--black)', color: 'var(--white)', padding: '4px 8px' }}>→</span>
          </Link>
        </div>
        <div className="gc-4 flex flex-col justify-center cell-pad" style={{ background: 'var(--mint)', borderLeft: '1px solid var(--border)', minHeight: 'clamp(200px,28vh,340px)' }}>
          <p className="text-label" style={{ fontSize: 10, marginBottom: 8 }}>LMSR GUARANTEE</p>
          <p className="text-body" style={{ fontWeight: 600 }}>Prices always sum to 100%</p>
        </div>
      </div>

      {noMarkets ? (
        <div style={{ padding: 48, textAlign: 'center' }}>
          <p className="text-label" style={{ fontSize: 10, color: '#aaa' }}>NO MARKETS DEPLOYED</p>
          <p style={{ marginTop: 12, color: '#888', fontSize: 14 }}>
            Deploy contracts and set <code>NEXT_PUBLIC_MARKETS=0xABC,0xDEF</code>
          </p>
        </div>
      ) : (
        <div style={{ padding: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 1, background: 'var(--border)' }}>
          {MARKET_ADDRESSES.map(addr => <MarketCard key={addr} address={addr} />)}
        </div>
      )}
    </div>
  );
}
