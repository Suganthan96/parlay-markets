type Chain = 'sepolia' | 'arkiv';

const EXPLORER: Record<Chain, string> = {
  sepolia: 'https://sepolia.etherscan.io',
  arkiv:   'https://explorer.rabdi.db-chain.testnet.arkiv.network',
};

export function TxLink({ hash, chain = 'sepolia' }: { hash: string; chain?: Chain }) {
  const short = `${hash.slice(0, 6)}…${hash.slice(-4)}`;
  return (
    <a
      href={`${EXPLORER[chain]}/tx/${hash}`}
      target="_blank"
      rel="noopener noreferrer"
      className="mono underline"
      style={{ fontSize: 10 }}
    >
      TX {short}
    </a>
  );
}

export function AddrLink({ address, label, chain = 'sepolia' }: { address: string; label?: string; chain?: Chain }) {
  const short = `${address.slice(0, 6)}…${address.slice(-4)}`;
  return (
    <a
      href={`${EXPLORER[chain]}/address/${address}`}
      target="_blank"
      rel="noopener noreferrer"
      className="mono underline"
      style={{ fontSize: 10 }}
    >
      {label ?? short}
    </a>
  );
}
