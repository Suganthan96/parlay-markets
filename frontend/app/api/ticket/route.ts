/**
 * POST /api/ticket
 * Called client-side after a successful ParlayBought transaction.
 * Writes a parlay.tickets entity to Arkiv for off-chain indexing.
 *
 * Body: { ticketId, owner, stakeUsdc, payout, legs: [{market,teamA,teamB,outcome,price}] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { writeTicket, type TicketInput, type LegInput } from '@/src/lib/arkiv/write';

interface Body {
  ticketId:  number;
  owner:     `0x${string}`;
  stakeUsdc: string;   // bigint serialized as string
  payout:    string;
  legs:      LegInput[];
}

export async function POST(req: NextRequest) {
  if (!process.env.ARKIV_PRIVATE_KEY) {
    return NextResponse.json({ ok: false, note: 'ARKIV_PRIVATE_KEY not configured — skipping Arkiv write' });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const input: TicketInput = {
    ticketId:  body.ticketId,
    owner:     body.owner,
    stakeUsdc: BigInt(body.stakeUsdc),
    payout:    BigInt(body.payout),
    legs:      body.legs,
  };

  try {
    const entityKey = await writeTicket(input);
    return NextResponse.json({ ok: true, entityKey });
  } catch (e) {
    console.error('Arkiv writeTicket failed:', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
