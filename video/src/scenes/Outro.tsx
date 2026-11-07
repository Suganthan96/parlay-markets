import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Halftone} from '../components/Halftone';
import {CardBack, Cuboid, Logo, MARKETS, MarketFace, Source, Stage, TicketFace} from '../components/Solid';
import {C, display, label} from '../lib/tokens';
import {E, kf, p, shake} from '../lib/motion';

const ADDR = [
  ['AquaParlayRouter', '0x3617455115c85ab2bdb67c2dc8720d1d8afc0f76'],
  ['ParlayVault', '0x8d98ff91515b47f8a2b89d00cb597497dc47fbe0'],
  ['MarketResolver', '0x5d5cc1cd24943ecf43ad5e88281393418ca06bea'],
];

export const Outro: React.FC = () => {
  const f = useCurrentFrame();
  const R = kf(f, [[0, 1400], [36, 760, E.pow4], [150, 820]]);
  const items = [
    {kind: 'a', off: 0},
    {kind: 'ticket', off: (Math.PI * 2) / 3},
    {kind: 'b', off: (Math.PI * 4) / 3},
  ];
  const s = shake(f, 150, 20, 14);
  const logoOnly = p(f, 248, 258, E.inOut);

  return (
    <AbsoluteFill style={{background: C.black, overflow: 'hidden', transform: `translate(${s.x}px,${s.y}px)`}}>
      <Halftone
        width={1920}
        height={1080}
        gap={16}
        radius={2}
        bg={C.black}
        color="rgba(184,245,200,0.4)"
        wave={(x, y, fr) => {
          const d = Math.hypot(x - 960, y - 540);
          return Math.max(0, 0.15 + Math.sin(d * 0.016 - fr * 0.18) * 0.65);
        }}
        style={{position: 'absolute', inset: 0}}
      />

      {/* Orbit: objects pass behind then in front of the wordmark */}
      {f < 165 && (
        <Stage perspective={1500}>
          {items.map((it, i) => {
            const a = it.off + f * 0.035;
            const z = Math.cos(a) * R - 120;
            if (z > 0) return null; // front half drawn later, over the type
            const ry = Math.sin(a) * -34;
            return it.kind === 'ticket' ? (
              <Cuboid key={i} w={640} h={330} d={30} edge={'#7ccb91'} edgeDark={'#5aa871'} top={'#a5e8b6'} pose={{x: Math.sin(a) * R, y: Math.cos(a) * 400, z, ry, rx: -8, s: 0.62 * (1 - p(f, 124, 148, E.in))}} front={<TicketFace won={2} ry={ry} />} back={<CardBack />} />
            ) : (
              <Cuboid key={i} w={430} h={590} d={26} edge="#d8d8d8" edgeDark="#a9a9a9" top="#f2f2f2" pose={{x: Math.sin(a) * R, y: Math.cos(a) * 400, z, ry, rx: -8, s: 0.62 * (1 - p(f, 124, 148, E.in))}} front={<MarketFace m={it.kind === 'a' ? MARKETS.a : MARKETS.b} ry={ry} picked />} back={<CardBack />} />
            );
          })}
        </Stage>
      )}

      {/* Wordmark */}
      <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', opacity: 1 - logoOnly}}>
        <div style={{transform: `translateY(${kf(f, [[140, 0], [160, -170, E.pow4]])}px)`, textAlign: 'center'}}>
          <div style={{...display(250), color: C.white, opacity: p(f, 6, 12), transform: `scale(${kf(f, [[6, 1.35], [24, 1, E.pow4]])})`}}>Parlay</div>
          <div style={{...display(250), color: C.mint, opacity: p(f, 16, 22), transform: `scale(${kf(f, [[16, 1.35], [34, 1, E.pow4]])})`}}>Markets</div>
        </div>
      </AbsoluteFill>

      {f < 165 && (
        <Stage perspective={1500}>
          {items.map((it, i) => {
            const a = it.off + f * 0.035;
            const z = Math.cos(a) * R - 120;
            if (z <= 0) return null;
            const ry = Math.sin(a) * -34;
            return it.kind === 'ticket' ? (
              <Cuboid key={i} w={640} h={330} d={30} edge={'#7ccb91'} edgeDark={'#5aa871'} top={'#a5e8b6'} pose={{x: Math.sin(a) * R, y: Math.cos(a) * 400, z, ry, rx: -8, s: 0.62 * (1 - p(f, 124, 148, E.in))}} front={<TicketFace won={2} ry={ry} />} back={<CardBack />} />
            ) : (
              <Cuboid key={i} w={430} h={590} d={26} edge="#d8d8d8" edgeDark="#a9a9a9" top="#f2f2f2" pose={{x: Math.sin(a) * R, y: Math.cos(a) * 400, z, ry, rx: -8, s: 0.62 * (1 - p(f, 124, 148, E.in))}} front={<MarketFace m={it.kind === 'a' ? MARKETS.a : MARKETS.b} ry={ry} picked />} back={<CardBack />} />
            );
          })}
        </Stage>
      )}

      {/* Credits */}
      {f >= 150 && (
        <div style={{position: 'absolute', left: 110, right: 110, bottom: 80, opacity: 1 - logoOnly}}>
          <div style={{display: 'flex', justifyContent: 'center', gap: 22, marginBottom: 34}}>
            {['The first parlay on 1inch Aqua', 'Settled by Chainlink CRE'].map((t, i) => (
              <div key={t} style={{...label, fontSize: 28, background: i ? C.white : C.mint, color: C.black, padding: '14px 24px', opacity: p(f, 152 + i * 6, 156 + i * 6), transform: `translateY(${(1 - p(f, 152 + i * 6, 166 + i * 6, E.expo)) * 34}px)`}}>
                {t}
              </div>
            ))}
          </div>
          <div style={{display: 'grid', gap: 8, justifyContent: 'center'}}>
            {ADDR.map(([n, a], i) => (
              <div key={n} style={{display: 'grid', gridTemplateColumns: '300px auto', gap: 20, opacity: p(f, 170 + i * 5, 176 + i * 5)}}>
                <Source color="#888">{n}</Source>
                <Source color="#ddd">{a}</Source>
              </div>
            ))}
          </div>
          <div style={{...label, fontSize: 21, color: '#888', textAlign: 'center', marginTop: 26, opacity: p(f, 188, 196)}}>Sepolia testnet prototype · ETHGlobal Mumbai 2026</div>
        </div>
      )}

      {/* Final lockup on the last hit */}
      <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', color: C.mint, opacity: logoOnly}}>
        <div style={{transform: `scale(${kf(f, [[248, 0.7], [270, 1, E.pow4]])})`}}>
          <Logo size={320} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
