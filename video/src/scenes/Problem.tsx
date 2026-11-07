import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {Coin, Cuboid, Source, Stage} from '../components/Solid';
import {C, SERIF, display, label} from '../lib/tokens';
import {E, kf, mix, p, rnd, shake} from '../lib/motion';

const count = (f: number, a: number, b: number, to: number) => Math.round(p(f, a, b, E.pow4) * to);

// Stat 1: 63% of NJ online sportsbook revenue, as a filling tile field.
const NewJersey: React.FC<{f: number}> = ({f}) => {
  const v = count(f, 6, 58, 63);
  return (
    <AbsoluteFill style={{background: C.white, flexDirection: 'row'}}>
      <div style={{width: 1100, padding: '110px 0 90px 110px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between'}}>
        <div style={{...label, opacity: p(f, 2, 8)}}>■ The biggest product in betting</div>
        <div style={{...display(430), transform: `scale(${mix(0.72, 1, v / 63)})`, transformOrigin: 'left bottom', fontVariantNumeric: 'tabular-nums'}}>{v}%</div>
        <div style={{opacity: p(f, 26, 36), transform: `translateY(${(1 - p(f, 26, 40, E.expo)) * 30}px)`}}>
          <div style={{fontFamily: SERIF, fontWeight: 700, fontSize: 52, lineHeight: 1.12}}>of New Jersey online sports betting revenue came from parlays.</div>
          <div style={{marginTop: 22}}>
            <Source>Through Oct 2025 · Financial Times, via TS2</Source>
          </div>
        </div>
      </div>
      <div style={{flex: 1, display: 'grid', gridTemplateColumns: 'repeat(10,1fr)', gridAutoRows: 72, gap: 6, padding: '160px 90px 0 60px', alignContent: 'start'}}>
        {Array.from({length: 100}, (_, i) => {
          const r = 9 - Math.floor(i / 10);
          const idx = r * 10 + (i % 10);
          const on = idx < v;
          const t = p(f, 2 + i * 0.12, 10 + i * 0.12, E.back);
          return <div key={i} style={{background: on ? C.black : C.lightGray, transform: `scale(${t})`}} />;
        })}
      </div>
    </AbsoluteFill>
  );
};

// Stat 2: Kalshi parlay share, under 3% to about 22%.
const Kalshi: React.FC<{f: number}> = ({f}) => {
  const grow = p(f, 18, 58, E.pow4);
  const v = interpolate(grow, [0, 1], [3, 22]);
  const H = 700;
  return (
    <AbsoluteFill style={{background: C.black, color: C.white, flexDirection: 'row'}}>
      <div style={{width: 1020, padding: '110px 0 90px 110px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between'}}>
        <div style={{...label, color: '#888'}}>■ And it is moving to prediction markets</div>
        <div>
          <div style={{...display(330), color: C.mint, fontVariantNumeric: 'tabular-nums'}}>{f < 18 ? '<3%' : `${v.toFixed(0)}%`}</div>
          <div style={{fontFamily: SERIF, fontWeight: 700, fontSize: 52, lineHeight: 1.12, marginTop: 24}}>of Kalshi volume, in seven months.</div>
        </div>
        <Source color="#888">Sep 2025 to Apr 2026 · Sports Illustrated</Source>
      </div>
      <div style={{flex: 1, position: 'relative'}}>
        {[
          {x: 90, h: (3 / 22) * H, t: p(f, 2, 14, E.expo), c: '#555', top: '<3%', name: 'Sep 2025'},
          {x: 430, h: (v / 22) * H, t: 1, c: C.mint, top: f < 18 ? '<3%' : `~${v.toFixed(0)}%`, name: 'Apr 2026'},
        ].map((b) => (
          <div key={b.name}>
            <div style={{position: 'absolute', left: b.x, bottom: 150, width: 260, height: b.h * b.t, background: b.c}} />
            <div style={{position: 'absolute', left: b.x, bottom: 150 + b.h * b.t + 14, width: 260, ...display(60)}}>{b.top}</div>
            <div style={{position: 'absolute', left: b.x, bottom: 100, ...label, color: '#888'}}>{b.name}</div>
          </div>
        ))}
        <div style={{position: 'absolute', left: 40, right: 90, bottom: 148, height: 2, background: '#444'}} />
      </div>
    </AbsoluteFill>
  );
};

// Stat 3: full-frame slam.
const Combos: React.FC<{f: number}> = ({f}) => {
  const s = shake(f, 0, 20, 12);
  return (
    <AbsoluteFill style={{background: C.mint, color: C.black, justifyContent: 'center', padding: '0 110px', transform: `translate(${s.x}px,${s.y}px)`}}>
      <div style={{...display(420), transform: `scale(${kf(f, [[0, 1.7], [10, 1, E.pow4]])})`, transformOrigin: 'left center', whiteSpace: 'nowrap'}}>$100M+</div>
      <div style={{fontFamily: SERIF, fontWeight: 700, fontSize: 60, marginTop: 30, opacity: p(f, 6, 12)}}>Kalshi Combos volume in a single week.</div>
      <div style={{marginTop: 18, opacity: p(f, 10, 16)}}>
        <Source color="#3a6b48">Financial Times, via TS2</Source>
      </div>
    </AbsoluteFill>
  );
};

// The turn: on-chain, LP capital gets locked up in a pool.
const Locked: React.FC<{f: number}> = ({f}) => {
  const drop = 30; // frame of impact (absolute 525)
  const y = kf(f, [[8, -1100], [drop, 40, E.in]]);
  const squash = f >= drop ? 1 + Math.sin((f - drop) * 0.9) * 0.05 * Math.exp(-(f - drop) * 0.25) : 1;
  const s = shake(f, drop, 42, 22);
  const ry = -24 + f * 0.12;
  return (
    <AbsoluteFill style={{background: C.black, transform: `translate(${s.x}px,${s.y}px)`}}>
      <div style={{position: 'absolute', left: 110, top: 110, ...label, color: '#888', opacity: p(f, 0, 6)}}>■ But on-chain</div>
      <div style={{position: 'absolute', left: 110, top: 165, width: 900, lineHeight: 1}}>
        <div style={{...display(150), lineHeight: 1.04, color: C.white, opacity: p(f, 2, 6), transform: `translateX(${(1 - p(f, 2, 14, E.expo)) * -180}px)`}}>LP money</div>
        <div style={{...display(150), lineHeight: 1.04, color: C.white, opacity: p(f, 14, 18), transform: `translateX(${(1 - p(f, 14, 26, E.expo)) * -180}px)`}}>gets locked</div>
        <div style={{...display(150), lineHeight: 1.04, color: C.loss, opacity: p(f, drop, drop + 2), transform: `scale(${kf(f, [[drop, 1.5], [drop + 10, 1, E.pow4]])})`, transformOrigin: 'left center'}}>in a pool.</div>
      </div>
      <div style={{position: 'absolute', left: 110, bottom: 96, width: 820, fontFamily: SERIF, fontWeight: 600, fontSize: 40, lineHeight: 1.2, color: '#aaa', opacity: p(f, drop + 14, drop + 24)}}>
        Deposited upfront. Capital sits idle before a single bet is placed.
      </div>
      <Stage perspective={1300}>
        {/* Coins scatter on impact */}
        {Array.from({length: 16}, (_, i) => {
          const t = Math.max(0, f - drop);
          const a = rnd(i) * Math.PI * 2;
          const v = 7 + rnd(i + 20) * 12;
          const launched = f >= drop;
          const x = 470 + Math.cos(a) * (launched ? v * t : 40 + rnd(i + 3) * 170);
          const yy = 280 + (launched ? -Math.abs(Math.sin(a)) * v * t + 0.42 * t * t : -rnd(i + 7) * 40);
          return <Coin key={i} size={62} pose={{x, y: Math.min(330, yy), z: launched ? rnd(i + 9) * 260 - 130 : rnd(i + 5) * 120 - 60, rx: 62 + t * rnd(i) * 22, rz: t * 14 * rnd(i + 2)}} />;
        })}
        <Cuboid
          w={560}
          h={420}
          d={420}
          edge="#2a2a2a"
          top="#333"
          pose={{x: 470, y: y, rx: -14, ry, s: squash}}
          front={
            <div style={{position: 'absolute', inset: 0, background: C.loss, color: C.black, padding: 34, display: 'flex', flexDirection: 'column', justifyContent: 'space-between'}}>
              <div style={{...label}}>LP pool</div>
              <div style={{...display(170)}}>$$$</div>
              <div style={{...label, fontSize: 20}}>Locked until settlement</div>
            </div>
          }
        />
      </Stage>
    </AbsoluteFill>
  );
};

export const Problem: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      {f < 100 && <NewJersey f={f} />}
      {f >= 100 && f < 205 && <Kalshi f={f - 100} />}
      {f >= 205 && f < 255 && <Combos f={f - 205} />}
      {f >= 255 && <Locked f={f - 255} />}
    </AbsoluteFill>
  );
};
