import clsx from 'clsx';

type Status = 'won' | 'live' | 'lost';

export function LegPill({ label, status }: { label: string; status: Status }) {
  return (
    <span className={clsx('leg-pill', {
      'leg-pill-won':  status === 'won',
      'leg-pill-live': status === 'live',
      'leg-pill-lost': status === 'lost',
    })}>
      {status === 'won' ? '✓' : status === 'lost' ? '✕' : '●'} {label}
    </span>
  );
}
