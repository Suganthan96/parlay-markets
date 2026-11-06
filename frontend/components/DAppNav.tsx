'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import AspenLogo from './AspenLogo';

const NAV = [
  { label: 'Markets', href: '/markets' },
  { label: 'Parlay',  href: '/parlay'  },
  { label: 'Tickets', href: '/tickets' },
  { label: 'Slips',   href: '/slips'   },
  { label: 'LP',      href: '/lp'      },
];

function LiveClock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const tick = () => {
      const t = new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
      });
      setTime(`${t} IST`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="text-label" style={{ fontSize: 10 }}>{time}</span>;
}

export function DAppNav() {
  const path = usePathname();

  return (
    <header className="sticky top-0 z-50 bg-white" style={{ borderBottom: '1px solid var(--border)' }}>
      <div
        className="hidden md:grid"
        style={{ maxWidth: 1440, margin: '0 auto', gridTemplateColumns: 'auto auto 1fr auto', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}
      >
        {/* Logo */}
        <Link
          href="/"
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px', height: 56, borderRight: '1px solid var(--border)', textDecoration: 'none', color: 'var(--black)' }}
        >
          <AspenLogo size={18} />
          <span style={{ fontWeight: 700, fontSize: 12, letterSpacing: '0.06em' }}>PARLAY</span>
        </Link>

        {/* Clock */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 20px', borderRight: '1px solid var(--border)' }}>
          <LiveClock />
        </div>

        {/* Nav links */}
        <nav style={{ display: 'flex' }}>
          {NAV.map(n => {
            const active = path === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 20px',
                  height: 56,
                  borderRight: '1px solid var(--border)',
                  textDecoration: 'none',
                  fontWeight: 600,
                  fontSize: 11,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: active ? 'var(--white)' : 'var(--black)',
                  background: active ? 'var(--black)' : 'transparent',
                }}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>

        {/* Wallet placeholder */}
        <div
          style={{ display: 'flex', alignItems: 'center', padding: '0 24px', background: 'var(--black)', color: 'var(--white)' }}
        >
          <span className="text-label" style={{ fontSize: 10 }}>
            {process.env.NEXT_PUBLIC_MOCK === 'true' ? '● MOCK MODE' : '● SEPOLIA'}
          </span>
        </div>
      </div>

      {/* Mobile */}
      <div className="md:hidden" style={{ display: 'flex', alignItems: 'center', padding: '0 16px', height: 52, gap: 8, overflowX: 'auto', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none', color: 'var(--black)', marginRight: 8, flexShrink: 0 }}>
          <AspenLogo size={16} />
        </Link>
        {NAV.map(n => {
          const active = path === n.href;
          return (
            <Link
              key={n.href}
              href={n.href}
              style={{
                padding: '6px 12px',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: 10,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: active ? 'var(--white)' : 'var(--black)',
                background: active ? 'var(--black)' : 'var(--light-gray)',
                flexShrink: 0,
              }}
            >
              {n.label}
            </Link>
          );
        })}
      </div>
    </header>
  );
}
