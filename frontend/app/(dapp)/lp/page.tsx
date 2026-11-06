'use client';

import { MOCK_LP_STATS } from '@/lib/mock';

export default function LpPage() {
  const stats = MOCK_LP_STATS;

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>
      {/* Headline */}
      <div style={{ background: 'var(--white)', padding: 'clamp(32px,5vw,72px) clamp(24px,4vw,56px)', borderBottom: '1px solid var(--border)' }}>
        <p className="text-label" style={{ color: '#aaa', marginBottom: 16, fontSize: 10 }}>■ LP CONSOLE · 1INCH AQUA</p>
        <h1 className="text-display" style={{ fontSize: 'clamp(56px,9vw,140px)' }}>BE THE<br/>HOUSE.</h1>
      </div>

      {/* Stat row — 4 cells */}
      <div className="page-grid" style={{ background: 'var(--border)', borderBottom: '1px solid var(--border)' }}>
        {[
          { label: 'WALLET USDC',      value: `$${stats.walletUsdc.toLocaleString()}`,    note: 'stays in your wallet',          bg: 'var(--white)' },
          { label: 'PARLAY CAP USED',  value: `$${stats.parlayCapUsed.toLocaleString()}`,  note: `of $${stats.parlayCapTotal.toLocaleString()} total`, bg: 'var(--white)' },
          { label: 'MAX LOSS',         value: `$${stats.maxLoss.toFixed(2)}`,              note: 'b × ln N',                      bg: 'var(--white)' },
          { label: 'P&L',              value: `+$${stats.pnl.toFixed(2)}`,                note: 'all time',                      bg: 'var(--mint)'  },
        ].map(s => (
          <div key={s.label} className="gc-1" style={{ background: s.bg, padding: 'clamp(20px,3vw,36px) 24px' }}>
            <span className="text-label" style={{ display: 'block', marginBottom: 12, fontSize: 10 }}>■ {s.label}</span>
            <div style={{ fontSize: 'clamp(32px,4vw,56px)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1 }}>{s.value}</div>
            <div className="text-label" style={{ marginTop: 10, fontSize: 10, color: '#888' }}>{s.note}</div>
          </div>
        ))}
      </div>

      {/* Strategy table */}
      <div style={{ background: 'var(--white)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
          <span className="text-label" style={{ fontSize: 10 }}>■ MARKET STRATEGIES · 1INCH AQUA SHIP/DOCK</span>
        </div>
        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto', padding: '10px 24px', borderBottom: '1px solid var(--border)', background: 'var(--light-gray)' }}>
          {['MATCH', 'STATUS', 'b', 'SHIPPED', 'EXPOSURE', 'ACTION'].map(h => (
            <span key={h} className="text-label" style={{ fontSize: 10, color: '#888' }}>{h}</span>
          ))}
        </div>
        {stats.strategies.map(s => (
          <div key={s.marketId} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto', padding: '16px 24px', borderBottom: '1px solid var(--border)', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 600 }}>{s.label}</span>
            <span>
              <span className="text-label" style={{ fontSize: 10, padding: '3px 8px', background: s.status === 'shipped' ? 'var(--mint)' : 'var(--light-gray)' }}>
                {s.status.toUpperCase()}
              </span>
            </span>
            <span style={{ fontWeight: 600 }}>{s.b}</span>
            <span>${s.shippedAmount.toLocaleString()}</span>
            <span style={{ color: s.exposure > 0 ? '#FF5A4E' : '#aaa' }}>${s.exposure.toLocaleString()}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {s.status === 'docked' ? (
                <button style={{ padding: '6px 12px', background: 'var(--black)', color: 'var(--white)', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase' }}>SHIP →</button>
              ) : (
                <>
                  <button style={{ padding: '6px 10px', background: 'var(--white)', color: 'var(--black)', border: '1px solid var(--border)', cursor: 'pointer', fontWeight: 700, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase' }}>DOCK</button>
                  <button style={{ padding: '6px 10px', background: 'var(--white)', color: 'var(--black)', border: '1px solid var(--border)', cursor: 'pointer', fontWeight: 700, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase' }}>EDIT</button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Ship wizard */}
      <div style={{ background: 'var(--black)', color: 'var(--white)', padding: '32px 24px', borderBottom: '1px solid var(--border)' }}>
        <span className="text-label" style={{ display: 'block', marginBottom: 20, color: '#666', fontSize: 10 }}>■ SHIP WIZARD · AQUA SDK</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          {[
            { label: 'SELECT MATCH', placeholder: 'e.g. Team A vs Team B' },
            { label: 'LIQUIDITY (b)', placeholder: 'e.g. 100' },
            { label: 'PARLAY CAP',   placeholder: 'e.g. 500' },
          ].map(f => (
            <div key={f.label}>
              <label className="text-label" style={{ display: 'block', marginBottom: 8, fontSize: 10, color: '#666' }}>{f.label}</label>
              <input placeholder={f.placeholder} style={{ background: '#1e1e1e', border: '1px solid #333', color: 'var(--white)', padding: '10px 14px', fontSize: 13, width: '100%', outline: 'none', fontFamily: 'inherit' }} />
            </div>
          ))}
        </div>
        <button style={{ marginTop: 20, padding: '12px 24px', background: 'var(--mint)', color: 'var(--black)', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          SHIP TO AQUA →
        </button>
      </div>

      {/* Claims */}
      <div style={{ padding: '24px', background: 'var(--white)' }}>
        <span className="text-label" style={{ display: 'block', marginBottom: 16, fontSize: 10 }}>■ CLAIMS (LOSING TICKETS — CHAINLINK SETTLED)</span>
        <p style={{ color: '#aaa', fontSize: 14 }}>No claimable tickets yet.</p>
      </div>
    </div>
  );
}
