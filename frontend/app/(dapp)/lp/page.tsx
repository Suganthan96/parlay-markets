'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { useReadContract, useReadContracts } from 'wagmi';
import { formatUnits } from 'viem';
import { MARKET_ADDRESSES, LMSR_MARKET_ABI, PARLAY_VAULT_ABI, PARLAY_VAULT_ADDRESS } from '@/lib/contracts';
import {
  useMarketInfo, useUsdcBalance, useShipLiquidity, useDockLiquidity,
  useRequestSettlement,
} from '@/lib/hooks';

// ── Market row ────────────────────────────────────────────────────────────────

function MarketRow({ address }: { address: `0x${string}` }) {
  const info = useMarketInfo(address);
  const { ship, isPending: isShipping } = useShipLiquidity(address);
  const { dock, isPending: isDocking  } = useDockLiquidity(address);
  const { requestSettlement, isPending: isRequesting } = useRequestSettlement();

  const [shipAmount, setShipAmount] = useState('');
  const [bValue,     setBValue]     = useState('');
  const [showShip,   setShowShip]   = useState(false);

  const { data: lpAddr } = useReadContract({
    address, abi: LMSR_MARKET_ABI, functionName: 'lp',
  });

  const { address: connectedAddr } = useAccount();
  const isLp = lpAddr && connectedAddr && (lpAddr as string).toLowerCase() === connectedAddr.toLowerCase();

  if (!info?.homeTeam) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', padding: '16px 24px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
        <span className="text-label" style={{ fontSize: 10, color: '#bbb' }}>LOADING… {address.slice(0, 10)}…</span>
      </div>
    );
  }

  const resolved = info.result !== 0;
  const matchId  = `0x${Buffer.from(`${info.homeTeam}-${info.awayTeam}-${info.kickoff}`).toString('hex').padEnd(64, '0').slice(0, 64)}` as `0x${string}`;

  async function handleShip() {
    const amt = parseFloat(shipAmount);
    const b   = BigInt(Math.round(parseFloat(bValue) * 1e18));
    if (!amt || !b) return;
    await ship(amt, b);
    setShowShip(false);
    setShipAmount('');
    setBValue('');
  }

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', padding: '16px 24px', borderBottom: '1px solid var(--border)', alignItems: 'center', gap: 8 }}>
        <div>
          <span style={{ fontWeight: 600 }}>{info.homeTeam} vs {info.awayTeam}</span>
          <div className="text-label" style={{ fontSize: 9, color: '#aaa', marginTop: 2 }}>{address.slice(0, 20)}…</div>
        </div>
        <span>
          <span className="text-label" style={{ fontSize: 10, padding: '3px 8px', background: resolved ? '#eee' : isLp ? 'var(--mint)' : 'var(--light-gray, #f4f4f4)' }}>
            {resolved ? 'RESOLVED' : isLp ? 'SHIPPED' : 'OPEN'}
          </span>
        </span>
        <span style={{ fontWeight: 600 }}>
          {info.homePrice.toFixed(3)} / {info.awayPrice.toFixed(3)}
        </span>
        <span className="text-label" style={{ fontSize: 10 }}>{resolved ? `WIN: ${info.result === 1 ? info.homeTeam : info.result === 2 ? info.awayTeam : 'DRAW'}` : 'LIVE'}</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {!resolved && !isLp && (
            <button onClick={() => setShowShip(v => !v)} style={{ padding: '6px 12px', background: 'var(--black)', color: 'var(--white)', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              SHIP →
            </button>
          )}
          {!resolved && isLp && (
            <button onClick={() => dock()} disabled={isDocking} style={{ padding: '6px 10px', background: 'var(--white)', color: 'var(--black)', border: '1px solid var(--border)', cursor: 'pointer', fontWeight: 700, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {isDocking ? '…' : 'DOCK'}
            </button>
          )}
          {!resolved && (
            <button
              onClick={() => requestSettlement(matchId, address)}
              disabled={isRequesting}
              style={{ padding: '6px 10px', background: 'var(--white)', color: 'var(--black)', border: '1px solid var(--border)', cursor: 'pointer', fontWeight: 700, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase' }}
            >
              {isRequesting ? '…' : 'SETTLE'}
            </button>
          )}
        </div>
      </div>

      {/* Ship form */}
      {showShip && (
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', background: '#fafafa', display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <div>
            <label className="text-label" style={{ display: 'block', marginBottom: 6, fontSize: 9 }}>■ AMOUNT (USDC)</label>
            <input value={shipAmount} onChange={e => setShipAmount(e.target.value)} placeholder="500"
              style={{ border: '1px solid var(--border)', padding: '8px 12px', fontSize: 14, fontWeight: 600, width: 120, outline: 'none', fontFamily: 'inherit' }} />
          </div>
          <div>
            <label className="text-label" style={{ display: 'block', marginBottom: 6, fontSize: 9 }}>■ LIQUIDITY PARAM b</label>
            <input value={bValue} onChange={e => setBValue(e.target.value)} placeholder="100"
              style={{ border: '1px solid var(--border)', padding: '8px 12px', fontSize: 14, fontWeight: 600, width: 100, outline: 'none', fontFamily: 'inherit' }} />
          </div>
          <button onClick={handleShip} disabled={isShipping} style={{ padding: '8px 16px', background: 'var(--mint)', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {isShipping ? 'CONFIRMING…' : 'CONFIRM SHIP →'}
          </button>
          <button onClick={() => setShowShip(false)} style={{ padding: '8px 12px', background: 'transparent', border: '1px solid var(--border)', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>CANCEL</button>
        </div>
      )}
    </>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function LpPage() {
  const { address, isConnected } = useAccount();
  const { formatted: usdcBal } = useUsdcBalance(address);

  // Count total on-chain tickets for pnl display
  const { data: nextId } = useReadContract({
    address: PARLAY_VAULT_ADDRESS, abi: PARLAY_VAULT_ABI, functionName: 'nextTicketId',
  });
  const totalTickets = Number(nextId ?? 0);

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>
      {/* Headline */}
      <div style={{ background: 'var(--white)', padding: 'clamp(32px,5vw,72px) clamp(24px,4vw,56px)', borderBottom: '1px solid var(--border)' }}>
        <p className="text-label" style={{ color: '#aaa', marginBottom: 16, fontSize: 10 }}>■ LP CONSOLE · 1INCH AQUA × LMSR</p>
        <h1 className="text-display" style={{ fontSize: 'clamp(56px,9vw,140px)' }}>BE THE<br/>HOUSE.</h1>
      </div>

      {/* Stat row */}
      <div className="page-grid" style={{ background: 'var(--border)', borderBottom: '1px solid var(--border)' }}>
        {[
          { label: 'WALLET USDC',      value: isConnected ? `$${usdcBal}` : '—',      note: 'stays in your wallet (Aqua)', bg: 'var(--white)' },
          { label: 'MARKETS DEPLOYED', value: String(MARKET_ADDRESSES.length),          note: 'LMSR + Aqua extruction',     bg: 'var(--white)' },
          { label: 'TICKETS SOLD',     value: String(totalTickets),                     note: 'all parlays on-chain',       bg: 'var(--white)' },
          { label: 'LP MODEL',         value: 'b × ln N',                               note: 'bounded max-loss per market',bg: 'var(--mint)'  },
        ].map(s => (
          <div key={s.label} className="gc-1" style={{ background: s.bg, padding: 'clamp(20px,3vw,36px) 24px' }}>
            <span className="text-label" style={{ display: 'block', marginBottom: 12, fontSize: 10 }}>■ {s.label}</span>
            <div style={{ fontSize: 'clamp(32px,4vw,56px)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1 }}>{s.value}</div>
            <div className="text-label" style={{ marginTop: 10, fontSize: 10, color: '#888' }}>{s.note}</div>
          </div>
        ))}
      </div>

      {/* Market table */}
      <div style={{ background: 'var(--white)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="text-label" style={{ fontSize: 10 }}>■ MARKET STRATEGIES · SHIP / DOCK / SETTLE</span>
          <span className="text-label" style={{ fontSize: 9, color: '#aaa' }}>SETTLE → emits SettlementRequested → Chainlink CRE resolves</span>
        </div>
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', padding: '10px 24px', borderBottom: '1px solid var(--border)', background: '#fafafa' }}>
          {['MATCH', 'STATUS', 'ODDS (H/A)', 'RESULT', 'ACTIONS'].map(h => (
            <span key={h} className="text-label" style={{ fontSize: 10, color: '#888' }}>{h}</span>
          ))}
        </div>

        {MARKET_ADDRESSES.length === 0 ? (
          <div style={{ padding: 32 }}>
            <span className="text-label" style={{ fontSize: 10, color: '#aaa' }}>NO MARKETS — set NEXT_PUBLIC_MARKETS=0xABC,0xDEF</span>
          </div>
        ) : MARKET_ADDRESSES.map(addr => (
          <MarketRow key={addr} address={addr} />
        ))}
      </div>

      {/* How it works */}
      <div style={{ background: 'var(--black)', color: 'var(--white)', padding: '32px 24px', borderBottom: '1px solid var(--border)' }}>
        <span className="text-label" style={{ display: 'block', marginBottom: 20, color: '#666', fontSize: 10 }}>■ HOW IT WORKS · LMSR × 1INCH AQUA</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 24 }}>
          {[
            { n: '01', title: 'SHIP',   body: 'Lock USDC into LmsrMarket. Funds stay in your wallet — Aqua handles virtual liquidity.' },
            { n: '02', title: 'QUOTE',  body: 'Takers call quoteParlay → ParlayLmsrExtruction computes combined LMSR price × 1.1 margin.' },
            { n: '03', title: 'SETTLE', body: 'Click SETTLE → emits event → Chainlink CRE fetches ESPN result → resolves on-chain.' },
            { n: '04', title: 'DOCK',   body: 'Once market resolves, dock to withdraw remaining USDC minus payouts.' },
          ].map(s => (
            <div key={s.n}>
              <div style={{ fontSize: 48, fontWeight: 800, letterSpacing: '-0.04em', color: '#333', lineHeight: 1 }}>{s.n}</div>
              <div style={{ fontWeight: 700, fontSize: 13, marginTop: 8, letterSpacing: '0.06em' }}>{s.title}</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 6, lineHeight: 1.5 }}>{s.body}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
