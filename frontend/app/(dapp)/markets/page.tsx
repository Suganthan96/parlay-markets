'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParlayStore } from '@/lib/store';
import { useMarketInfo } from '@/lib/hooks';
import { ProbabilityBar } from '@/components/ui/ProbabilityBar';
import { Countdown } from '@/components/ui/Countdown';
import { MARKET_ADDRESSES } from '@/lib/contracts';
import type { PolyMarket } from '@/app/api/polymarkets/route';

// ── On-chain LMSR card ────────────────────────────────────────────────────────

function OnChainCard({ address }: { address: `0x${string}` }) {
  const { addLeg, hasMarket } = useParlayStore();
  const info    = useMarketInfo(address);
  const inParlay = hasMarket(address);

  if (!info?.homeTeam) {
    return (
      <div style={{ background: 'var(--white)', border: '1px solid var(--border)', minHeight: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="text-label" style={{ fontSize: 10, color: '#bbb' }}>LOADING…</span>
      </div>
    );
  }

  const resolved = info.result !== 0;
  const status   = resolved ? 'resolved' : (info.kickoff * 1000 < Date.now() ? 'live' : 'open');

  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)' }}>
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="text-label" style={{ fontSize: 9, background: 'var(--black)', color: 'var(--white)', padding: '2px 6px' }}>■ ON-CHAIN LMSR</span>
        {status === 'open' && <Countdown target={info.kickoff} />}
        {status === 'live' && <span className="text-label" style={{ fontSize: 10, color: 'var(--mint)' }}>● LIVE</span>}
        {status === 'resolved' && <span className="text-label" style={{ fontSize: 10 }}>FINAL</span>}
      </div>

      <div style={{ padding: '20px 16px', display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{info.homeTeam}</div>
          <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, marginTop: 4 }}>{info.homePrice.toFixed(2)}</div>
        </div>
        <span className="text-label" style={{ fontSize: 10, color: '#bbb' }}>VS</span>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{info.awayTeam}</div>
          <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, marginTop: 4 }}>{info.awayPrice.toFixed(2)}</div>
        </div>
      </div>

      <div style={{ padding: '0 16px 12px' }}>
        <ProbabilityBar pct={info.homePrice} />
      </div>

      {resolved ? (
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', background: 'var(--mint)' }}>
          <span className="text-label" style={{ fontSize: 10 }}>
            WINNER: {info.result === 1 ? info.homeTeam : info.result === 2 ? info.awayTeam : 'DRAW'}
          </span>
        </div>
      ) : (
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
          <button
            onClick={() => addLeg({ marketId: address, marketLabel: `${info.homeTeam} vs ${info.awayTeam}`, outcome: info.homeTeam!, price: info.homePrice, marketAddress: address, outcomeIdx: 0 })}
            disabled={inParlay}
            style={{ flex: 1, padding: '10px', background: inParlay ? 'var(--mint)' : 'var(--black)', color: inParlay ? 'var(--black)' : 'var(--white)', border: 'none', cursor: inParlay ? 'default' : 'pointer', fontWeight: 700, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}
          >
            {inParlay ? '✓' : `+ ${info.homeTeam}`}
          </button>
          <button
            onClick={() => addLeg({ marketId: `${address}-draw`, marketLabel: `${info.homeTeam} vs ${info.awayTeam}`, outcome: 'DRAW', price: 1 - info.homePrice - info.awayPrice, marketAddress: address, outcomeIdx: 2 })}
            disabled={hasMarket(`${address}-draw`)}
            style={{ padding: '10px 12px', background: hasMarket(`${address}-draw`) ? 'var(--mint)' : 'transparent', color: 'var(--black)', border: '1px solid var(--border)', cursor: hasMarket(`${address}-draw`) ? 'default' : 'pointer', fontWeight: 700, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase' }}
          >
            {hasMarket(`${address}-draw`) ? '✓' : 'DRAW'}
          </button>
          <button
            onClick={() => addLeg({ marketId: `${address}-away`, marketLabel: `${info.homeTeam} vs ${info.awayTeam}`, outcome: info.awayTeam!, price: info.awayPrice, marketAddress: address, outcomeIdx: 1 })}
            disabled={hasMarket(`${address}-away`)}
            style={{ flex: 1, padding: '10px', background: hasMarket(`${address}-away`) ? 'var(--mint)' : 'var(--white)', color: 'var(--black)', border: '1px solid var(--black)', cursor: hasMarket(`${address}-away`) ? 'default' : 'pointer', fontWeight: 700, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}
          >
            {hasMarket(`${address}-away`) ? '✓' : `+ ${info.awayTeam}`}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Polymarket card ───────────────────────────────────────────────────────────

// Map Polymarket markets to your on-chain LMSR contracts round-robin
function getOnChainSlot(idx: number): `0x${string}` {
  return MARKET_ADDRESSES[idx % MARKET_ADDRESSES.length];
}

function PolyCard({ market, idx }: { market: PolyMarket; idx: number }) {
  const { addLeg, hasMarket } = useParlayStore();
  const marketId = `poly-${market.id}`;
  const contract = getOnChainSlot(idx);
  const inParlay = hasMarket(marketId);
  const daysLeft = Math.max(0, Math.ceil((new Date(market.endDate).getTime() - Date.now()) / 86400000));

  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="text-label" style={{ fontSize: 9, color: '#888' }}>POLYMARKET · {daysLeft}d left</span>
        <span style={{ fontSize: 11, color: '#888', fontWeight: 600 }}>${(market.liquidity / 1000).toFixed(0)}k liq</span>
      </div>

      {/* Question + probability (same layout as on-chain card) */}
      <div style={{ padding: '20px 16px', display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1 }}>
        {market.image && (
          <img src={market.image} alt="" style={{ width: 36, height: 36, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />
        )}
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.4, margin: '0 0 12px' }}>{market.question}</p>
          <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1 }}>
            {market.yesPrice.toFixed(2)}
          </div>
          <div style={{ marginTop: 10 }}>
            <ProbabilityBar pct={market.yesPrice} />
          </div>
        </div>
      </div>

      {/* Add button — same style as on-chain card */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
        <button
          onClick={() => addLeg({ marketId, marketLabel: market.question, outcome: 'YES', price: market.yesPrice, marketAddress: contract, outcomeIdx: 0 })}
          disabled={inParlay}
          style={{
            width: '100%', padding: '10px',
            background: inParlay ? 'var(--mint)' : 'var(--black)',
            color:      inParlay ? 'var(--black)' : 'var(--white)',
            border: 'none', cursor: inParlay ? 'default' : 'pointer',
            fontWeight: 700, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
          }}
        >
          {inParlay ? '✓ ADDED TO PARLAY' : '+ ADD TO PARLAY'}
        </button>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

type Filter = 'all' | 'politics' | 'crypto' | 'sports' | 'world';

function inferCategory(q: string): Filter {
  const t = q.toLowerCase();
  if (/bitcoin|eth|crypto|btc|sol|token|coin|defi|nft|polymarket|blockchain/.test(t)) return 'crypto';
  if (/election|president|senate|congress|vote|trump|biden|democrat|republican|prime minister|parliament/.test(t)) return 'politics';
  if (/win|championship|league|season|nba|nfl|epl|fifa|super bowl|world cup|match|game|sport/.test(t)) return 'sports';
  return 'world';
}

export default function MarketsPage() {
  const [polymarkets, setPolymarkets] = useState<PolyMarket[]>([]);
  const [loading, setLoading]         = useState(true);
  const [filter, setFilter]           = useState<Filter>('all');
  const { legs }                      = useParlayStore();

  useEffect(() => {
    fetch('/api/polymarkets')
      .then(r => r.json())
      .then(data => { setPolymarkets(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = filter === 'all' ? polymarkets : polymarkets.filter(m => inferCategory(m.question) === filter);

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>
      {/* Hero */}
      <div className="page-grid" style={{ borderBottom: 'none' }}>
        <div className="gc-1-2 flex flex-col justify-end cell-pad-lg" style={{ background: 'var(--black)', minHeight: 'clamp(200px,28vh,340px)' }}>
          <p className="text-label" style={{ color: '#666', marginBottom: 16, fontSize: 10 }}>■ REAL WORLD EVENTS × 1INCH AQUA</p>
          <h1 className="text-display" style={{ color: 'var(--white)', fontSize: 'clamp(56px,8vw,120px)' }}>Markets</h1>
        </div>
        <div className="gc-3 flex flex-col justify-between cell-pad" style={{ borderLeft: '1px solid var(--border)', minHeight: 'clamp(200px,28vh,340px)' }}>
          <p className="text-label" style={{ fontSize: 10, color: '#aaa' }}>■ HOW TO PLAY</p>
          {[
            { n: '01', t: 'Pick YES or NO', d: 'Add legs from any market below — sports, politics, crypto' },
            { n: '02', t: 'Set your stake',  d: 'Enter USDC in the Parlay builder' },
            { n: '03', t: 'Buy via Aqua',    d: 'One tx — payout drawn from LP wallet' },
          ].map(s => (
            <div key={s.n} style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
              <span style={{ fontWeight: 800, fontSize: 11, color: '#ccc', minWidth: 24 }}>{s.n}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 12 }}>{s.t}</div>
                <div style={{ fontSize: 11, color: '#888' }}>{s.d}</div>
              </div>
            </div>
          ))}
          <Link href="/parlay" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none', fontWeight: 700, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {legs.length > 0 ? `Build parlay (${legs.length} leg${legs.length > 1 ? 's' : ''})` : 'Build a parlay'} <span style={{ background: 'var(--black)', color: 'var(--white)', padding: '4px 8px' }}>→</span>
          </Link>
        </div>
        <div className="gc-4 flex flex-col justify-between cell-pad" style={{ background: 'var(--mint)', borderLeft: '1px solid var(--border)', minHeight: 'clamp(200px,28vh,340px)' }}>
          <p className="text-label" style={{ fontSize: 10 }}>■ POWERED BY</p>
          <div>
            <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Live markets from Polymarket</p>
            <p style={{ fontSize: 11, color: '#555', lineHeight: 1.5, marginBottom: 8 }}>Real-world odds from the largest prediction market. Bets execute on-chain via 1inch Aqua.</p>
            <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>On-chain LMSR pricing</p>
            <p style={{ fontSize: 11, color: '#555', lineHeight: 1.5 }}>Prices always sum to 100%. LP capital stays in wallet until you win.</p>
          </div>
        </div>
      </div>

      {/* Polymarket live markets */}
      <div style={{ borderTop: '1px solid var(--border)' }}>
        <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span className="text-label" style={{ fontSize: 9, background: '#6366f1', color: '#fff', padding: '2px 8px' }}>■ POLYMARKET · LIVE ODDS</span>
          {(['all', 'politics', 'crypto', 'sports', 'world'] as Filter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '3px 10px', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer', border: '1px solid var(--border)',
                background: filter === f ? 'var(--black)' : 'transparent',
                color:      filter === f ? 'var(--white)' : 'var(--black)',
              }}
            >
              {f}
            </button>
          ))}
          {!loading && <span style={{ marginLeft: 'auto', fontSize: 11, color: '#888' }}>{filtered.length} markets</span>}
        </div>

        {loading ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <span className="text-label" style={{ fontSize: 10, color: '#bbb' }}>FETCHING LIVE MARKETS…</span>
          </div>
        ) : (
          <div style={{ padding: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 1, background: 'var(--border)' }}>
            {filtered.map((m, i) => <PolyCard key={m.id} market={m} idx={i} />)}
          </div>
        )}
      </div>
    </div>
  );
}
