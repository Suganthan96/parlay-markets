import { NextResponse } from 'next/server';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export const dynamic = 'force-dynamic';

const CRE_DIR = path.join(process.cwd(), '..', 'cre');
const LOG = path.join(CRE_DIR, 'monitor.log.jsonl');
const MARKETS = path.join(CRE_DIR, 'monitor.markets.json');
const LOCK = path.join(CRE_DIR, 'monitor.lock');

function running() {
  if (!existsSync(LOCK)) return false;
  return Date.now() - Number(readFileSync(LOCK, 'utf8')) < 90_000;
}

export async function GET() {
  const config = JSON.parse(readFileSync(path.join(CRE_DIR, 'monitor.config.json'), 'utf8'));
  const events = existsSync(LOG)
    ? readFileSync(LOG, 'utf8').split('\n').filter(Boolean).slice(-300).map((l) => JSON.parse(l))
    : [];
  return NextResponse.json({ running: running(), intervalSeconds: config.intervalSeconds, markets: existsSync(MARKETS) ? JSON.parse(readFileSync(MARKETS, 'utf8')).filter((m: { eligible: boolean }) => m.eligible) : [], events });
}

// action "start": launch the continuous loop; "run": one immediate pass.
export async function POST(req: Request) {
  const { action } = await req.json().catch(() => ({ action: 'start' }));
  if (action === 'start' && running()) return NextResponse.json({ ok: true, already: true });
  const args = ['monitor.mjs', ...(action === 'run' ? ['--once'] : [])];
  const child = spawn('node', args, { cwd: CRE_DIR, detached: true, stdio: 'ignore' });
  child.unref();
  return NextResponse.json({ ok: true });
}
