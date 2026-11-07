'use client';

import { useEffect, useRef, useState } from 'react';

type Ev = { t: number; espnId: string | null; stage: string; msg: string; tx?: string; raw?: boolean };
type Mk = { espnId: string; market: string; label: string; kind?: string; result?: number };
type Data = { running: boolean; intervalSeconds: number; markets: Mk[]; events: Ev[] };

const STAGES = [
  { key: 'watching',  label: 'Watching' },
  { key: 'requested', label: 'Settlement requested' },
  { key: 'fetching',  label: 'CRE fetching score' },
  { key: 'resolved',  label: 'Resolved' },
];

function stageOf(events: Ev[], id: string, result?: number) {
  if (result) return { idx: 3, error: false, last: undefined as Ev | undefined };
  const mine = events.filter((e) => e.espnId === id);
  const last = mine[mine.length - 1];
  if (!last) return { idx: 0, error: false, last: undefined as Ev | undefined };
  const idx = last.stage === 'error'
    ? Math.max(0, STAGES.findIndex((s) => s.key === [...mine].reverse().find((e) => e.stage !== 'error')?.stage))
    : STAGES.findIndex((s) => s.key === last.stage);
  return { idx, error: last.stage === 'error', last };
}

export default function CreMonitorPanel() {
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState(false);
  const term = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try { const d = await (await fetch('/api/cre-monitor', { cache: 'no-store' })).json(); if (alive) setData(d); } catch {}
    };
    poll();
    const id = setInterval(poll, 2000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  useEffect(() => { if (term.current) term.current.scrollTop = term.current.scrollHeight; }, [data?.events.length]);

  const post = async (action: 'start' | 'run') => {
    setBusy(true);
    await fetch('/api/cre-monitor', { method: 'POST', body: JSON.stringify({ action }) });
    setTimeout(() => setBusy(false), 1500);
  };

  const events = data?.events ?? [];
  const color = (e: Ev) => e.stage === 'error' ? '#ff6b6b' : e.stage === 'resolved' ? '#7CFFB2' : e.raw ? '#9aa' : '#ddd';

  return (
    <div style={{ background: 'var(--white)', borderBottom: '1px solid var(--border)' }}>
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="text-label" style={{ fontSize: 10 }}>
          ■ CHAINLINK CRE · CONTINUOUS SETTLEMENT MONITOR
          <span style={{ marginLeft: 12, color: data?.running ? '#0a8f4e' : '#aaa' }}>● {data?.running ? `LIVE · polling every ${data.intervalSeconds}s` : 'STOPPED'}</span>
        </span>
        <span style={{ display: 'flex', gap: 8 }}>
          <button disabled={busy || data?.running} onClick={() => post('start')} style={{ padding: '6px 14px', border: '2px solid var(--black)', background: 'var(--black)', color: '#fff', fontWeight: 800, fontSize: 10, cursor: 'pointer', opacity: data?.running ? 0.4 : 1 }}>START MONITOR</button>
          <button disabled={busy} onClick={() => post('run')} style={{ padding: '6px 14px', border: '2px solid var(--black)', background: 'transparent', fontWeight: 800, fontSize: 10, cursor: 'pointer' }}>RUN NOW</button>
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, data?.markets.length ?? 1)}, 1fr)`, gap: 1, background: 'var(--border)' }}>
        {(data?.markets ?? []).map((m) => {
          const s = stageOf(events, m.espnId, m.result);
          const resolved = [...events].reverse().find((e) => e.espnId === m.espnId && e.stage === 'resolved');
          return (
            <div key={m.espnId} style={{ background: 'var(--white)', padding: '16px 24px' }}>
              <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 2 }}>{m.label}</div>
              <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#888', marginBottom: 12 }}>{m.kind === 'value' ? 'DATA FEED' : `ESPN ${m.espnId}`} · {m.market.slice(0, 10)}…</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {STAGES.map((st, i) => (
                  <div key={st.key} style={{ flex: 1 }}>
                    <div style={{ height: 6, background: i <= s.idx ? (s.error && i === s.idx ? '#ff6b6b' : 'var(--mint)') : 'var(--border)' }} />
                    <div style={{ fontSize: 9, marginTop: 4, fontWeight: i === s.idx ? 800 : 500, color: i <= s.idx ? '#000' : '#aaa' }}>{st.label}</div>
                  </div>
                ))}
              </div>
              {!resolved && m.result ? (
                <div style={{ marginTop: 10, fontSize: 11 }}>Resolved on-chain (result={m.result})</div>
              ) : null}
              {resolved && (
                <div style={{ marginTop: 10, fontSize: 11 }}>
                  {resolved.msg}{' '}
                  {resolved.tx && <a href={`https://sepolia.etherscan.io/tx/${resolved.tx}`} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>tx ↗</a>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div ref={term} style={{ background: '#0b0d10', color: '#ddd', fontFamily: 'monospace', fontSize: 11, lineHeight: 1.6, padding: '14px 24px', height: 260, overflowY: 'auto' }}>
        {events.length === 0 && <div style={{ color: '#667' }}>$ waiting for monitor… press START MONITOR</div>}
        {events.map((e, i) => (
          <div key={i} style={{ color: color(e), whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            <span style={{ color: '#667' }}>{new Date(e.t).toLocaleTimeString()} </span>
            {e.espnId && <span style={{ color: '#8ab4ff' }}>[{e.espnId}] </span>}
            {e.msg}
            {e.tx && <a href={`https://sepolia.etherscan.io/tx/${e.tx}`} target="_blank" rel="noreferrer" style={{ color: '#8ab4ff', marginLeft: 8 }}>{e.tx.slice(0, 12)}… ↗</a>}
          </div>
        ))}
      </div>
      <div style={{ padding: '8px 24px', fontSize: 10, color: '#888' }}>
        Runs the workflow via <code>cre workflow simulate --broadcast</code> locally against Sepolia (a CRE simulation, not a deployed DON workflow).
      </div>
    </div>
  );
}
