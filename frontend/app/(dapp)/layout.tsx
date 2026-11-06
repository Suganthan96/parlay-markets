import type { ReactNode } from 'react';
import { DAppNav } from '@/components/DAppNav';
import UsdcFaucet from '@/components/UsdcFaucet';

export default function DAppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <DAppNav />
      <UsdcFaucet />
      <main style={{ background: '#EFEDE8', minHeight: '100vh' }}>{children}</main>
      <footer style={{ borderTop: '1px solid var(--app-border)', background: 'var(--white)' }}>
        <div style={{ maxWidth: 1440, margin: '0 auto', padding: '16px 24px', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>
          <p className="text-label" style={{ color: '#888', fontSize: 10 }}>
            HACKATHON PROTOTYPE · TESTNET/FORK ONLY · BUILT ON 1INCH AQUA + SWAPVM · RESULTS BY CHAINLINK CRE · DATA ON ARKIV
          </p>
        </div>
      </footer>
    </>
  );
}
