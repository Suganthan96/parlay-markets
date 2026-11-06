'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { useReadContract, useReadContracts } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import {
  MARKET_ADDRESSES, LMSR_MARKET_ABI, PARLAY_VAULT_ABI, PARLAY_VAULT_ADDRESS,
  AQUA_ADDRESS, AQUA_PARLAY_ROUTER_ADDRESS, DEFAULT_STRATEGY_HASH,
} from '@/lib/contracts';
import {
  useMarketInfo, useUsdcBalance, useShipLiquidity,
  useApproveAqua, useAquaAllowance, useLpShipAqua, useLpDockAqua,
  useRequestSettlement, useSetCRE, useReadCRE,
} from '@/lib/hooks';
import { CRE_FORWARDER_ADDRESS } from '@/lib/contracts';
import { TxLink, AddrLink } from '@/components/ui/TxLink';
import { MOCK_USDC_ADDRESS } from '@/lib/contracts';

// ── Step indicator ────────────────────────────────────────────────────────────

function Step({ n, title, done, active }: { n: string; title: string; done: boolean; active: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', opacity: active || done ? 1 : 0.4 }}>
      <div style={{ width: 32, height: 32, border: `2px solid ${done ? 'var(--mint)' : active ? 'var(--black)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', background: done ? 'var(--mint)' : 'transparent', flexShrink: 0 }}>
        <span style={{ fontWeight: 800, fontSize: 11 }}>{done ? '✓' : n}</span>
      </div>
      <span style={{ fontWeight: 700, fontSize: 12, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{title}</span>
    </div>
  );
}

// ── CRE Forwarder Panel ───────────────────────────────────────────────────────

function CreForwarderPanel() {
  const currentCre              = useReadCRE();
  const { setCRE, isPending, isSuccess, txHash } = useSetCRE();
  const [input, setInput]       = useState('');

  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 24 }}>
        <div>
          <span className="text-label" style={{ fontSize: 9, color: '#888', display: 'block', marginBottom: 4 }}>■ CURRENT CRE FORWARDER</span>
          <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{currentCre ?? '(loading…)'}</span>
        </div>
        <div>
          <span className="text-label" style={{ fontSize: 9, color: '#888', display: 'block', marginBottom: 4 }}>■ KNOWN SEPOLIA FORWARDER</span>
          <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{CRE_FORWARDER_ADDRESS}</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="0x… new forwarder address"
          style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--border)', fontSize: 11, fontFamily: 'monospace' }}
        />
        <button
          onClick={() => input.startsWith('0x') && setCRE(input as `0x${string}`)}
          disabled={!input.startsWith('0x') || isPending}
          style={{ padding: '8px 20px', background: 'var(--black)', color: 'var(--white)', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: input.startsWith('0x') ? 1 : 0.4 }}
        >
          {isPending ? 'SENDING…' : 'SET CRE'}
        </button>
        {isSuccess && txHash && <TxLink hash={txHash} />}
        {isSuccess && <span className="text-label" style={{ fontSize: 10, color: 'var(--mint)' }}>■ UPDATED</span>}
      </div>
    </div>
  );
}

// ── LP Ship Wizard ────────────────────────────────────────────────────────────

function LpShipWizard() {
  const { address } = useAccount();
  const [lmsrAmount,    setLmsrAmount]    = useState('5');
  const [bValue,        setBValue]        = useState('100');
  const [reserveAmount, setReserveAmount] = useState('500');
  const [selectedMkt,   setSelectedMkt]   = useState(MARKET_ADDRESSES[0] ?? '');
  const [aquaShipped,   setAquaShipped]   = useState(false);
  const [shipTxHash,    setShipTxHash]    = useState<`0x${string}` | undefined>();

  const { ship,         isPending: isShipping  } = useShipLiquidity(selectedMkt as `0x${string}`);
  const { approveAqua,  isPending: isApproving } = useApproveAqua();
  const { lpShipAqua,   isPending: isShippingAqua, isSuccess: aquaShipSuccess, txHash: aquaTxHash } = useLpShipAqua();
  const { requestSettlement } = useRequestSettlement();

  const aquaAllowance = useAquaAllowance(address);
  const reserveRaw    = parseUnits(reserveAmount || '0', 6);

  // Real on-chain state
  const hasAllowance = aquaAllowance > 0n;
  const isLpActive   = hasAllowance || aquaShipped || aquaShipSuccess;

  // Derive step from real chain state
  const step     = isLpActive ? 4 : hasAllowance ? 3 : 2;
  const lmsrDone = true; // markets already seeded from deploy
  const aquaApproved = hasAllowance;

  async function handleLmsrShip() {
    const amt = parseFloat(lmsrAmount);
    const b   = BigInt(Math.round(parseFloat(bValue) * 1e18));
    if (!amt || !b) return;
    await ship(amt, b);
  }

  async function handleApproveAqua() {
    await approveAqua(reserveRaw);
  }

  async function handleShipAqua() {
    const markets = MARKET_ADDRESSES.length > 0 ? MARKET_ADDRESSES : [selectedMkt as `0x${string}`];
    const hash = await lpShipAqua(markets as `0x${string}`[], reserveRaw);
    if (hash) setShipTxHash(hash as `0x${string}`);
    setAquaShipped(true);
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 1, background: 'var(--border)' }}>
      {/* Steps */}
      <div style={{ background: 'var(--white)', padding: '24px' }}>
        <span className="text-label" style={{ display: 'block', marginBottom: 20, fontSize: 10 }}>■ LP ONBOARDING STEPS</span>
        <Step n="1" title="Seed LMSR pricing"     done={lmsrDone}   active={step === 1} />
        <Step n="2" title="Approve Aqua"           done={hasAllowance} active={step === 2} />
        <Step n="3" title="Ship to Aqua"           done={isLpActive}   active={step === 3} />
        <Step n="4" title="Ready — users can buy"  done={isLpActive}   active={step === 4} />

        <div style={{ marginTop: 24, padding: '16px', background: '#f5f5f5', fontSize: 11, lineHeight: 1.6 }}>
          <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 10 }}>■ KEY: YOUR USDC STAYS IN YOUR WALLET</div>
          <div style={{ color: '#666', fontSize: 10 }}>1inch Aqua records a virtual balance. When a user buys a winning parlay, Aqua calls <code>transferFrom</code> on your wallet — not before.</div>
        </div>
      </div>

      {/* Active step form */}
      <div style={{ background: 'var(--white)', padding: '24px' }}>
        {step === 1 && (
          <>
            <span className="text-label" style={{ display: 'block', marginBottom: 20, fontSize: 10 }}>■ STEP 1 · SEED LMSR MARKET PRICING</span>
            <p style={{ fontSize: 13, color: '#666', marginBottom: 20, lineHeight: 1.6 }}>
              USDC goes into the LmsrMarket contract to establish opening odds. The <strong>b</strong> parameter sets your max loss = b × ln(N).
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div>
                <label className="text-label" style={{ display: 'block', marginBottom: 6, fontSize: 9 }}>■ MARKET</label>
                <select value={selectedMkt} onChange={e => setSelectedMkt(e.target.value)}
                  style={{ border: '1px solid var(--border)', padding: '8px', fontSize: 11, width: '100%', fontFamily: 'inherit' }}>
                  {MARKET_ADDRESSES.map(a => <option key={a} value={a}>{a.slice(0,10)}…</option>)}
                </select>
              </div>
              <div>
                <label className="text-label" style={{ display: 'block', marginBottom: 6, fontSize: 9 }}>■ USDC AMOUNT</label>
                <input value={lmsrAmount} onChange={e => setLmsrAmount(e.target.value)}
                  style={{ border: '1px solid var(--border)', padding: '8px', fontSize: 13, fontWeight: 700, width: '100%', fontFamily: 'inherit', outline: 'none' }} />
              </div>
              <div>
                <label className="text-label" style={{ display: 'block', marginBottom: 6, fontSize: 9 }}>■ LIQUIDITY PARAM b</label>
                <input value={bValue} onChange={e => setBValue(e.target.value)}
                  style={{ border: '1px solid var(--border)', padding: '8px', fontSize: 13, fontWeight: 700, width: '100%', fontFamily: 'inherit', outline: 'none' }} />
              </div>
            </div>
            <button onClick={handleLmsrShip} disabled={isShipping}
              style={{ padding: '12px 24px', background: 'var(--black)', color: 'var(--white)', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {isShipping ? 'CONFIRMING…' : '1. SHIP TO LMSR →'}
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <span className="text-label" style={{ display: 'block', marginBottom: 20, fontSize: 10 }}>■ STEP 2 · APPROVE 1INCH AQUA TO PULL YOUR USDC</span>
            <p style={{ fontSize: 13, color: '#666', marginBottom: 20, lineHeight: 1.6 }}>
              You approve Aqua (<code style={{ fontSize: 11 }}>0x1111113CCf…</code>) to call <code>transferFrom</code> on your wallet when users win parlays. Your USDC <strong>does not move</strong> until then.
            </p>
            <div style={{ marginBottom: 20 }}>
              <label className="text-label" style={{ display: 'block', marginBottom: 6, fontSize: 9 }}>■ PAYOUT RESERVE (MAX AQUA CAN PULL)</label>
              <input value={reserveAmount} onChange={e => setReserveAmount(e.target.value)}
                style={{ border: '1px solid var(--border)', padding: '8px', fontSize: 22, fontWeight: 800, width: 160, fontFamily: 'inherit', outline: 'none' }} />
              <span style={{ marginLeft: 8, fontSize: 13, color: '#888' }}>USDC</span>
            </div>
            {hasAllowance ? (
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <span className="text-label" style={{ fontSize: 10, color: 'var(--mint)' }}>✓ ALREADY APPROVED ON-CHAIN ({Number(formatUnits(aquaAllowance, 6)).toFixed(2)} USDC)</span>
              </div>
            ) : (
              <button onClick={handleApproveAqua} disabled={isApproving || !reserveAmount}
                style={{ padding: '12px 24px', background: 'var(--black)', color: 'var(--white)', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {isApproving ? 'APPROVING…' : '2. APPROVE AQUA →'}
              </button>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <span className="text-label" style={{ display: 'block', marginBottom: 20, fontSize: 10 }}>■ STEP 3 · SHIP VIRTUAL LIQUIDITY TO 1INCH AQUA</span>
            <p style={{ fontSize: 13, color: '#666', marginBottom: 20, lineHeight: 1.6 }}>
              Calls <code>Aqua.ship(app=AquaParlayRouter, strategy=abi.encode(markets), [usdc], [{reserveAmount}])</code>. Aqua records your virtual balance. Users can now route parlays through Aqua — your USDC pays out only on wins.
            </p>
            <div style={{ background: '#f5f5f5', padding: '16px', marginBottom: 20, fontFamily: 'monospace', fontSize: 11 }}>
              <div>app: {AQUA_PARLAY_ROUTER_ADDRESS}</div>
              <div>strategy: abi.encode([{MARKET_ADDRESSES.join(', ')}])</div>
              <div>tokens: [{process.env.NEXT_PUBLIC_MOCK_USDC ?? '0x14e8…'}]</div>
              <div>amounts: [{reserveAmount} USDC]</div>
            </div>
            <button onClick={handleShipAqua} disabled={isShippingAqua}
              style={{ padding: '12px 24px', background: 'var(--black)', color: 'var(--white)', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {isShippingAqua ? 'SHIPPING TO AQUA…' : '3. SHIP TO AQUA →'}
            </button>
          </>
        )}

        {step === 4 && (
          <>
            <span className="text-label" style={{ display: 'block', marginBottom: 20, fontSize: 10, color: 'var(--mint)' }}>■ ✓ LP ACTIVE ON-CHAIN — READY FOR USERS</span>
            <div style={{ background: 'var(--mint)', padding: '20px', marginBottom: 20 }}>
              <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>Virtual liquidity active</div>
              <div style={{ fontSize: 12, lineHeight: 1.6 }}>Your USDC is still in your wallet. When users buy parlays through AquaParlayRouter, Aqua calls <code>transferFrom(you)</code> only on payouts.</div>
            </div>
            <div style={{ background: '#f5f5f5', padding: '16px', fontFamily: 'monospace', fontSize: 10, marginBottom: 20, lineHeight: 2.2 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#888' }}>Aqua allowance (on-chain)</span>
                <span style={{ fontWeight: 700, color: 'var(--black)' }}>{Number(formatUnits(aquaAllowance, 6)).toFixed(2)} USDC ✓</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#888' }}>Strategy hash</span>
                <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 9 }}>{DEFAULT_STRATEGY_HASH.slice(0, 10)}…{DEFAULT_STRATEGY_HASH.slice(-6)}</span>
                  <AddrLink address={AQUA_PARLAY_ROUTER_ADDRESS} label="view on Etherscan ↗" />
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#888' }}>Pool contract (AquaParlayRouter)</span>
                <AddrLink address={AQUA_PARLAY_ROUTER_ADDRESS} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#888' }}>1inch Aqua (liquidity layer)</span>
                <AddrLink address={AQUA_ADDRESS} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#888' }}>Pool token (USDC)</span>
                <AddrLink address={MOCK_USDC_ADDRESS} label={`${MOCK_USDC_ADDRESS.slice(0, 6)}…${MOCK_USDC_ADDRESS.slice(-4)} ↗`} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#888' }}>LP wallet</span>
                <AddrLink address={address ?? '0x0'} label={`${(address ?? '').slice(0, 6)}…${(address ?? '').slice(-4)}`} />
              </div>
              {(shipTxHash ?? aquaTxHash) && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#888' }}>Ship tx</span>
                  <TxLink hash={(shipTxHash ?? aquaTxHash) as string} />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Market row ────────────────────────────────────────────────────────────────

function MarketRow({ address }: { address: `0x${string}` }) {
  const info = useMarketInfo(address);
  const { requestSettlement, isPending: isRequesting } = useRequestSettlement();

  if (!info?.homeTeam) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', padding: '16px 24px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
        <span className="text-label" style={{ fontSize: 10, color: '#bbb' }}>LOADING… {address.slice(0, 10)}…</span>
      </div>
    );
  }

  const resolved = info.result !== 0;
  const matchId  = `0x${Buffer.from(`${info.homeTeam}-${info.awayTeam}-${info.kickoff}`).toString('hex').padEnd(64, '0').slice(0, 64)}` as `0x${string}`;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', padding: '16px 24px', borderBottom: '1px solid var(--border)', alignItems: 'center', gap: 8 }}>
      <div>
        <span style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 12 }}>{address.slice(0, 10)}…{address.slice(-6)}</span>
        <div className="text-label" style={{ fontSize: 9, color: '#aaa', marginTop: 2 }}>LMSR MARKET · 2 OUTCOMES</div>
      </div>
      <span>
        <span className="text-label" style={{ fontSize: 10, padding: '3px 8px', background: resolved ? '#eee' : 'var(--mint)' }}>
          {resolved ? 'RESOLVED' : 'LIVE · AQUA'}
        </span>
      </span>
      <span style={{ fontWeight: 600 }}>{info.homePrice.toFixed(3)} / {info.awayPrice.toFixed(3)}</span>
      <div style={{ display: 'flex', gap: 6 }}>
        {!resolved && (
          <button onClick={() => requestSettlement(matchId, address)} disabled={isRequesting}
            style={{ padding: '6px 10px', background: 'var(--white)', color: 'var(--black)', border: '1px solid var(--border)', cursor: 'pointer', fontWeight: 700, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {isRequesting ? '…' : 'SETTLE'}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function LpPage() {
  const { address, isConnected } = useAccount();
  const { formatted: usdcBal } = useUsdcBalance(address);
  const { data: nextId } = useReadContract({
    address: PARLAY_VAULT_ADDRESS, abi: PARLAY_VAULT_ABI, functionName: 'nextTicketId',
  });
  const totalTickets = Number(nextId ?? 0);

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>
      {/* Headline */}
      <div style={{ background: 'var(--white)', padding: 'clamp(32px,5vw,72px) clamp(24px,4vw,56px)', borderBottom: '1px solid var(--border)' }}>
        <p className="text-label" style={{ color: '#aaa', marginBottom: 16, fontSize: 10 }}>■ LP CONSOLE · 1INCH AQUA VIRTUAL LIQUIDITY</p>
        <h1 className="text-display" style={{ fontSize: 'clamp(56px,9vw,140px)' }}>BE THE<br/>HOUSE.</h1>
      </div>

      {/* Stat row */}
      <div className="page-grid" style={{ background: 'var(--border)', borderBottom: '1px solid var(--border)' }}>
        {[
          { label: 'WALLET USDC',      value: isConnected ? `$${usdcBal}` : '—',  note: 'stays here — Aqua pulls on payout only', bg: 'var(--white)' },
          { label: '1INCH AQUA',       value: 'LIVE',                               note: 'virtual liquidity layer on Sepolia',     bg: 'var(--white)' },
          { label: 'TICKETS SOLD',     value: String(totalTickets),                 note: 'all parlays on-chain',                  bg: 'var(--white)' },
          { label: 'LP MODEL',         value: 'b × ln N',                           note: 'bounded max-loss per market',           bg: 'var(--mint)'  },
        ].map(s => (
          <div key={s.label} className="gc-1" style={{ background: s.bg, padding: 'clamp(20px,3vw,36px) 24px' }}>
            <span className="text-label" style={{ display: 'block', marginBottom: 12, fontSize: 10 }}>■ {s.label}</span>
            <div style={{ fontSize: 'clamp(28px,3.5vw,48px)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1 }}>{s.value}</div>
            <div className="text-label" style={{ marginTop: 10, fontSize: 10, color: '#888' }}>{s.note}</div>
          </div>
        ))}
      </div>

      {/* Aqua flow explainer */}
      <div style={{ background: 'var(--black)', color: 'var(--white)', padding: '32px 24px', borderBottom: '1px solid var(--border)' }}>
        <span className="text-label" style={{ display: 'block', marginBottom: 20, color: '#666', fontSize: 10 }}>■ END-TO-END AQUA FLOW</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: '#333' }}>
          {[
            { label: 'LP SEEDS LMSR',     desc: 'Sets opening odds via LmsrMarket.ship(amount, b). USDC locks in pricing contract.', icon: '01' },
            { label: 'LP APPROVES AQUA',  desc: 'USDC.approve(Aqua, reserve). Aqua can pull from wallet for future winning parlays.', icon: '02' },
            { label: 'LP SHIPS TO AQUA',  desc: 'Aqua.ship() registers virtual balance. Funds stay in LP wallet — not locked.', icon: '03' },
            { label: 'USER BUYS PARLAY',  desc: 'AquaParlayRouter.buyParlay() reads LMSR price, calls Aqua.pull(LP) for payout. Vault mints ticket.', icon: '04' },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--black)', padding: '24px 20px' }}>
              <div style={{ fontSize: 48, fontWeight: 800, color: '#333', lineHeight: 1 }}>{s.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 11, marginTop: 12, letterSpacing: '0.06em' }}>{s.label}</div>
              <div style={{ fontSize: 11, color: '#777', marginTop: 6, lineHeight: 1.5 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* LP Ship Wizard */}
      <div style={{ borderBottom: '1px solid var(--border)' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', background: 'var(--white)' }}>
          <span className="text-label" style={{ fontSize: 10 }}>■ LP WIZARD · SHIP TO 1INCH AQUA</span>
        </div>
        <LpShipWizard />
      </div>

      {/* CRE Forwarder admin panel */}
      <div style={{ background: 'var(--white)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
          <span className="text-label" style={{ fontSize: 10 }}>■ CHAINLINK CRE FORWARDER · ADMIN</span>
        </div>
        <CreForwarderPanel />
      </div>

      {/* Market status table */}
      <div style={{ background: 'var(--white)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="text-label" style={{ fontSize: 10 }}>■ MARKET STATUS · REQUEST SETTLEMENT</span>
          <span className="text-label" style={{ fontSize: 9, color: '#aaa' }}>SETTLE → emits event → Chainlink CRE resolves</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', padding: '10px 24px', borderBottom: '1px solid var(--border)', background: '#fafafa' }}>
          {['CONTRACT', 'STATUS', 'ODDS (0/1)', 'ACTION'].map(h => (
            <span key={h} className="text-label" style={{ fontSize: 10, color: '#888' }}>{h}</span>
          ))}
        </div>
        {MARKET_ADDRESSES.length === 0 ? (
          <div style={{ padding: 32 }}>
            <span className="text-label" style={{ fontSize: 10, color: '#aaa' }}>NO MARKETS — set NEXT_PUBLIC_MARKETS</span>
          </div>
        ) : MARKET_ADDRESSES.map(addr => <MarketRow key={addr} address={addr} />)}
      </div>
    </div>
  );
}
