export interface Market {
  id: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  kickoff: number; // unix timestamp
  homePrice: number; // 0-1
  awayPrice: number;
  drawPrice?: number;
  status: 'open' | 'live' | 'resolved';
  winner?: string;
  txHash?: string;
}

export interface ParlayLeg {
  marketId: string;
  marketLabel: string;
  outcome: string;
  price: number;
  // On-chain fields (populated when added from real markets page)
  marketAddress?: `0x${string}`;
  outcomeIdx?: number; // 0=Home, 1=Away
}

export interface Ticket {
  id: string;
  legs: Array<{
    marketId: string;
    marketLabel: string;
    outcome: string;
    price: number;
    status: 'live' | 'won' | 'lost';
  }>;
  stakeUsdc: number;
  payoutUnits: number; // e.g. 100 (=$100 at win)
  cashOutValue: number;
  status: 'open' | 'won' | 'lost' | 'cashed_out';
  boughtAt: number;
}

export interface Slip {
  id: string;
  creator: string;
  legs: ParlayLeg[];
  quotedPrice: number;
  copies: number;
  kickoff: number; // soonest leg
  expiresAt: number;
}

export interface LpStats {
  walletUsdc: number;
  parlayCapUsed: number;
  parlayCapTotal: number;
  maxLoss: number;
  pnl: number;
  strategies: LpStrategy[];
}

export interface LpStrategy {
  marketId: string;
  label: string;
  status: 'docked' | 'shipped';
  b: number;
  shippedAmount: number;
  exposure: number;
}
