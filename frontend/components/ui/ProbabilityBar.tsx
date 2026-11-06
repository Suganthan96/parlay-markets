export function ProbabilityBar({ pct }: { pct: number }) {
  return (
    <div className="prob-bar">
      <div className="prob-bar-fill" style={{ width: `${pct * 100}%` }} />
    </div>
  );
}
