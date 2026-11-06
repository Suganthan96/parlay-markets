'use client';

import { useState } from 'react';
import { useAccount, useConnect, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useChainId, useSwitchChain } from 'wagmi';
import { parseUnits } from 'viem';
import { baseSepolia } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';
import {
  CCIP_GATEWAY_ADDRESS, CCIP_GATEWAY_ABI,
  BASE_USDC_ADDRESS, ERC20_ABI,
  BASE_SEPOLIA_CHAIN_ID,
} from '@/lib/contracts';

interface Props {
  markets:     `0x${string}`[];
  outcomeIdxs: number[];
  stakeUsdc:   number;
  hasOnChain:  boolean;
  minPayout?:  bigint;
  stakeLabel?: string;
  onSuccess?:  () => void;
}

const BASE_EXPLORER = 'https://sepolia.basescan.org/tx/';
const SEP_EXPLORER  = 'https://ccip.chain.link';

export default function BuyCCIPButton({
  markets, outcomeIdxs, stakeUsdc, hasOnChain,
  minPayout = 0n, stakeLabel, onSuccess,
}: Props) {
  const { address, isConnected }  = useAccount();
  const { connectAsync }          = useConnect();
  const chainId                   = useChainId();
  const { switchChainAsync }      = useSwitchChain();

  const [approving,  setApproving]  = useState(false);
  const [approveTx,  setApproveTx]  = useState('');
  const [sendTx,     setSendTx]     = useState('');
  const [errorMsg,   setErrorMsg]   = useState('');
  const [sent,       setSent]       = useState(false);

  const stakeRaw = stakeUsdc > 0 ? parseUnits(stakeUsdc.toString(), 6) : 0n;

  // Read Base USDC allowance for Gateway
  const { data: allowance } = useReadContract({
    address: BASE_USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, CCIP_GATEWAY_ADDRESS] : undefined,
    query: { enabled: !!address && chainId === BASE_SEPOLIA_CHAIN_ID },
  });

  // Read CCIP fee estimate
  const outcomes = outcomeIdxs.map(i => BigInt(i));
  const { data: ccipFee } = useReadContract({
    address: CCIP_GATEWAY_ADDRESS,
    abi: CCIP_GATEWAY_ABI,
    functionName: 'estimateFee',
    args: markets.length > 0 && stakeRaw > 0n ? [markets, outcomes, stakeRaw, minPayout] : undefined,
    query: { enabled: hasOnChain && stakeUsdc > 0 && chainId === BASE_SEPOLIA_CHAIN_ID },
  });

  const { writeContractAsync: approveWrite, isPending: isApproving } = useWriteContract();
  const { writeContractAsync: sendWrite,    isPending: isSending    } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: sendTx as `0x${string}` | undefined,
  });

  const needsApproval = stakeRaw > 0n && (allowance ?? 0n) < stakeRaw;
  const disabled = !isConnected || !hasOnChain || markets.length === 0 || stakeUsdc <= 0;

  async function switchToBaseSepolia() {
    const eth = (window as any).ethereum;
    if (!eth) throw new Error('No wallet detected');

    // Step 1: authorize the site — this is required before any wallet_ method
    // eth_requestAccounts is idempotent: if already authorized it resolves immediately
    await eth.request({ method: 'eth_requestAccounts' });

    if (chainId === baseSepolia.id) return;

    // Step 2: add Base Sepolia (if not in wallet) and switch to it in one call
    try {
      await eth.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: '0x14a34',  // 84532
          chainName: 'Base Sepolia Testnet',
          nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
          rpcUrls: ['https://sepolia.base.org', 'https://base-sepolia-rpc.publicnode.com'],
          blockExplorerUrls: ['https://sepolia.basescan.org'],
        }],
      });
    } catch {
      // Chain already exists — just switch
      await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x14a34' }] });
    }

    // Give wagmi time to pick up the chain change
    await new Promise(r => setTimeout(r, 600));
  }

  async function handleClick() {
    if (disabled) return;
    setErrorMsg('');
    try {
      await switchToBaseSepolia();
      // Approve Base USDC to Gateway if needed
      if (needsApproval) {
        setApproving(true);
        try {
          const hash = await approveWrite({
            address: BASE_USDC_ADDRESS,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [CCIP_GATEWAY_ADDRESS, stakeRaw],
          });
          if (hash) setApproveTx(hash);
        } finally {
          setApproving(false);
        }
      }
      // Estimate fee if not yet loaded (fallback 0.01 ETH)
      const fee = ccipFee ?? parseUnits('0.01', 18);
      // Send cross-chain parlay
      const hash = await sendWrite({
        address: CCIP_GATEWAY_ADDRESS,
        abi: CCIP_GATEWAY_ABI,
        functionName: 'sendParlay',
        args: [markets, outcomes, stakeRaw, minPayout],
        value: fee,
      });
      setSendTx(hash);
      setSent(true);
      onSuccess?.();
    } catch (e: any) {
      setApproving(false);
      const msg = e?.shortMessage ?? e?.message ?? 'Transaction failed';
      setErrorMsg(msg.slice(0, 200));
      console.error('CCIP sendParlay failed:', e);
    }
  }

  const onBase = chainId === BASE_SEPOLIA_CHAIN_ID;

  let label = stakeLabel ? `${stakeLabel.toUpperCase()} VIA BASE →` : 'BUY VIA BASE (CCIP) →';
  if (!isConnected)             label = 'CONNECT WALLET';
  else if (!hasOnChain)         label = 'ADD ON-CHAIN LEGS';
  else if (stakeUsdc <= 0)      label = 'ENTER STAKE AMOUNT';
  else if (!onBase)             label = 'SWITCH TO BASE SEPOLIA →';
  else if (approving||isApproving) label = 'APPROVING BASE USDC…';
  else if (isSending)           label = 'CONFIRM IN WALLET…';
  else if (isConfirming)        label = 'CCIP MESSAGE SENDING…';
  else if (sent)                label = '✓ CCIP REQUEST SENT!';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Chain badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', color: '#2151f5', background: '#eff2ff', padding: '3px 8px', borderRadius: 2 }}>
          ■ CHAINLINK CCIP · BASE SEPOLIA → ETH SEPOLIA
        </span>
        {ccipFee && (
          <span style={{ fontSize: 9, color: '#888' }}>
            ~{(Number(ccipFee) / 1e18).toFixed(4)} ETH fee
          </span>
        )}
      </div>

      <button
        onClick={handleClick}
        disabled={disabled || isSending || isConfirming || isApproving || approving}
        style={{
          width: '100%', padding: '16px 24px',
          background: sent ? '#eff2ff' : errorMsg ? '#fee' : disabled ? '#f0f0f0' : '#2151f5',
          color:      sent ? '#2151f5' : errorMsg ? '#c00' : disabled ? '#aaa' : '#fff',
          border:     errorMsg ? '1px solid #c00' : '2px solid transparent',
          cursor: disabled || isSending || isConfirming ? 'not-allowed' : 'pointer',
          fontWeight: 800, fontSize: 14, letterSpacing: '0.04em', textTransform: 'uppercase',
          borderRadius: 2,
        }}
      >
        {label}
      </button>

      {errorMsg && (
        <div style={{ fontSize: 11, color: '#c00', padding: '8px 12px', background: '#fff5f5', border: '1px solid #fcc', lineHeight: 1.5, borderRadius: 2 }}>
          ✕ {errorMsg}
        </div>
      )}

      {approveTx && (
        <div style={{ fontSize: 11, color: '#888', padding: '6px 12px', background: '#f8f8f8', border: '1px solid var(--border)', borderRadius: 2 }}>
          Approve tx: <a href={`${BASE_EXPLORER}${approveTx}`} target="_blank" rel="noreferrer" style={{ color: '#2151f5', fontFamily: 'monospace' }}>
            {approveTx.slice(0, 10)}…{approveTx.slice(-6)} ↗
          </a>
        </div>
      )}

      {sent && (
        <div style={{ padding: '12px 14px', background: '#eff2ff', border: '1px solid #c7d2fe', borderRadius: 2 }}>
          <div style={{ fontWeight: 800, fontSize: 12, color: '#2151f5', marginBottom: 4 }}>
            ■ CCIP message sent — ticket mints on Ethereum Sepolia in ~2–3 min
          </div>
          {sendTx && (
            <div style={{ fontSize: 11, display: 'flex', gap: 12 }}>
              <a href={`${BASE_EXPLORER}${sendTx}`} target="_blank" rel="noreferrer" style={{ color: '#2151f5', fontFamily: 'monospace' }}>
                Base tx: {sendTx.slice(0, 10)}…{sendTx.slice(-6)} ↗
              </a>
              <a href={SEP_EXPLORER} target="_blank" rel="noreferrer" style={{ color: '#2151f5' }}>
                Track on CCIP Explorer ↗
              </a>
            </div>
          )}
          <div style={{ marginTop: 6, fontSize: 10, color: '#6366f1' }}>
            Check /tickets on Ethereum Sepolia after the message is delivered.
          </div>
        </div>
      )}
    </div>
  );
}
