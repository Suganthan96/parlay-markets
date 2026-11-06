export function TxLink({ hash }: { hash: string }) {
  const short = `${hash.slice(0, 6)}…${hash.slice(-4)}`;
  return (
    <a
      href={`https://explorer.rabdi.db-chain.testnet.arkiv.network/tx/${hash}`}
      target="_blank"
      rel="noopener noreferrer"
      className="mono underline"
      style={{ fontSize: 10 }}
    >
      TX {short}
    </a>
  );
}
