'use client';

import {
  useReadContract, useReadContracts, useWriteContract,
  useWaitForTransactionReceipt, useAccount, useBalance,
} from 'wagmi';
import { parseUnits, formatUnits, encodeAbiParameters, parseAbiParameters } from 'viem';
import {
  ERC20_ABI, LMSR_MARKET_ABI, PARLAY_ROUTER_ABI, PARLAY_VAULT_ABI, MARKET_RESOLVER_ABI,
  AQUA_PARLAY_ROUTER_ABI, AQUA_ABI,
  MOCK_USDC_ADDRESS, PARLAY_ROUTER_ADDRESS, PARLAY_VAULT_ADDRESS, MARKET_RESOLVER_ADDRESS,
  AQUA_PARLAY_ROUTER_ADDRESS, AQUA_ADDRESS, MARKET_ADDRESSES,
} from './contracts';

const WAD = 1_000_000_000_000_000_000n; // 1e18

// ── USDC ──────────────────────────────────────────────────────────────────────

export function useUsdcBalance(address?: `0x${string}`) {
  const { data, isLoading } = useReadContract({
    address: MOCK_USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
  return {
    raw:       data ?? 0n,
    formatted: data ? Number(formatUnits(data, 6)).toFixed(2) : '0.00',
    isLoading,
  };
}

export function useUsdcAllowance(owner?: `0x${string}`, spender?: `0x${string}`) {
  const { data } = useReadContract({
    address: MOCK_USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: owner && spender ? [owner, spender] : undefined,
    query: { enabled: !!(owner && spender) },
  });
  return data ?? 0n;
}

export function useApproveUsdc() {
  const { writeContractAsync, isPending } = useWriteContract();
  async function approve(spender: `0x${string}`, amountUsdc: number) {
    return writeContractAsync({
      address: MOCK_USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [spender, parseUnits(amountUsdc.toString(), 6)],
    });
  }
  return { approve, isPending };
}

export function useMintUsdc() {
  const { writeContractAsync, isPending } = useWriteContract();
  async function mint(to: `0x${string}`, amountUsdc: number) {
    return writeContractAsync({
      address: MOCK_USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'mint',
      args: [to, parseUnits(amountUsdc.toString(), 6)],
    });
  }
  return { mint, isPending };
}

// ── LmsrMarket prices ─────────────────────────────────────────────────────────

export function useMarketPrices(marketAddress?: `0x${string}`) {
  const { data, isLoading, refetch } = useReadContract({
    address: marketAddress,
    abi: LMSR_MARKET_ABI,
    functionName: 'prices',
    query: { enabled: !!marketAddress, refetchInterval: 15_000 },
  });
  const p0 = data ? Number(data[0]) / 1e18 : 0.5;
  const p1 = data ? Number(data[1]) / 1e18 : 0.5;
  return { p0, p1, raw: data, isLoading, refetch };
}

export function useMarketResult(marketAddress?: `0x${string}`) {
  const { data } = useReadContract({
    address: marketAddress,
    abi: LMSR_MARKET_ABI,
    functionName: 'result',
    query: { enabled: !!marketAddress },
  });
  // Outcome enum: 0=Unresolved, 1=Home, 2=Away, 3=Draw
  const names = ['unresolved', 'home', 'away', 'draw'] as const;
  return names[Number(data ?? 0)] as typeof names[number];
}

export function useMarketInfo(marketAddress?: `0x${string}`) {
  const { data } = useReadContracts({
    contracts: [
      { address: marketAddress, abi: LMSR_MARKET_ABI, functionName: 'homeTeam' },
      { address: marketAddress, abi: LMSR_MARKET_ABI, functionName: 'awayTeam' },
      { address: marketAddress, abi: LMSR_MARKET_ABI, functionName: 'kickoff' },
      { address: marketAddress, abi: LMSR_MARKET_ABI, functionName: 'result' },
      { address: marketAddress, abi: LMSR_MARKET_ABI, functionName: 'prices' },
    ],
    query: { enabled: !!marketAddress },
  });
  if (!data) return null;
  const [home, away, kickoff, result, prices] = data;
  return {
    homeTeam:  home.result   as string | undefined,
    awayTeam:  away.result   as string | undefined,
    kickoff:   Number(kickoff.result ?? 0),
    result:    Number(result.result  ?? 0),
    homePrice: prices.result ? Number((prices.result as [bigint,bigint])[0]) / 1e18 : 0.5,
    awayPrice: prices.result ? Number((prices.result as [bigint,bigint])[1]) / 1e18 : 0.5,
  };
}

// ── LmsrMarket ship / dock ────────────────────────────────────────────────────

export function useShipLiquidity(marketAddress?: `0x${string}`) {
  const { writeContractAsync, isPending } = useWriteContract();
  async function ship(amountUsdc: number, b: bigint) {
    if (!marketAddress) throw new Error('No market address');
    return writeContractAsync({
      address: marketAddress,
      abi: LMSR_MARKET_ABI,
      functionName: 'ship',
      args: [parseUnits(amountUsdc.toString(), 6), b],
    });
  }
  return { ship, isPending };
}

export function useDockLiquidity(marketAddress?: `0x${string}`) {
  const { writeContractAsync, isPending } = useWriteContract();
  async function dock() {
    if (!marketAddress) throw new Error('No market address');
    return writeContractAsync({ address: marketAddress, abi: LMSR_MARKET_ABI, functionName: 'dock', args: [] });
  }
  return { dock, isPending };
}

// ── ParlayRouter ──────────────────────────────────────────────────────────────

export function useQuoteParlay(
  markets:  `0x${string}`[],
  outcomes: bigint[],
  stakeUsdc: number,
) {
  const enabled = markets.length > 0 && stakeUsdc > 0 && markets.length === outcomes.length;
  const { data, isLoading } = useReadContract({
    address: PARLAY_ROUTER_ADDRESS,
    abi: PARLAY_ROUTER_ABI,
    functionName: 'quoteParlay',
    args: enabled ? [markets, outcomes, parseUnits(stakeUsdc.toString(), 6)] : undefined,
    query: { enabled, refetchInterval: 10_000 },
  });
  return {
    combinedPrice: data ? Number(data[0]) / 1e18 : 0,
    payoutUsdc:    data ? Number(formatUnits(data[1], 6)) : 0,
    payoutRaw:     data ? data[1] : 0n,
    isLoading,
  };
}

export function useBuyParlay() {
  const { writeContractAsync, isPending, data: txHash } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  async function buyParlay(
    markets:   `0x${string}`[],
    outcomes:  bigint[],
    stakeUsdc: number,
    minPayout: bigint = 0n,
  ) {
    return writeContractAsync({
      address: PARLAY_ROUTER_ADDRESS,
      abi: PARLAY_ROUTER_ABI,
      functionName: 'buyParlay',
      args: [markets, outcomes, parseUnits(stakeUsdc.toString(), 6), minPayout],
    });
  }

  return { buyParlay, isPending, isConfirming, isSuccess, txHash };
}

// ── ParlayVault ───────────────────────────────────────────────────────────────

export function useTicket(ticketId: bigint | undefined) {
  const { data } = useReadContracts({
    contracts: ticketId ? [
      { address: PARLAY_VAULT_ADDRESS, abi: PARLAY_VAULT_ABI, functionName: 'ticketOwner',    args: [ticketId] },
      { address: PARLAY_VAULT_ADDRESS, abi: PARLAY_VAULT_ABI, functionName: 'ticketStake',    args: [ticketId] },
      { address: PARLAY_VAULT_ADDRESS, abi: PARLAY_VAULT_ABI, functionName: 'ticketPayout',   args: [ticketId] },
      { address: PARLAY_VAULT_ADDRESS, abi: PARLAY_VAULT_ABI, functionName: 'ticketSettled',  args: [ticketId] },
      { address: PARLAY_VAULT_ADDRESS, abi: PARLAY_VAULT_ABI, functionName: 'ticketLegCount', args: [ticketId] },
    ] : [],
    query: { enabled: !!ticketId },
  });
  if (!data || !ticketId) return null;
  const [owner, stake, payout, settled, legCount] = data;
  return {
    ticketId,
    owner:    owner?.result    as `0x${string}` | undefined,
    stake:    stake?.result    as bigint        | undefined,
    payout:   payout?.result   as bigint        | undefined,
    settled:  settled?.result  as boolean       | undefined,
    legCount: legCount?.result as number        | undefined,
  };
}

export function useCashOut() {
  const { writeContractAsync, isPending, data: txHash } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });
  async function cashOut(ticketId: bigint) {
    return writeContractAsync({ address: PARLAY_VAULT_ADDRESS, abi: PARLAY_VAULT_ABI, functionName: 'cashOut', args: [ticketId] });
  }
  return { cashOut, isPending, isConfirming, isSuccess, txHash };
}

export function useClaim() {
  const { writeContractAsync, isPending, data: txHash } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });
  async function claim(ticketId: bigint) {
    return writeContractAsync({ address: PARLAY_VAULT_ADDRESS, abi: PARLAY_VAULT_ABI, functionName: 'claim', args: [ticketId] });
  }
  return { claim, isPending, isConfirming, isSuccess, txHash };
}

// ── MarketResolver ────────────────────────────────────────────────────────────

export function useReadCRE() {
  const { data: creAddress } = useReadContract({
    address: MARKET_RESOLVER_ADDRESS,
    abi: MARKET_RESOLVER_ABI,
    functionName: 'cre',
    query: { refetchInterval: 30_000 },
  });
  return creAddress as `0x${string}` | undefined;
}

export function useSetCRE() {
  const { writeContractAsync, isPending, data: txHash } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash: txHash });
  async function setCRE(newCre: `0x${string}`) {
    return writeContractAsync({
      address: MARKET_RESOLVER_ADDRESS,
      abi: MARKET_RESOLVER_ABI,
      functionName: 'setCRE',
      args: [newCre],
    });
  }
  return { setCRE, isPending, isSuccess, txHash };
}

export function useRequestSettlement() {
  const { writeContractAsync, isPending, data: txHash } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash: txHash });
  async function requestSettlement(matchId: `0x${string}`, market: `0x${string}`) {
    return writeContractAsync({
      address: MARKET_RESOLVER_ADDRESS,
      abi: MARKET_RESOLVER_ABI,
      functionName: 'requestSettlement',
      args: [matchId, market],
    });
  }
  return { requestSettlement, isPending, isSuccess, txHash };
}

export function useResolveMarket() {
  const { writeContractAsync, isPending, data: txHash } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash: txHash });
  // result: 1=Home, 2=Away, 3=Draw
  async function resolveMarket(market: `0x${string}`, result: 1 | 2 | 3) {
    return writeContractAsync({
      address: MARKET_RESOLVER_ADDRESS,
      abi: MARKET_RESOLVER_ABI,
      functionName: 'resolveMarket',
      args: [market, result],
    });
  }
  return { resolveMarket, isPending, isSuccess, txHash };
}

// ── AquaParlayRouter ──────────────────────────────────────────────────────────

export function useAquaAllowance(owner?: `0x${string}`) {
  const { data } = useReadContract({
    address: MOCK_USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: owner ? [owner, AQUA_ADDRESS] : undefined,
    query: { enabled: !!owner, refetchInterval: 5_000 },
  });
  return data ?? 0n;
}

export function useApproveAqua() {
  const { writeContractAsync, isPending } = useWriteContract();
  async function approveAqua(amount: bigint) {
    return writeContractAsync({
      address: MOCK_USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [AQUA_ADDRESS, amount],
    });
  }
  return { approveAqua, isPending };
}

export function useLpShipAqua() {
  const { writeContractAsync, isPending, data: txHash } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });
  // LP calls AQUA.ship() directly — their wallet is msg.sender = maker in Aqua storage.
  // This is required: if the router called ship(), Aqua records balance under [router],
  // but pull() checks under [LP address] → underflow revert.
  async function lpShipAqua(markets: `0x${string}`[], payoutReserve: bigint) {
    const strategy = encodeAbiParameters(
      parseAbiParameters('address[]'),
      [markets],
    );
    return writeContractAsync({
      address: AQUA_ADDRESS,
      abi: AQUA_ABI,
      functionName: 'ship',
      args: [
        AQUA_PARLAY_ROUTER_ADDRESS,  // app = our router
        strategy,                     // abi.encode(markets)
        [MOCK_USDC_ADDRESS],          // tokens
        [payoutReserve],              // amounts
      ],
    });
  }
  return { lpShipAqua, isPending, isConfirming, isSuccess, txHash };
}

export function useLpDockAqua() {
  const { writeContractAsync, isPending, data: txHash } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash: txHash });
  async function lpDockAqua(strategyHash: `0x${string}`) {
    return writeContractAsync({
      address: AQUA_PARLAY_ROUTER_ADDRESS,
      abi: AQUA_PARLAY_ROUTER_ABI,
      functionName: 'lpDockAqua',
      args: [strategyHash],
    });
  }
  return { lpDockAqua, isPending, isSuccess };
}

export function useBuyParlayViaAqua() {
  const { writeContractAsync, isPending, data: txHash } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });
  async function buyParlayViaAqua(
    lp: `0x${string}`,
    strategyHash: `0x${string}`,
    markets: `0x${string}`[],
    outcomes: bigint[],
    stakeUsdc: number,
    minPayout: bigint = 0n,
  ) {
    return writeContractAsync({
      address: AQUA_PARLAY_ROUTER_ADDRESS,
      abi: AQUA_PARLAY_ROUTER_ABI,
      functionName: 'buyParlay',
      args: [lp, strategyHash, markets, outcomes, parseUnits(stakeUsdc.toString(), 6), minPayout],
    });
  }
  return { buyParlayViaAqua, isPending, isConfirming, isSuccess, txHash };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function formatUsdc(raw: bigint): string {
  return Number(formatUnits(raw, 6)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
