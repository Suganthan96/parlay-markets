'use client';

import { useState } from 'react';
import { MOCK_TICKETS } from '@/lib/mock';
import type { Ticket } from '@/lib/types';

type Tab = 'open' | 'won' | 'lost' | 'cashed_out';

function LegChip({ status, label }: { status: 'won' | 'live' | 'lost'; label: string }) {
  const bg = status === 'won' ? 'var(--mint)' : status === 'lost' ? '#fee' : 'var(--light-gray)';
  const border = status === 'lost' ? '1px solid var(--loss,#FF5A4E)' : '1px solid var(--border)';
  const col = status === 'lost' ? '#FF5A4E' : 'var(--black)';
  return (
    <span style={{ padding: '3px 10px', background: bg, border, color: col, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
      {status === 'won' ? '✓' : status === 'lost' ? '✕' : '●'} {label}
    </span>
  );
}

function TicketCard({ ticket }: { ticket: Ticket }) {
  const allWon  = ticket.legs.every(l => l.status === 'won');
  const anyLost = ticket.legs.some(l => l.status === 'lost');

  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)' }}>
      <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
        <span className="text-label" style={{ fontSize: 10 }}>■ TICKET {ticket.id.toUpperCase()}</span>
        <span className="text-label" style={{ fontSize: 10, color: '#aaa' }}>{new Date(ticket.boughtAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
      </div>

      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {ticket.legs.map((leg, i) => <LegChip key={i} status={leg.status} label={leg.marketLabel} />)}
      </div>

      <div className="page-grid" style={{ background: 'var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div className="gc-1" style={{ background: 'var(--white)', padding: '16px 20px' }}>
          <span className="text-label" style={{ display: 'block', marginBottom: 6, fontSize: 10 }}>■ STAKE</span>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>${ticket.stakeUsdc.toFixed(2)}</div>
        </div>
        <div className="gc-2" style={{ background: 'var(--white)', padding: '16px 20px' }}>
          <span className="text-label" style={{ display: 'block', marginBottom: 6, fontSize: 10 }}>■ IF WIN</span>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>${ticket.payoutUnits.toFixed(2)}</div>
        </div>
        <div className="gc-3-4" style={{ background: 'var(--white)', padding: '16px 20px' }}>
          <span className="text-label" style={{ display: 'block', marginBottom: 6, fontSize: 10 }}>■ CASH OUT VALUE</span>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>${ticket.cashOutValue.toFixed(2)}</div>
        </div>
      </div>

      <div style={{ padding: '16px 20px' }}>
        {ticket.status === 'open' && allWon && (
          <button style={{ width: '100%', padding: '14px', background: 'var(--mint)', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            CLAIM ${ticket.payoutUnits.toFixed(2)} →
          </button>
        )}
        {ticket.status === 'open' && !allWon && !anyLost && (
          <button style={{ width: '100%', padding: '14px', background: 'var(--black)', color: 'var(--white)', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            CASH OUT NOW ${ticket.cashOutValue.toFixed(2)} →
          </button>
        )}
        {ticket.status === 'open' && anyLost && (
          <span className="text-label" style={{ fontSize: 10, color: '#FF5A4E' }}>■ TICKET LOST</span>
        )}
        {ticket.status === 'won' && (
          <button style={{ width: '100%', padding: '14px', background: 'var(--mint)', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            CLAIM $100 →
          </button>
        )}
      </div>
    </div>
  );
}

export default function TicketsPage() {
  const [tab, setTab] = useState<Tab>('open');
  const filtered = MOCK_TICKETS.filter(t =>
    tab === 'open' ? t.status === 'open' :
    tab === 'won'  ? t.status === 'won'  :
    tab === 'lost' ? t.status === 'lost' :
    t.status === 'cashed_out'
  );

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>
      {/* Headline */}
      <div style={{ background: 'var(--black)', padding: 'clamp(32px,5vw,72px) clamp(24px,4vw,56px)', borderBottom: '1px solid var(--border)' }}>
        <p className="text-label" style={{ color: '#555', marginBottom: 16, fontSize: 10 }}>■ MY TICKETS · PARLAYAULT</p>
        <h1 className="text-display" style={{ color: 'var(--white)', fontSize: 'clamp(56px,9vw,140px)' }}>CASH OUT<br/>LIVE.</h1>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--white)' }}>
        {(['open', 'won', 'lost', 'cashed_out'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '14px 24px', borderRight: '1px solid var(--border)', background: tab === t ? 'var(--black)' : 'transparent', color: tab === t ? 'var(--white)' : 'var(--black)', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {t.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Ticket list */}
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--border)' }}>
        {filtered.length === 0 ? (
          <div style={{ background: 'var(--white)', padding: 48, textAlign: 'center' }}>
            <span className="text-label" style={{ color: '#aaa', fontSize: 10 }}>NO TICKETS IN THIS TAB.</span>
          </div>
        ) : filtered.map(t => <TicketCard key={t.id} ticket={t} />)}
      </div>
    </div>
  );
}
