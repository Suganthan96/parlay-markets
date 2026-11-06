type Chain = 'sepolia' | 'arkiv';

export function TxLink({ hash, chain = 'sepolia' }: { hash: string; chain?: Chain }) {
  const short = `${hash.slice(0, 6)}…${hash.slice(-4)}`;
  const base = chain === 'arkiv'
    ? 'https://explorer.rabdi.db-chain.testnet.arkiv.network'
    : 'https://sepolia.etherscan.io';
  return (
    <a
      href={`${base}/tx/${hash}`}
      target="_blank"
      rel="noopener noreferrer"
      className="mono underline"
      style={{ fontSize: 10 }}
    >
      TX {short}
    </a>
  );
}
