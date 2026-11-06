'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParlayStore } from '@/lib/store';
import type { ParlayLeg } from '@/lib/types';

const MARGIN = 0.10;

function calcParlay(legs: ParlayLeg[]) {
  if (!legs.length) return { raw: 0, withMargin: 0 };
  const raw = legs.reduce((acc, l) => acc * l.price, 1);
  return { raw, withMargin: raw * (1 + MARGIN) };
}

export default function ParlayPage() {
  const { legs, removeLeg, clearLegs } = useParlayStore();
  const [amount, setAmount] = useState('');
  const [pending, setPending] = useState(false);

  const stake = parseFloat(amount) || 0;
  const { raw, withMargin } = calcParlay(legs);
  const payout = withMargin > 0 ? stake / withMargin : 0;

  async function handleBuy() {
    if (!legs.length || !stake) return;
    setPending(true);
    await new Promise(r => setTimeout(r, 1200));
    clearLegs();
    setPending(false);
    alert('Ticket minted! (mock)');
  }

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>
      {/* Headline */}
      <div style={{ background: 'var(--black)', padding: 'clamp(32px,5vw,72px) clamp(24px,4vw,56px)', borderBottom: '1px solid var(--border)' }}>
        <p className="text-label" style={{ color: '#555', marginBottom: 16, fontSize: 10 }}>■ PARLAY BUILDER · SWAPVM PARLAYRICE</p>
        <h1 className="text-display" style={{ color: 'var(--white)', fontSize: 'clamp(56px,9vw,140px)' }}>BUILD YOUR<br/>PARLAY.</h1>
      </div>

      <div className="page-grid" style={{ background: 'var(--border)' }}>
        {/* Left: legs */}
        <div className="gc-1-2" style={{ background: 'var(--white)' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="text-label" style={{ fontSize: 10 }}>■ SELECTED LEGS ({legs.length}/5)</span>
            {legs.length > 0 && (
              <button onClick={clearLegs} style={{ background: 'none', border: '1px solid var(--border)', padding: '4px 10px', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', cursor: 'pointer', textTransform: 'uppercase' }}>CLEAR</button>
            )}
          </div>

          {legs.length === 0 ? (
            <div style={{ padding: 48 }}>
              <p className="text-label" style={{ fontSize: 10, color: '#aaa' }}>NO LEGS ADDED YET.</p>
              <p style={{ fontSize: 14, marginTop: 12, color: '#888', lineHeight: 1.5 }}>Go to <Link href="/markets" style={{ color: 'var(--black)', fontWeight: 600 }}>Markets</Link> and add outcomes to your parlay.</p>
            </div>
          ) : legs.map((leg, i) => (
            <div key={leg.marketId} style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 16 }}>
              <span className="text-label" style={{ color: '#bbb', minWidth: 48, fontSize: 10 }}>■ LEG {String(i+1).padStart(2,'0')}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{leg.marketLabel}</div>
                <div className="text-label" style={{ marginTop: 4, color: '#888', fontSize: 10 }}>OUTCOME: {leg.outcome}</div>
              </div>
              <span style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.04em' }}>{leg.price.toFixed(2)}</span>
              <button onClick={() => removeLeg(leg.marketId)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#bbb', padding: 4 }} aria-label="Remove leg">×</button>
            </div>
          ))}

          {legs.length >= 5 && (
            <div style={{ padding: '10px 24px', background: 'var(--light-gray)' }}>
              <span className="text-label" style={{ fontSize: 10, color: '#888' }}>■ MAX 5 LEGS REACHED</span>
            </div>
          )}
        </div>

        {/* Right: equation + buy */}
        <div className="gc-3-4" style={{ background: 'var(--white)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
            <span className="text-label" style={{ fontSize: 10 }}>■ PRICE EQUATION (LMSR × MARGIN)</span>
          </div>

          {/* Equation */}
          <div style={{ padding: 'clamp(24px,3vw,40px) 24px', borderBottom: '1px solid var(--border)', flex: 1, overflowX: 'auto' }}>
            {legs.length > 0 ? (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                {legs.map((leg, i) => (
                  <span key={leg.marketId} style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                    <span style={{ fontSize: 'clamp(28px,4vw,52px)', fontWeight: 800, letterSpacing: '-0.04em' }}>{leg.price.toFixed(2)}</span>
                    {i < legs.length - 1 && <span style={{ fontSize: 24, color: '#ccc' }}>×</span>}
                  </span>
                ))}
                <span style={{ fontSize: 24, color: '#ccc' }}>=</span>
                <span style={{ fontSize: 'clamp(28px,4vw,52px)', fontWeight: 800 }}>{raw.toFixed(3)}</span>
                <span style={{ fontSize: 13, color: '#888' }}>+ {(MARGIN*100).toFixed(0)}% margin →</span>
                <span style={{ fontSize: 'clamp(28px,4vw,52px)', fontWeight: 800, color: 'var(--black)' }}>{withMargin.toFixed(3)}</span>
              </div>
            ) : (
              <p style={{ color: '#ccc', fontSize: 20, fontWeight: 500 }}>Add legs to see pricing</p>
            )}
          </div>

          {/* Stake input */}
          <div style={{ padding: '24px', borderBottom: '1px solid var(--border)' }}>
            <span className="text-label" style={{ display: 'block', marginBottom: 10, fontSize: 10 }}>■ STAKE (USDC)</span>
            <input
              type="number"
              min="1"
              placeholder="0.00"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              style={{ background: 'transparent', border: 'none', borderBottom: '2px solid var(--black)', fontSize: 'clamp(32px,5vw,56px)', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--black)', outline: 'none', width: '100%', padding: '6px 0' }}
            />
          </div>

          {/* Pay / Win */}
          {stake > 0 && legs.length > 0 && (
            <div className="page-grid" style={{ background: 'var(--border)', borderBottom: '1px solid var(--border)' }}>
              <div className="gc-1-2" style={{ background: 'var(--white)', padding: '20px 24px' }}>
                <span className="text-label" style={{ display: 'block', marginBottom: 8, fontSize: 10 }}>■ YOU PAY</span>
                <div style={{ fontSize: 'clamp(28px,4vw,48px)', fontWeight: 800, letterSpacing: '-0.03em' }}>${stake.toFixed(2)}</div>
              </div>
              <div className="gc-3-4" style={{ background: 'var(--mint)', padding: '20px 24px' }}>
                <span className="text-label" style={{ display: 'block', marginBottom: 8, fontSize: 10 }}>■ YOU WIN</span>
                <div style={{ fontSize: 'clamp(28px,4vw,48px)', fontWeight: 800, letterSpacing: '-0.03em' }}>${payout.toFixed(2)}</div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ padding: '20px 24px', display: 'flex', gap: 12 }}>
            <button
              onClick={handleBuy}
              disabled={!legs.length || !stake || pending}
              style={{ flex: 1, padding: '14px', background: (!legs.length || !stake) ? '#eee' : 'var(--black)', color: (!legs.length || !stake) ? '#aaa' : 'var(--white)', border: 'none', cursor: (!legs.length || !stake) ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}
            >
              {pending ? '...' : 'BUY PARLAY →'}
            </button>
            <button style={{ flex: 1, padding: '14px', background: 'var(--white)', color: 'var(--black)', border: '1px solid var(--black)', cursor: 'pointer', fontWeight: 700, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              SHARE SLIP →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
