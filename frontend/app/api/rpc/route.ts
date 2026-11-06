import { NextRequest, NextResponse } from 'next/server';

const RPCS = [
  'https://rpc.sepolia.org',
  'https://eth-sepolia.public.blastapi.io',
  'https://ethereum-sepolia-rpc.publicnode.com',
  'https://sepolia.drpc.org',
];

async function tryRpc(body: string): Promise<{ data: any; ok: boolean }> {
  for (const rpc of RPCS) {
    try {
      const res = await fetch(rpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const msg: string = data?.error?.message ?? '';
      if (/rate.limit|too many|quota/i.test(msg)) { continue; }
      return { data, ok: true };
    } catch {
      continue;
    }
  }
  return { data: { jsonrpc: '2.0', error: { code: -32603, message: 'All Sepolia RPCs failed' } }, ok: false };
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const { data } = await tryRpc(body);
  return NextResponse.json(data, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
