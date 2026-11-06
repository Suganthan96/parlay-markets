'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParlayStore } from '@/lib/store';
import { useQuoteParlay } from '@/lib/hooks';
import type { ParlayLeg } from '@/lib/types';
import BuyParlayButton from '@/components/BuyParlayButton';

function calcFallback(legs: ParlayLeg[]) {
  if (!legs.length) return { raw: 0, withMargin: 0 };
  const raw = legs.reduce((acc, l) => acc * l.price, 1);
  return { raw, withMargin: raw * 1.1 };
}

export default function ParlayPage() {
  const { legs, removeLeg, clearLegs } = useParlayStore();
  const [amount, setAmount] = useState('');
  const stake = parseFloat(amount) || 0;

  // Build on-chain args from legs that have marketAddress/outcomeIdx
  const onChainMarkets  = legs.map(l => l.marketAddress).filter(Boolean) as `0x${string}`[];
  const onChainOutcomes = legs.map(l => BigInt(l.outcomeIdx ?? 0));
  const hasOnChain      = onChainMarkets.length === legs.length && legs.length > 0;

  const { combinedPrice, payoutUsdc, isLoading: quoteLoading } = useQuoteParlay(
    onChainMarkets,
    onChainOutcomes,
    stake,
  );

  // Fall back to client-side math while quote is loading or legs aren't wired
  const fb = calcFallback(legs);
  const displayPrice   = hasOnChain && combinedPrice > 0 ? combinedPrice : fb.withMargin;
  const displayPayout  = hasOnChain && payoutUsdc   > 0 ? payoutUsdc    : (stake > 0 && fb.withMargin > 0 ? stake / fb.withMargin : 0);
  const priceTip       = hasOnChain ? 'ON-CHAIN LMSR QUOTE' : 'CLIENT-SIDE ESTIMATE';

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>
      {/* Headline */}
      <div style={{ background: 'var(--black)', padding: 'clamp(32px,5vw,72px) clamp(24px,4vw,56px)', borderBottom: '1px solid var(--border)' }}>
        <p className="text-label" style={{ color: '#555', marginBottom: 16, fontSize: 10 }}>■ PARLAY BUILDER · LMSR × 1INCH AQUA</p>
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
              <p style={{ fontSize: 14, marginTop: 12, color: '#888', lineHeight: 1.5 }}>Go to <Link href="/markets" style={{ color: 'var(--black)', fontWeight: 600 }}>Markets</Link> and add outcomes.</p>
            </div>
          ) : legs.map((leg, i) => (
            <div key={leg.marketId} style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 16 }}>
              <span className="text-label" style={{ color: '#bbb', minWidth: 48, fontSize: 10 }}>■ LEG {String(i+1).padStart(2,'0')}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{leg.marketLabel}</div>
                <div className="text-label" style={{ marginTop: 4, color: '#888', fontSize: 10 }}>
                  {leg.outcome} · {leg.price.toFixed(2)}
                  {leg.marketAddress && <span style={{ marginLeft: 8, color: 'var(--mint)' }}>■ ON-CHAIN</span>}
                </div>
              </div>
              <span style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.04em' }}>{leg.price.toFixed(2)}</span>
              <button onClick={() => removeLeg(leg.marketId)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#bbb', padding: 4 }}>×</button>
            </div>
          ))}
        </div>

        {/* Right: equation + buy */}
        <div className="gc-3-4" style={{ background: 'var(--white)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="text-label" style={{ fontSize: 10 }}>■ PRICE EQUATION (LMSR × MARGIN)</span>
            <span className="text-label" style={{ fontSize: 9, color: hasOnChain ? 'var(--mint)' : '#aaa' }}>
              {quoteLoading ? 'FETCHING…' : priceTip}
            </span>
          </div>

          {/* Price display */}
          <div style={{ padding: 'clamp(24px,3vw,40px) 24px', borderBottom: '1px solid var(--border)', flex: 1 }}>
            {legs.length > 0 ? (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                {legs.map((leg, i) => (
                  <span key={leg.marketId} style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                    <span style={{ fontSize: 'clamp(28px,4vw,52px)', fontWeight: 800 }}>{leg.price.toFixed(2)}</span>
                    {i < legs.length - 1 && <span style={{ fontSize: 24, color: '#ccc' }}>×</span>}
                  </span>
                ))}
                <span style={{ fontSize: 24, color: '#ccc' }}>=</span>
                <span style={{ fontSize: 'clamp(28px,4vw,52px)', fontWeight: 800 }}>
                  {quoteLoading ? '…' : displayPrice.toFixed(3)}
                </span>
              </div>
            ) : (
              <p style={{ color: '#ccc', fontSize: 20 }}>Add legs to see pricing</p>
            )}
          </div>

          {/* Stake input */}
          <div style={{ padding: '24px', borderBottom: '1px solid var(--border)' }}>
            <span className="text-label" style={{ display: 'block', marginBottom: 10, fontSize: 10 }}>■ STAKE (USDC)</span>
            <input
              type="number" min="1" placeholder="0.00" value={amount}
              onChange={e => setAmount(e.target.value)}
              style={{ background: 'transparent', border: 'none', borderBottom: '2px solid var(--black)', fontSize: 'clamp(32px,5vw,56px)', fontWeight: 800, letterSpacing: '-0.03em', outline: 'none', width: '100%', padding: '6px 0' }}
            />
          </div>

          {/* Pay / Win summary row */}
          {stake > 0 && legs.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid var(--border)' }}>
              <div style={{ padding: '16px 24px', borderRight: '1px solid var(--border)' }}>
                <div className="text-label" style={{ fontSize: 9, color: '#888', marginBottom: 4 }}>YOU PAY</div>
                <div style={{ fontSize: 28, fontWeight: 800 }}>${stake.toFixed(2)}</div>
              </div>
              <div style={{ padding: '16px 24px', background: 'var(--mint)' }}>
                <div className="text-label" style={{ fontSize: 9, color: '#555', marginBottom: 4 }}>YOU WIN</div>
                <div style={{ fontSize: 28, fontWeight: 800 }}>${quoteLoading ? '…' : displayPayout.toFixed(2)}</div>
              </div>
            </div>
          )}

          {/* OddsFlow-style description rows */}
          {legs.length > 0 && (
            <div style={{ borderBottom: '1px solid var(--border)' }}>
              {[
                {
                  label: 'Moves',
                  value: stake > 0
                    ? `$${stake.toFixed(2)} USDC from your wallet via 1inch Aqua`
                    : 'Enter a stake to see what moves',
                },
                {
                  label: 'What happens',
                  value: stake > 0
                    ? `You receive a parlay ticket. If all ${legs.length} leg${legs.length > 1 ? 's' : ''} resolve in your favor, the ticket pays out $${quoteLoading ? '…' : displayPayout.toFixed(2)} USDC.`
                    : `You receive a parlay ticket covering ${legs.length} leg${legs.length > 1 ? 's' : ''}. It pays out if every selected outcome wins.`,
                },
                {
                  label: 'What does not',
                  value: stake > 0
                    ? `Parlay Markets gets no approval beyond the exact stake of $${stake.toFixed(2)} USDC.`
                    : 'Parlay Markets gets no approval beyond the exact stake amount.',
                },
                {
                  label: 'Undo',
                  value: `Irreversible once confirmed. ${legs.length > 0 ? `Ticket pays $${quoteLoading ? '…' : displayPayout.toFixed(2)} USDC if ${legs.map(l => l.outcome).join(' and ')} win${legs.length > 1 ? '' : 's'}.` : ''}`,
                },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'grid', gridTemplateColumns: '110px 1fr', borderBottom: '1px solid var(--border)', padding: '12px 24px', gap: 16, alignItems: 'start' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#888', paddingTop: 1 }}>{label}</span>
                  <span style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--black)' }}>{value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Big buy button */}
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <BuyParlayButton
              markets={onChainMarkets}
              outcomeIdxs={legs.map(l => l.outcomeIdx ?? 0)}
              stakeUsdc={stake}
              hasOnChain={hasOnChain}
              stakeLabel={stake > 0 ? `Buy parlay for $${stake.toFixed(2)} USDC` : undefined}
              onSuccess={clearLegs}
            />
            <button style={{ width: '100%', padding: '14px', background: 'var(--white)', color: 'var(--black)', border: '1px solid var(--black)', cursor: 'pointer', fontWeight: 700, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              SHARE SLIP →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
