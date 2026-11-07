import {AbsoluteFill, Img, staticFile, useCurrentFrame} from 'remotion';
import {CardBack, Coin, Cuboid, Logo, MARKETS, MarketFace, Pose, Shadow, Stage, TicketFace} from '../components/Solid';
import {C, MONO, SERIF, display, label} from '../lib/tokens';
import {E, Key, kf, mix, p, rnd, shake} from '../lib/motion';

const STEPS = [
  {n: '01', t: 'Pick', at: 0},
  {n: '02', t: 'Price', at: 150},
  {n: '03', t: 'Buy', at: 320},
  {n: '04', t: 'Settle', at: 490},
];

// Top bar follows DAppNav: same cells, same active-black state.
const Nav: React.FC<{f: number}> = ({f}) => {
  const active = STEPS.reduce((acc, s, i) => (f >= s.at ? i : acc), 0);
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 84, background: C.white, borderBottom: `2px solid ${C.midGray}`, display: 'flex', zIndex: 5, transform: `translateY(${(1 - p(f, 0, 14, E.expo)) * -84}px)`}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 14, padding: '0 36px', borderRight: `2px solid ${C.midGray}`, color: C.black}}>
        <Logo size={34} />
        <span style={{...label, fontWeight: 900}}>Parlay</span>
      </div>
      {STEPS.map((s, i) => (
        <div key={s.n} style={{...label, display: 'flex', alignItems: 'center', gap: 14, padding: '0 40px', borderRight: `2px solid ${C.midGray}`, background: i === active ? C.black : C.white, color: i === active ? C.white : i < active ? '#888' : C.black}}>
          <span style={{color: i === active ? C.mint : '#999'}}>{s.n}</span>
          {s.t}
        </div>
      ))}
      <div style={{marginLeft: 'auto', background: C.black, color: C.white, display: 'flex', alignItems: 'center', padding: '0 34px', ...label, fontSize: 21}}>Sepolia · USDC</div>
    </div>
  );
};

const Line: React.FC<{f: number; at: number; children: React.ReactNode; size?: number; color?: string; from?: number}> = ({f, at, children, size = 110, color = C.black, from = 60}) => (
  <div style={{...display(size), color, opacity: p(f, at, at + 3), transform: `translateX(${(1 - p(f, at, at + 13, E.expo)) * from}px)`}}>{children}</div>
);

export const HowItWorks: React.FC = () => {
  const f = useCurrentFrame();
  const float = (seed: number, amp = 10) => Math.sin(f * 0.06 + seed) * amp;

  // ── Card choreography: floor → camera → math column → into the router ──
  const cardPose = (side: 0 | 1): Pose & {o?: number} => {
    const d = side * 14;
    const x0 = side ? 330 : -360;
    const y0 = side ? 250 : 120;
    const keys = (a: number, b: number, c: number, e: number, g: number): Key[] => [
      [34 + d, a],
      [96 + d, b, E.pow4],
      [150, c, E.inOut],
      [176, e, E.pow4],
      [322, e, E.linear],
      [352, g, E.in],
    ];
    const xk = keys(x0, side ? 250 : -250, side ? 250 : -250, side ? -160 : -640, 0);
    const yk = keys(y0, 85, 85, 30, 240);
    const zk = keys(-120, 120, 150, side ? 0 : 0, -60);
    const rxk = keys(60, -4, -4, 0, 0);
    const ryk = keys(0, side ? -14 : 14, side ? -8 : 8, side ? -14 : 14, 0);
    const sk: Key[] = [[34 + d, 0.42], [96 + d, 1, E.pow4], [176, 1], [322, 1], [352, 0.1, E.in]];
    return {
      x: kf(f, xk),
      y: kf(f, yk) + (f > 96 && f < 322 ? float(side * 2, 7) : 0),
      z: kf(f, zk),
      rx: kf(f, rxk),
      ry: kf(f, ryk) + (f > 96 && f < 322 ? float(side + 1, 3) : 0),
      s: kf(f, sk),
    };
  };

  // ── Coins into the router (absolute frames 1195-1270 are scored ticks) ──
  const flow = (i: number, from: number, start: number, gap: number) => {
    const t = p(f, start + i * gap, start + i * gap + 22, E.inOut);
    return {
      t,
      x: mix(from, 0, t),
      y: mix(270, 240, t) - Math.sin(t * Math.PI) * 190,
      z: Math.sin(t * Math.PI) * 120,
      rx: 70,
      rz: t * 360,
      ry: t * 180,
    };
  };

  const stationIn = p(f, 326, 350, E.pow4);
  const stationOut = p(f, 490, 510, E.inOut);
  const routerHit = shake(f, 442, 18, 14);
  const ticketUp = p(f, 442, 468, E.pow4);
  const ticketIn = f >= 442;
  const ticketSpin = kf(f, [[442, 200], [472, -8, E.pow4], [490, -8], [520, 14, E.inOut], [660, 8]]);
  const ticketX = kf(f, [[490, 0], [522, -470, E.inOut]]);
  const ticketY = kf(f, [[442, 240], [468, -110, E.pow4], [490, -110], [522, 30, E.inOut]]) + float(3, 7);
  const won = f >= 605 ? 2 : f >= 585 ? 1 : 0;
  const winFlash = p(f, 605, 609) * (1 - p(f, 609, 622));

  // ── DON pipeline ──
  const cx = 1310;
  const cy = 500;
  const nodes = Array.from({length: 7}, (_, i) => {
    const a = (i / 7) * Math.PI * 2 - Math.PI / 2 + (f - 490) * 0.004;
    return {x: cx + Math.cos(a) * 250, y: cy + Math.sin(a) * 250, i};
  });
  const consensus = p(f, 545, 575, E.pow4);
  const donStage = f >= 500;
  const pipeline = [
    {at: 502, a: 'SettlementRequested', b: 'Log trigger on Sepolia'},
    {at: 524, a: 'ESPN score', b: 'Fetched by every node'},
    {at: 546, a: 'Median consensus', b: 'Across the DON'},
    {at: 568, a: 'Signed report', b: 'Resolves the market'},
  ];

  return (
    <AbsoluteFill style={{background: C.appBg, overflow: 'hidden'}}>
      {/* The real markets grid, as a floor the camera flies across */}
      <AbsoluteFill style={{perspective: 1300, opacity: 1 - p(f, 128, 156)}}>
        <div
          style={{
            position: 'absolute',
            left: -300,
            top: 120,
            width: 2520,
            transformOrigin: '50% 50%',
            transform: `translate3d(${kf(f, [[0, 280], [150, -180, E.linear]])}px, ${kf(f, [[0, 340], [40, 120, E.pow4], [150, 200]])}px, ${kf(f, [[0, -200], [34, 0, E.pow4]])}px) rotateX(${kf(f, [[0, 28], [34, 58, E.inOut]])}deg) rotateZ(${kf(f, [[0, -10], [34, -6]])}deg)`,
            boxShadow: '0 60px 120px rgba(0,0,0,.25)',
          }}
        >
          <Img src={staticFile('markets-grid.png')} style={{display: 'block', width: '100%'}} />
        </div>
      </AbsoluteFill>

      {f < 150 && (
        <div style={{position: 'absolute', left: 90, top: 120, zIndex: 4, opacity: 1 - p(f, 134, 146)}}>
          <div style={{background: C.white, padding: '22px 34px', display: 'inline-block', boxShadow: '0 16px 40px rgba(0,0,0,.14)'}}>
            <Line f={f} at={8} size={96}>Pick your legs.</Line>
            <div style={{...label, color: '#555', marginTop: 12, opacity: p(f, 22, 30)}}>Up to 5 on one ticket · Odds preview from Polymarket</div>
          </div>
        </div>
      )}

      {/* 3D world */}
      <Stage perspective={1500}>
        {f < 356 &&
          ([0, 1] as const).map((side) => {
            const pose = cardPose(side);
            return (
              <Cuboid
                key={side}
                w={430}
                h={590}
                d={26}
                pose={pose}
                edge="#d8d8d8"
                edgeDark="#a9a9a9"
                top="#f2f2f2"
                front={<MarketFace m={side ? MARKETS.b : MARKETS.a} ry={pose.ry ?? 0} picked={f > 112 + side * 14} />}
                back={<CardBack />}
              />
            );
          })}

        {/* Stations appear for the buy */}
        {f >= 326 && f < 512 && (
          <>
            <Shadow x={0} y={370} w={460} o={0.22 * (1 - stationOut)} />
            {[
              {x: -620, w: 300, h: 220, d: 150, name: 'Bettor', sub: '−$10.00', bg: C.white, fg: C.black, edge: '#cfcfcf', edgeDark: '#aaa'},
              {x: 0, w: 400, h: 240, d: 200, name: 'AquaParlayRouter', sub: 'One transaction', bg: C.black, fg: C.white, edge: '#262626', edgeDark: '#0a0a0a'},
              {x: 620, w: 300, h: 220, d: 150, name: 'LP wallet', sub: '−$36.36', bg: C.mint, fg: C.black, edge: '#7ccb91', edgeDark: '#5aa871'},
            ].map((b, i) => (
              <Cuboid
                key={b.name}
                w={b.w}
                h={b.h}
                d={b.d}
                edge={b.edge}
                edgeDark={b.edgeDark}
                top={b.edge}
                pose={{x: b.x + (i === 1 ? routerHit.x : 0), y: mix(800, 240, stationIn) + (i === 1 ? routerHit.y : 0) + 900 * stationOut, rx: -12, ry: b.x * -0.02 + float(i, 1.5), s: 1}}
                front={
                  <div style={{position: 'absolute', inset: 0, background: b.bg, color: b.fg, padding: 22, display: 'flex', flexDirection: 'column', justifyContent: 'space-between'}}>
                    <div style={{...label, fontSize: i === 1 ? 23 : 24, letterSpacing: i === 1 ? '0.02em' : '0.1em', textTransform: i === 1 ? 'none' : 'uppercase'}}>{b.name}</div>
                    <div style={{...display(i === 1 ? 40 : 60)}}>{b.sub}</div>
                  </div>
                }
              />
            ))}
            {Array.from({length: 4}, (_, i) => {
              const c = flow(i, -620, 355, 7);
              return c.t > 0 && c.t < 1 ? <Coin key={`u${i}`} size={58} pose={c} /> : null;
            })}
            {Array.from({length: 12}, (_, i) => {
              const c = flow(i, 620, 372, 4.5);
              return c.t > 0 && c.t < 1 ? <Coin key={`l${i}`} size={58} pose={{...c, z: c.z + rnd(i) * 40}} /> : null;
            })}
          </>
        )}

        {/* The ticket */}
        {ticketIn && (
          <Cuboid
            w={640}
            h={330}
            d={30}
            edge={won >= 2 ? '#7ccb91' : '#cfcfcf'}
            edgeDark={won >= 2 ? '#5aa871' : '#a0a0a0'}
            top={won >= 2 ? '#a5e8b6' : '#eee'}
            pose={{x: ticketX, y: ticketY, z: mix(-120, 120, ticketUp), rx: -6 + float(1, 2), ry: ticketSpin, rz: float(2, 0.8), s: mix(0.2, 0.92, ticketUp) + 0.08 * stationOut}}
            front={<TicketFace won={won} ry={ticketSpin} />}
            back={<CardBack />}
          />
        )}

        {/* Win burst */}
        {f >= 605 &&
          Array.from({length: 18}, (_, i) => {
            const t = f - 605;
            const a = rnd(i + 40) * Math.PI * 2;
            const v = 9 + rnd(i + 60) * 15;
            return <Coin key={i} size={44} pose={{x: -470 + Math.cos(a) * v * t, y: 30 + Math.sin(a) * v * t + 0.28 * t * t, z: 140 + rnd(i) * 200, rx: t * 12 * rnd(i + 1), ry: t * 16 * rnd(i + 2), s: Math.max(0, 1 - t / 48)}} />;
          })}
      </Stage>

      {/* 02 PRICE: the math column. Prices detach from the cards and land here. */}
      {f >= 150 && f < 330 && (
        <div style={{position: 'absolute', left: 1030, top: 130, width: 800, opacity: 1 - p(f, 318, 328)}}>
          <div style={{...label, opacity: p(f, 160, 170)}}>■ Live LMSR prices, multiplied, plus a 10% margin</div>
          <div style={{display: 'flex', alignItems: 'baseline', gap: 26, marginTop: 34}}>
            <Line f={f} at={200} size={138} from={-420}>0.50</Line>
            <Line f={f} at={200} size={70} color="#aaa" from={0}>×</Line>
            <Line f={f} at={230} size={138} from={-240}>0.50</Line>
          </div>
          <div style={{display: 'flex', alignItems: 'baseline', gap: 26, marginTop: 8}}>
            <Line f={f} at={260} size={70} color="#aaa" from={0}>×</Line>
            <Line f={f} at={260} size={138} from={100}>1.10</Line>
            <span style={{...label, color: '#777', opacity: p(f, 266, 272)}}>Margin</span>
          </div>
          <div style={{height: 3, background: C.black, marginTop: 24, transformOrigin: 'left', transform: `scaleX(${p(f, 282, 294, E.expo)})`}} />
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 22}}>
            <div style={{...display(150), opacity: p(f, 290, 293), transform: `scale(${kf(f, [[290, 1.4], [300, 1, E.pow4]])})`, transformOrigin: 'left center'}}>0.275</div>
            <div style={{background: C.mint, padding: '16px 24px', textAlign: 'right', opacity: p(f, 296, 299), transform: `scale(${kf(f, [[296, 0.6], [308, 1, E.back]])})`}}>
              <div style={{...label, fontSize: 20}}>$10 stake pays</div>
              <div style={{...display(84), fontVariantNumeric: 'tabular-nums'}}>${(p(f, 296, 314, E.pow4) * 36.36).toFixed(2)}</div>
            </div>
          </div>
          <div style={{fontFamily: MONO, fontWeight: 500, fontSize: 25, color: '#555', marginTop: 24, opacity: p(f, 170, 180)}}>pᵢ = e^(qᵢ/b) / Σ e^(qⱼ/b)</div>
        </div>
      )}

      {/* 03 BUY */}
      {f >= 326 && f < 500 && (
        <div style={{position: 'absolute', left: 90, top: 118, width: 1740, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', opacity: 1 - p(f, 488, 498)}}>
          <Line f={f} at={330} size={118}>One transaction.</Line>
          <div style={{textAlign: 'right', opacity: p(f, 372, 380)}}>
            <div style={{background: C.black, color: C.mint, fontFamily: MONO, fontWeight: 700, fontSize: 30, padding: '12px 20px', display: 'inline-block'}}>Aqua.pull(lp, hash, USDC, 36.36)</div>
            <div style={{...label, color: '#555', marginTop: 14, opacity: p(f, 446, 456)}}>ParlayVault mints the ticket</div>
          </div>
        </div>
      )}

      {/* 04 SETTLE: DON nodes reach consensus. */}
      {donStage && (
        <>
          <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
            {nodes.map((n, i) => {
              const t = p(f, 508 + i * 2.5, 528 + i * 2.5, E.pow4);
              return <line key={i} x1={n.x} y1={n.y} x2={mix(n.x, cx, t)} y2={mix(n.y, cy, t)} stroke={C.black} strokeWidth={3} />;
            })}
          </svg>
          {nodes.map((n, i) => (
            <div key={i} style={{position: 'absolute', left: n.x - 26, top: n.y - 26, width: 52, height: 52, background: f >= 548 + i * 2 ? C.mint : C.white, border: `3px solid ${C.black}`, transform: `scale(${p(f, 500 + i * 2, 512 + i * 2, E.backBig)}) rotate(45deg)`}} />
          ))}
          <div style={{position: 'absolute', left: cx - 130, top: cy - 130, width: 260, height: 260, borderRadius: '50%', background: consensus > 0.9 ? C.mint : C.black, color: consensus > 0.9 ? C.black : C.white, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', transform: `scale(${p(f, 504, 520, E.back)})`}}>
            <div style={{...label, fontSize: 18}}>Example score</div>
            <div style={{...display(100), fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap'}}>{consensus > 0.4 ? '2–1' : `${Math.floor(rnd(Math.floor(f / 2)) * 4)}–${Math.floor(rnd(Math.floor(f / 2) + 9) * 4)}`}</div>
            <div style={{...label, fontSize: 18, opacity: consensus}}>Consensus</div>
          </div>
          <div style={{position: 'absolute', left: 90, top: 118, ...display(104), opacity: p(f, 494, 498), transform: `translateX(${(1 - p(f, 494, 508, E.expo)) * -60}px)`}}>Chainlink CRE settles.</div>
          <div style={{position: 'absolute', left: 90, bottom: 56, right: 90, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 2, background: C.midGray}}>
            {pipeline.map((s) => (
              <div key={s.a} style={{background: f >= s.at ? C.black : C.white, color: f >= s.at ? C.white : C.black, padding: '16px 20px', opacity: p(f, s.at - 10, s.at - 4)}}>
                <div style={{fontFamily: SERIF, fontWeight: 700, fontSize: 30}}>{s.a}</div>
                <div style={{...label, fontSize: 17, color: f >= s.at ? C.mint : '#777', marginTop: 4, letterSpacing: '0.06em'}}>{s.b}</div>
              </div>
            ))}
          </div>
          {f >= 606 && (
            <div style={{position: 'absolute', left: 90, top: 790, ...display(74), color: C.black, opacity: p(f, 606, 609), transform: `translateY(${(1 - p(f, 606, 620, E.expo)) * 30}px)`}}>
              All legs win. Ticket pays $36.36.
            </div>
          )}
        </>
      )}
      <AbsoluteFill style={{background: C.mint, opacity: winFlash * 0.55, pointerEvents: 'none'}} />
      <Nav f={f} />
    </AbsoluteFill>
  );
};
