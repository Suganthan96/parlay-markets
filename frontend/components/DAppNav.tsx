'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { sepolia, baseSepolia } from 'wagmi/chains';
import AspenLogo from './AspenLogo';
import { useUsdcBalance } from '@/lib/hooks';
import { useParlayStore } from '@/lib/store';

const NAV = [
  { label: 'Markets', href: '/markets' },
  { label: 'Parlay',  href: '/parlay'  },
  { label: 'Tickets', href: '/tickets' },
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

async function addAndSwitchToBase() {
  const eth = (window as any).ethereum;
  if (!eth) return;
  await eth.request({ method: 'eth_requestAccounts' });
  try {
    await eth.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: '0x14a34',
        chainName: 'Base Sepolia Testnet',
        nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
        rpcUrls: ['https://sepolia.base.org', 'https://base-sepolia-rpc.publicnode.com'],
        blockExplorerUrls: ['https://sepolia.basescan.org'],
      }],
    });
  } catch {
    await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x14a34' }] });
  }
}

function WalletButton() {
  const { address, isConnected } = useAccount();
  const { connect }              = useConnect();
  const { disconnect }           = useDisconnect();
  const chainId                  = useChainId();
  const { switchChain }          = useSwitchChain();
  const { formatted: usdc }      = useUsdcBalance(address);

  const onSepolia     = chainId === sepolia.id;
  const onBaseSepolia = chainId === baseSepolia.id;
  const wrongChain    = isConnected && !onSepolia && !onBaseSepolia;

  if (!isConnected) {
    return (
      <button
        onClick={() => connect({ connector: injected() })}
        style={{ display: 'flex', alignItems: 'center', padding: '0 24px', height: '100%', background: 'var(--black)', color: 'var(--white)', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}
      >
        CONNECT →
      </button>
    );
  }

  if (wrongChain) {
    return (
      <button
        onClick={() => switchChain({ chainId: sepolia.id })}
        style={{ display: 'flex', alignItems: 'center', padding: '0 24px', height: '100%', background: '#c00', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}
      >
        ⚠ SWITCH TO SEPOLIA
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'stretch' }}>
      {/* Wallet info */}
      <button
        onClick={() => disconnect()}
        title="Click to disconnect"
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px', height: '100%', background: 'var(--black)', color: 'var(--white)', border: 'none', cursor: 'pointer', textAlign: 'left', borderRight: '1px solid #333' }}
      >
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="text-label" style={{ fontSize: 9, color: onBaseSepolia ? '#6366f1' : '#888' }}>
            ■ {onBaseSepolia ? 'BASE SEPOLIA' : 'SEPOLIA'} · {onBaseSepolia ? 'ETH' : 'USDC'}
          </span>
          <span style={{ fontWeight: 800, fontSize: 12, letterSpacing: '-0.01em' }}>
            {onBaseSepolia ? address?.slice(0, 6) + '…' + address?.slice(-4) : `$${usdc}`}
          </span>
        </span>
        {!onBaseSepolia && (
          <span className="text-label" style={{ fontSize: 9, color: '#555' }}>{address?.slice(0, 6)}…{address?.slice(-4)}</span>
        )}
      </button>

      {/* Chain toggle */}
      <button
        onClick={() => onBaseSepolia ? switchChain({ chainId: sepolia.id }) : addAndSwitchToBase()}
        title={onBaseSepolia ? 'Switch to Ethereum Sepolia' : 'Switch to Base Sepolia for CCIP'}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 16px', height: '100%', background: onBaseSepolia ? '#2151f5' : '#1a1a1a', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}
      >
        {onBaseSepolia ? '⇄ ETH SEPOLIA' : '⇄ BASE'}
      </button>
    </div>
  );
}

export function DAppNav() {
  const path      = usePathname();
  const legCount  = useParlayStore(s => s.legs.length);
  const ticketMetaCount = useParlayStore(s => Object.keys(s.ticketMeta).length);

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
                {n.href === '/parlay' && legCount > 0 && (
                  <span style={{ marginLeft: 6, background: 'var(--mint)', color: 'var(--black)', fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 2 }}>
                    {legCount}
                  </span>
                )}
                {n.href === '/tickets' && ticketMetaCount > 0 && (
                  <span style={{ marginLeft: 6, background: '#6366f1', color: '#fff', fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 2 }}>
                    {ticketMetaCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Wallet */}
        <WalletButton />
      </div>

    </header>
  );
}
