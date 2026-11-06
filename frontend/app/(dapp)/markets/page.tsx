'use client';

import Link from 'next/link';
import { MOCK_MARKETS } from '@/lib/mock';
import { useParlayStore } from '@/lib/store';
import { Countdown } from '@/components/ui/Countdown';
import { ProbabilityBar } from '@/components/ui/ProbabilityBar';
import type { Market } from '@/lib/types';

function MarketCard({ market }: { market: Market }) {
  const { addLeg, hasMarket } = useParlayStore();
  const inParlay = hasMarket(market.id);

  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)' }}>
      {/* Header */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="text-label" style={{ fontSize: 10, color: '#888' }}>{market.league}</span>
        {market.status === 'open'     && <Countdown target={market.kickoff} />}
        {market.status === 'live'     && <span className="text-label" style={{ fontSize: 10, color: 'var(--mint)' }}>● LIVE</span>}
        {market.status === 'resolved' && <span className="text-label" style={{ fontSize: 10 }}>FINAL</span>}
      </div>

      {/* Teams + prices */}
      <div style={{ padding: '20px 16px', display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>{market.homeTeam}</div>
          <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, marginTop: 4,
            color: market.status === 'resolved' ? (market.winner === market.homeTeam ? 'var(--black)' : '#ccc') : 'var(--black)' }}>
            {market.homePrice.toFixed(2)}
          </div>
        </div>
        <span className="text-label" style={{ fontSize: 10, color: '#bbb' }}>VS</span>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>{market.awayTeam}</div>
          <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, marginTop: 4,
            color: market.status === 'resolved' ? (market.winner === market.awayTeam ? 'var(--black)' : '#ccc') : 'var(--black)' }}>
            {market.awayPrice.toFixed(2)}
          </div>
        </div>
      </div>

      <div style={{ padding: '0 16px 12px' }}>
        <ProbabilityBar pct={market.homePrice} />
      </div>

      {/* Resolved stamp */}
      {market.status === 'resolved' && market.winner && (
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', background: 'var(--mint)' }}>
          <span className="text-label" style={{ fontSize: 10 }}>WINNER: {market.winner}</span>
          {market.txHash && (
            <div className="text-label" style={{ fontSize: 9, color: '#555', marginTop: 4 }}>
              ■ VERIFIED BY CHAINLINK · {market.txHash.slice(0,8)}…
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      {market.status !== 'resolved' && (
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
          <button
            onClick={() => {
              addLeg({ marketId: market.id, marketLabel: `${market.homeTeam} beats ${market.awayTeam}`, outcome: market.homeTeam, price: market.homePrice });
            }}
            disabled={inParlay}
            style={{
              flex: 1, padding: '10px', background: inParlay ? 'var(--mint)' : 'var(--black)',
              color: inParlay ? 'var(--black)' : 'var(--white)', border: 'none', cursor: inParlay ? 'default' : 'pointer',
              fontWeight: 700, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
            }}
          >
            {inParlay ? '✓ ADDED' : '+ ADD TO PARLAY'}
          </button>
          <Link
            href="/parlay"
            style={{ flex: 1, padding: '10px', background: 'var(--white)', color: 'var(--black)',
              border: '1px solid var(--black)', textDecoration: 'none', textAlign: 'center',
              fontWeight: 700, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            BUY →
          </Link>
        </div>
      )}
    </div>
  );
}

export default function MarketsPage() {
  const markets = MOCK_MARKETS;

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>
      {/* Hero row */}
      <div className="page-grid" style={{ borderBottom: 'none' }}>
        <div className="gc-1-2 flex flex-col justify-end cell-pad-lg" style={{ background: 'var(--black)', minHeight: 'clamp(200px,28vh,340px)' }}>
          <p className="text-label" style={{ color: '#666', marginBottom: 16, fontSize: 10 }}>■ 1INCH AQUA × SWAPVM</p>
          <h1 className="text-display" style={{ color: 'var(--white)', fontSize: 'clamp(56px,8vw,120px)' }}>Markets</h1>
        </div>
        <div className="gc-3 flex flex-col justify-between cell-pad" style={{ background: 'var(--white)', borderLeft: '1px solid var(--border)', minHeight: 'clamp(200px,28vh,340px)' }}>
          <p className="text-body" style={{ lineHeight: 1.6 }}>
            Live outcome prices powered by LMSR on 1inch Aqua. Add up to 5 legs to build a parlay. LP liquidity never leaves the wallet.
          </p>
          <Link href="/parlay" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none', fontWeight: 700, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--black)' }}>
            Build a parlay <span style={{ background: 'var(--black)', color: 'var(--white)', padding: '4px 8px' }}>→</span>
          </Link>
        </div>
        <div className="gc-4 flex flex-col justify-center cell-pad" style={{ background: 'var(--mint)', borderLeft: '1px solid var(--border)', minHeight: 'clamp(200px,28vh,340px)' }}>
          <p className="text-label" style={{ fontSize: 10, marginBottom: 8 }}>LMSR GUARANTEE</p>
          <p className="text-body" style={{ fontWeight: 600 }}>Prices always sum to 100%</p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', borderTop: '1px solid var(--border)', background: 'var(--white)', display: 'flex', gap: 8 }}>
        {['ALL', 'OPEN', 'LIVE', 'RESOLVED'].map(f => (
          <button key={f} style={{ padding: '6px 14px', background: 'var(--white)', border: '1px solid var(--border)', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', cursor: 'pointer' }}>{f}</button>
        ))}
      </div>

      {/* Market cards grid */}
      <div style={{ padding: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 1, background: 'var(--border)' }}>
        {markets.map(m => <MarketCard key={m.id} market={m} />)}
      </div>
    </div>
  );
}
