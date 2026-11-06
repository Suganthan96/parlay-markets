'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParlayStore } from '@/lib/store';
import { useMarketInfo, useRequestSettlement } from '@/lib/hooks';
import { Countdown } from '@/components/ui/Countdown';
import { TxLink } from '@/components/ui/TxLink';
import { MARKET_ADDRESSES, MARKET_RESOLVER_ADDRESS } from '@/lib/contracts';
import { espnIdToMatchId } from '@/lib/espn';
import type { PolyMarket } from '@/app/api/polymarkets/route';

// ── 3D price chart ────────────────────────────────────────────────────────────

function seededRng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
    h = (h >>> 0);
  }
  return () => {
    h ^= h << 13; h ^= h >> 17; h ^= h << 5;
    return (h >>> 0) / 4294967296;
  };
}

function generatePricePath(seed: string, endPrice: number, points = 60): number[] {
  const rng = seededRng(seed);
  const path: number[] = [0.5];
  for (let i = 1; i < points; i++) {
    const drift = (endPrice - path[i - 1]) * 0.08;
    const noise = (rng() - 0.5) * 0.06;
    path.push(Math.min(0.98, Math.max(0.02, path[i - 1] + drift + noise)));
  }
  path[points - 1] = endPrice;
  return path;
}

function Chart3D({ price, seed, color = '#00dc82' }: { price: number; seed: string; color?: string }) {
  const pts = generatePricePath(seed, price);
  const W = 320, H = 160;
  const pad = { l: 28, r: 8, t: 10, b: 24 };
  const iW = W - pad.l - pad.r;
  const iH = H - pad.t - pad.b;

  const x = (i: number) => pad.l + (i / (pts.length - 1)) * iW;
  const y = (v: number) => pad.t + (1 - v) * iH;

  // Build polyline
  const polyline = pts.map((v, i) => `${x(i)},${y(v)}`).join(' ');

  // Fill area under curve
  const fillPath = `M${x(0)},${y(pts[0])} ` +
    pts.slice(1).map((v, i) => `L${x(i + 1)},${y(v)}`).join(' ') +
    ` L${x(pts.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;

  // Grid lines at 0.25, 0.5, 0.75
  const gridYs = [0.25, 0.5, 0.75];

  return (
    <div style={{
      perspective: '600px',
      perspectiveOrigin: '50% 60%',
    }}>
      <div style={{
        transform: 'rotateX(18deg) rotateY(-4deg) scale(1.04)',
        transformOrigin: '50% 50%',
        transformStyle: 'preserve-3d',
      }}>
        <svg width={W} height={H} style={{ display: 'block' }}>
          {/* Grid */}
          {gridYs.map(g => (
            <g key={g}>
              <line
                x1={pad.l} y1={y(g)} x2={W - pad.r} y2={y(g)}
                stroke="#ffffff0d" strokeWidth={1} strokeDasharray="3 3"
              />
              <text x={pad.l - 4} y={y(g) + 4} textAnchor="end" fill="#555" fontSize={8} fontFamily="monospace">
                {(g * 100).toFixed(0)}
              </text>
            </g>
          ))}

          {/* Fill */}
          <defs>
            <linearGradient id={`grad-${seed.slice(0,6)}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.25" />
              <stop offset="100%" stopColor={color} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <path d={fillPath} fill={`url(#grad-${seed.slice(0,6)})`} />

          {/* Line */}
          <polyline points={polyline} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />

          {/* Current price dot */}
          <circle cx={x(pts.length - 1)} cy={y(price)} r={3} fill={color} />
          <line
            x1={x(pts.length - 1)} y1={y(price)}
            x2={W - pad.r} y2={y(price)}
            stroke={color} strokeWidth={1} strokeDasharray="2 2" opacity={0.5}
          />

          {/* X axis */}
          <line x1={pad.l} y1={H - pad.b} x2={W - pad.r} y2={H - pad.b} stroke="#333" strokeWidth={1} />
          <text x={pad.l} y={H - pad.b + 12} fill="#444" fontSize={8} fontFamily="monospace">30d ago</text>
          <text x={W - pad.r} y={H - pad.b + 12} textAnchor="end" fill="#444" fontSize={8} fontFamily="monospace">now</text>
        </svg>
      </div>
    </div>
  );
}

// ── Market detail modal ───────────────────────────────────────────────────────

function MarketDetailModal({
  market,
  onClose,
  idx,
}: {
  market: PolyMarket | null;
  onClose: () => void;
  idx: number;
}) {
  const { addLeg, hasMarket } = useParlayStore();
  if (!market) return null;

  const marketId = `poly-${market.id}`;
  const contract = MARKET_ADDRESSES[idx % MARKET_ADDRESSES.length];
  const inParlay = hasMarket(marketId);
  const daysLeft = Math.max(0, Math.ceil((new Date(market.endDate).getTime() - Date.now()) / 86400000));
  const vol = market.volume24hr >= 1_000_000
    ? `$${(market.volume24hr / 1_000_000).toFixed(1)}M`
    : `$${(market.volume24hr / 1000).toFixed(0)}k`;
  const liq = market.liquidity >= 1_000_000
    ? `$${(market.liquidity / 1_000_000).toFixed(1)}M`
    : `$${(market.liquidity / 1000).toFixed(0)}k`;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#0a0a0a',
          border: '1px solid #222',
          width: '100%', maxWidth: 760,
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 40px 80px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            {market.image && (
              <img src={market.image} alt="" style={{ width: 40, height: 40, objectFit: 'cover', flexShrink: 0, borderRadius: 2 }} />
            )}
            <div>
              <p style={{ fontSize: 11, color: '#555', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
                POLYMARKET · {daysLeft}d left
              </p>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#fff', lineHeight: 1.4, maxWidth: 540 }}>{market.question}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 20, lineHeight: 1, flexShrink: 0 }}>✕</button>
        </div>

        {/* 3D chart + stats */}
        <div style={{ padding: '24px 20px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
          {/* Left: 3D chart */}
          <div>
            <p style={{ fontSize: 9, color: '#444', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 12, textTransform: 'uppercase' }}>■ YES PRICE — 30 DAY CHART</p>
            <Chart3D price={market.yesPrice} seed={market.id} />

            {/* Price label below chart */}
            <div style={{ marginTop: 12, display: 'flex', gap: 16 }}>
              <div>
                <p style={{ fontSize: 9, color: '#555', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 4 }}>YES</p>
                <p style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-0.04em', color: '#00dc82' }}>
                  {(market.yesPrice * 100).toFixed(0)}%
                </p>
              </div>
              <div>
                <p style={{ fontSize: 9, color: '#555', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 4 }}>NO</p>
                <p style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-0.04em', color: '#555' }}>
                  {((1 - market.yesPrice) * 100).toFixed(0)}%
                </p>
              </div>
            </div>

            {/* Bar */}
            <div style={{ height: 4, background: '#1a1a1a', marginTop: 10 }}>
              <div style={{ height: '100%', width: `${market.yesPrice * 100}%`, background: '#00dc82', transition: 'width 0.3s' }} />
            </div>
          </div>

          {/* Right: stats + action */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: '#1a1a1a' }}>
              {[
                { label: '24H VOLUME', value: vol },
                { label: 'LIQUIDITY',  value: liq },
                { label: 'CLOSES',     value: `${daysLeft}d` },
                { label: 'CONTRACT',   value: `${contract.slice(0,6)}…` },
              ].map(s => (
                <div key={s.label} style={{ background: '#0a0a0a', padding: '12px 14px' }}>
                  <p style={{ fontSize: 9, color: '#444', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>{s.label}</p>
                  <p style={{ fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* How it settles */}
            <div style={{ padding: '12px 14px', border: '1px solid #1a1a1a', background: '#050505' }}>
              <p style={{ fontSize: 9, color: '#444', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 8 }}>■ HOW IT SETTLES</p>
              <p style={{ fontSize: 11, color: '#555', lineHeight: 1.6 }}>
                Chainlink CRE monitors the outcome. When resolved, it pushes the result on-chain. Your parlay auto-settles.
              </p>
            </div>

            {/* Add button */}
            <button
              onClick={() => {
                addLeg({
                  marketId,
                  marketLabel: market.question,
                  outcome: 'YES',
                  price: market.yesPrice,
                  marketAddress: contract,
                  outcomeIdx: 0,
                });
                onClose();
              }}
              disabled={inParlay}
              style={{
                width: '100%', padding: '14px',
                background: inParlay ? '#00dc8222' : '#00dc82',
                color: inParlay ? '#00dc82' : '#000',
                border: inParlay ? '1px solid #00dc82' : 'none',
                cursor: inParlay ? 'default' : 'pointer',
                fontWeight: 900, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase',
              }}
            >
              {inParlay ? '✓ ADDED TO PARLAY' : '+ ADD YES TO PARLAY'}
            </button>
            <button
              onClick={() => {
                addLeg({
                  marketId: `${marketId}-no`,
                  marketLabel: market.question,
                  outcome: 'NO',
                  price: market.noPrice,
                  marketAddress: contract,
                  outcomeIdx: 1,
                });
                onClose();
              }}
              disabled={hasMarket(`${marketId}-no`)}
              style={{
                width: '100%', padding: '14px',
                background: 'transparent',
                color: hasMarket(`${marketId}-no`) ? '#555' : '#fff',
                border: `1px solid ${hasMarket(`${marketId}-no`) ? '#222' : '#333'}`,
                cursor: hasMarket(`${marketId}-no`) ? 'default' : 'pointer',
                fontWeight: 900, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase',
                marginTop: -8,
              }}
            >
              {hasMarket(`${marketId}-no`) ? '✓ NO ADDED' : '+ ADD NO TO PARLAY'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── On-chain LMSR card ────────────────────────────────────────────────────────

function OnChainCard({ address }: { address: `0x${string}` }) {
  const { addLeg, hasMarket } = useParlayStore();
  const info    = useMarketInfo(address);
  const inParlay = hasMarket(address);
  const [espnId, setEspnId] = useState('');
  const { requestSettlement, isPending: settling, txHash: settleTx } = useRequestSettlement();

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

      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{info.homeTeam}</div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.04em', color: '#16a34a' }}>
              {(info.homePrice * 100).toFixed(0)}%
            </div>
          </div>
          <span className="text-label" style={{ fontSize: 10, color: '#bbb' }}>VS</span>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{info.awayTeam}</div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.04em', color: '#888' }}>
              {(info.awayPrice * 100).toFixed(0)}%
            </div>
          </div>
        </div>
        <div style={{ height: 6, background: '#eee', borderRadius: 3, overflow: 'hidden', marginBottom: 12, display: 'flex' }}>
          <div style={{ width: `${info.homePrice * 100}%`, background: '#16a34a', transition: 'width 0.3s' }} />
          <div style={{ width: `${Math.max(0, (1 - info.homePrice - info.awayPrice)) * 100}%`, background: '#ccc' }} />
        </div>
      </div>

      {resolved ? (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          <div style={{ padding: '10px 16px', background: 'var(--mint)' }}>
            <span className="text-label" style={{ fontSize: 10 }}>
              WINNER: {info.result === 1 ? info.homeTeam : info.result === 2 ? info.awayTeam : 'DRAW'}
            </span>
          </div>
          <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center' }}>
            <input value={espnId} onChange={e => setEspnId(e.target.value)} placeholder="ESPN event ID"
              style={{ flex: 1, padding: '6px 10px', border: '1px solid var(--border)', fontSize: 11, fontFamily: 'monospace' }} />
            <button onClick={() => espnId && requestSettlement(espnIdToMatchId(espnId), address)}
              disabled={!espnId || settling}
              style={{ padding: '6px 14px', background: 'var(--black)', color: 'var(--white)', border: 'none', cursor: espnId ? 'pointer' : 'default', fontWeight: 700, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: espnId ? 1 : 0.4 }}>
              {settling ? 'SENDING…' : 'REQUEST CRE'}
            </button>
            {settleTx && <TxLink hash={settleTx} />}
          </div>
        </div>
      ) : (
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
          <button onClick={() => addLeg({ marketId: address, marketLabel: `${info.homeTeam} vs ${info.awayTeam}`, outcome: info.homeTeam!, price: info.homePrice, marketAddress: address, outcomeIdx: 0 })}
            disabled={inParlay}
            style={{ flex: 1, padding: '10px', background: inParlay ? 'var(--mint)' : 'var(--black)', color: inParlay ? 'var(--black)' : 'var(--white)', border: 'none', cursor: inParlay ? 'default' : 'pointer', fontWeight: 700, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {inParlay ? '✓' : `+ ${info.homeTeam}`}
          </button>
          <button onClick={() => addLeg({ marketId: `${address}-draw`, marketLabel: `${info.homeTeam} vs ${info.awayTeam}`, outcome: 'DRAW', price: 1 - info.homePrice - info.awayPrice, marketAddress: address, outcomeIdx: 2 })}
            disabled={hasMarket(`${address}-draw`)}
            style={{ padding: '10px 12px', background: hasMarket(`${address}-draw`) ? 'var(--mint)' : 'transparent', color: 'var(--black)', border: '1px solid var(--border)', cursor: hasMarket(`${address}-draw`) ? 'default' : 'pointer', fontWeight: 700, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {hasMarket(`${address}-draw`) ? '✓' : 'DRAW'}
          </button>
          <button onClick={() => addLeg({ marketId: `${address}-away`, marketLabel: `${info.homeTeam} vs ${info.awayTeam}`, outcome: info.awayTeam!, price: info.awayPrice, marketAddress: address, outcomeIdx: 1 })}
            disabled={hasMarket(`${address}-away`)}
            style={{ flex: 1, padding: '10px', background: hasMarket(`${address}-away`) ? 'var(--mint)' : 'var(--white)', color: 'var(--black)', border: '1px solid var(--black)', cursor: hasMarket(`${address}-away`) ? 'default' : 'pointer', fontWeight: 700, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {hasMarket(`${address}-away`) ? '✓' : `+ ${info.awayTeam}`}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Polymarket card ───────────────────────────────────────────────────────────

function getOnChainSlot(idx: number): `0x${string}` {
  return MARKET_ADDRESSES[idx % MARKET_ADDRESSES.length];
}

function PolyCard({ market, idx, onClick }: { market: PolyMarket; idx: number; onClick: () => void }) {
  const { addLeg, hasMarket } = useParlayStore();
  const marketId = `poly-${market.id}`;
  const inParlay = hasMarket(marketId);
  const daysLeft = Math.max(0, Math.ceil((new Date(market.endDate).getTime() - Date.now()) / 86400000));

  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--white)', border: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', cursor: 'pointer',
        transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.12)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
    >
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="text-label" style={{ fontSize: 9, color: '#888' }}>POLYMARKET · {daysLeft}d left</span>
        <span style={{ fontSize: 11, color: '#888', fontWeight: 600 }}>${(market.liquidity / 1000).toFixed(0)}k liq</span>
      </div>

      <div style={{ padding: '20px 16px', display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1 }}>
        {market.image && (
          <img src={market.image} alt="" style={{ width: 36, height: 36, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />
        )}
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.4, margin: '0 0 14px' }}>{market.question}</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.04em', color: '#16a34a' }}>
                {(market.yesPrice * 100).toFixed(0)}%
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a' }}>YES</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.04em', color: '#888' }}>
                {((1 - market.yesPrice) * 100).toFixed(0)}%
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#888' }}>NO</span>
            </div>
          </div>
          <div style={{ height: 6, background: '#eee', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${market.yesPrice * 100}%`, background: '#16a34a', borderRadius: 3, transition: 'width 0.3s' }} />
          </div>
        </div>
      </div>

      {/* Tap hint */}
      <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 9, color: '#bbb', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {inParlay ? '✓ IN PARLAY' : 'TAP TO VIEW CHART'}
        </span>
        <span style={{ fontSize: 11, color: '#ccc' }}>↗</span>
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
  const [polymarkets, setPolymarkets]       = useState<PolyMarket[]>([]);
  const [loading, setLoading]               = useState(true);
  const [filter, setFilter]                 = useState<Filter>('all');
  const [selectedMarket, setSelectedMarket] = useState<{ market: PolyMarket; idx: number } | null>(null);
  const { legs } = useParlayStore();

  useEffect(() => {
    fetch('/api/polymarkets')
      .then(r => r.json())
      .then(data => { setPolymarkets(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Close modal on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedMarket(null); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const filtered = filter === 'all' ? polymarkets : polymarkets.filter(m => inferCategory(m.question) === filter);

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>
      {/* Modal */}
      {selectedMarket && (
        <MarketDetailModal
          market={selectedMarket.market}
          idx={selectedMarket.idx}
          onClose={() => setSelectedMarket(null)}
        />
      )}

      {/* Hero */}
      <div className="page-grid" style={{ borderBottom: 'none' }}>
        <div className="gc-1-2 flex flex-col justify-end cell-pad-lg" style={{ background: 'var(--black)', minHeight: 'clamp(200px,28vh,340px)' }}>
          <p className="text-label" style={{ color: '#666', marginBottom: 16, fontSize: 10 }}>■ REAL WORLD EVENTS × 1INCH AQUA</p>
          <h1 className="text-display" style={{ color: 'var(--white)', fontSize: 'clamp(56px,8vw,120px)' }}>Markets</h1>
        </div>
        <div className="gc-3 flex flex-col justify-between cell-pad" style={{ borderLeft: '1px solid var(--border)', minHeight: 'clamp(200px,28vh,340px)' }}>
          <p className="text-label" style={{ fontSize: 10, color: '#aaa' }}>■ HOW TO PLAY</p>
          {[
            { n: '01', t: 'Tap a market', d: 'See the 3D price chart and add YES or NO to your parlay' },
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

      {/* On-chain markets */}
      <div style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border)' }}>
          <span className="text-label" style={{ fontSize: 9, background: 'var(--black)', color: 'var(--white)', padding: '2px 8px' }}>■ ON-CHAIN LMSR MARKETS</span>
        </div>
        <div style={{ padding: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 1, background: 'var(--border)' }}>
          {MARKET_ADDRESSES.map(a => <OnChainCard key={a} address={a} />)}
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
            {filtered.map((m, i) => (
              <PolyCard
                key={m.id}
                market={m}
                idx={i}
                onClick={() => setSelectedMarket({ market: m, idx: i })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
