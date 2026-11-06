import type { Market, Ticket, Slip, LpStats } from './types';

const NOW = Date.now();
const H = 3600_000;

export const MOCK_MARKETS: Market[] = [
  {
    id: 'm1',
    league: 'IPL 2026',
    homeTeam: 'CSK',
    awayTeam: 'MI',
    kickoff: NOW + 2 * H,
    homePrice: 0.60,
    awayPrice: 0.40,
    status: 'open',
  },
  {
    id: 'm2',
    league: 'IPL 2026',
    homeTeam: 'RCB',
    awayTeam: 'KKR',
    kickoff: NOW + 5 * H,
    homePrice: 0.50,
    awayPrice: 0.50,
    status: 'open',
  },
  {
    id: 'm3',
    league: 'IPL 2026',
    homeTeam: 'GT',
    awayTeam: 'RR',
    kickoff: NOW + 8 * H,
    homePrice: 0.70,
    awayPrice: 0.30,
    status: 'open',
  },
  {
    id: 'm4',
    league: 'IPL 2026',
    homeTeam: 'PBKS',
    awayTeam: 'LSG',
    kickoff: NOW + 24 * H,
    homePrice: 0.45,
    awayPrice: 0.55,
    status: 'open',
  },
  {
    id: 'm5',
    league: 'IPL 2026',
    homeTeam: 'SRH',
    awayTeam: 'DC',
    kickoff: NOW - 6 * H,
    homePrice: 1.0,
    awayPrice: 0.0,
    status: 'resolved',
    winner: 'SRH',
    txHash: '0xabc123def456abc123def456abc123def456abc123def456abc123def456abc1',
  },
];

export const MOCK_TICKETS: Ticket[] = [
  {
    id: 't1',
    legs: [
      { marketId: 'm1', marketLabel: 'CSK beats MI',  outcome: 'CSK', price: 0.60, status: 'live' },
      { marketId: 'm2', marketLabel: 'RCB beats KKR', outcome: 'RCB', price: 0.50, status: 'live' },
    ],
    stakeUsdc: 23.10,
    payoutUnits: 100,
    cashOutValue: 70.12,
    status: 'open',
    boughtAt: NOW - 1 * H,
  },
  {
    id: 't2',
    legs: [
      { marketId: 'm5', marketLabel: 'SRH beats DC', outcome: 'SRH', price: 0.65, status: 'won' },
      { marketId: 'm3', marketLabel: 'GT beats RR',  outcome: 'GT',  price: 0.70, status: 'live' },
    ],
    stakeUsdc: 15.00,
    payoutUnits: 100,
    cashOutValue: 45.50,
    status: 'open',
    boughtAt: NOW - 7 * H,
  },
  {
    id: 't3',
    legs: [
      { marketId: 'm5', marketLabel: 'SRH beats DC', outcome: 'SRH', price: 0.65, status: 'won' },
      { marketId: 'm2', marketLabel: 'RCB beats KKR', outcome: 'RCB', price: 0.50, status: 'won' },
    ],
    stakeUsdc: 10.00,
    payoutUnits: 100,
    cashOutValue: 100,
    status: 'won',
    boughtAt: NOW - 12 * H,
  },
];

export const MOCK_SLIPS: Slip[] = [
  {
    id: 's1',
    creator: '0xDEAD...BEEF',
    legs: [
      { marketId: 'm1', marketLabel: 'CSK beats MI',  outcome: 'CSK', price: 0.60 },
      { marketId: 'm2', marketLabel: 'RCB beats KKR', outcome: 'RCB', price: 0.50 },
      { marketId: 'm3', marketLabel: 'GT beats RR',   outcome: 'GT',  price: 0.70 },
    ],
    quotedPrice: 0.231,
    copies: 142,
    kickoff: NOW + 2 * H,
    expiresAt: NOW + 3 * H,
  },
  {
    id: 's2',
    creator: '0xCAFE...BABE',
    legs: [
      { marketId: 'm1', marketLabel: 'CSK beats MI',   outcome: 'CSK',  price: 0.60 },
      { marketId: 'm4', marketLabel: 'LSG beats PBKS', outcome: 'LSG',  price: 0.55 },
    ],
    quotedPrice: 0.363,
    copies: 87,
    kickoff: NOW + 2 * H,
    expiresAt: NOW + 3 * H,
  },
  {
    id: 's3',
    creator: '0x1337...C0DE',
    legs: [
      { marketId: 'm2', marketLabel: 'KKR beats RCB', outcome: 'KKR', price: 0.50 },
      { marketId: 'm3', marketLabel: 'RR beats GT',   outcome: 'RR',  price: 0.30 },
    ],
    quotedPrice: 0.165,
    copies: 23,
    kickoff: NOW + 5 * H,
    expiresAt: NOW + 6 * H,
  },
];

export const MOCK_LP_STATS: LpStats = {
  walletUsdc: 5000,
  parlayCapUsed: 1200,
  parlayCapTotal: 3000,
  maxLoss: 847.23,
  pnl: 142.80,
  strategies: [
    { marketId: 'm1', label: 'CSK vs MI',   status: 'shipped', b: 100, shippedAmount: 500, exposure: 200 },
    { marketId: 'm2', label: 'RCB vs KKR',  status: 'shipped', b: 100, shippedAmount: 400, exposure: 160 },
    { marketId: 'm3', label: 'GT vs RR',    status: 'docked',  b: 50,  shippedAmount: 0,   exposure: 0   },
    { marketId: 'm4', label: 'PBKS vs LSG', status: 'docked',  b: 80,  shippedAmount: 0,   exposure: 0   },
  ],
};
