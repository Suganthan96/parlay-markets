import {AbsoluteFill, Img, staticFile, useCurrentFrame} from 'remotion';
import {Halftone} from '../components/Halftone';
import {Coin, Cuboid, Logo, Shadow, Source, Stage} from '../components/Solid';
import {C, MONO, display, label} from '../lib/tokens';
import {E, kf, p} from '../lib/motion';

export const Solution: React.FC = () => {
  const f = useCurrentFrame();
  const ry = kf(f, [[0, -70], [26, -22, E.pow4], [240, -8, E.linear]]);
  const wy = kf(f, [[0, 500], [24, -110, E.pow4]]) + Math.sin(f * 0.07) * 8;
  const shipT = p(f, 70, 110, E.pow4);
  const orbitR = 470 * shipT;
  const ledger = p(f, 130, 158, E.pow4);

  return (
    <AbsoluteFill style={{background: C.white}}>
      <Halftone
        width={1920}
        height={1080}
        gap={14}
        radius={2}
        bg="#ffffff"
        color="rgba(0,0,0,0.22)"
        wave={(x, y, fr) => {
          const d = Math.hypot(x - 1320, y - 560);
          return 0.5 + Math.sin(d * 0.02 - fr * 0.16) * 0.5 * Math.min(1, d / 400);
        }}
        style={{position: 'absolute', inset: 0}}
      />
      <div style={{position: 'absolute', left: 110, top: 100, width: 880}}>
        <div style={{...label, opacity: p(f, 0, 8)}}>■ The fix: 1inch Aqua</div>
        <div style={{...display(150), marginTop: 26, opacity: p(f, 4, 8), transform: `translateY(${(1 - p(f, 4, 18, E.expo)) * 70}px)`}}>Keep it in</div>
        <div style={{...display(150), opacity: p(f, 14, 18), transform: `translateY(${(1 - p(f, 14, 28, E.expo)) * 70}px)`}}>the wallet.</div>
        <div style={{fontFamily: 'inherit', ...display(46), fontWeight: 600, letterSpacing: 0, lineHeight: 1.2, marginTop: 40, width: 780, opacity: p(f, 40, 52)}}>
          The LP ships a virtual balance. Funds move only when a bet is placed.
        </div>
        <div style={{marginTop: 44, display: 'inline-block', background: C.black, color: C.mint, padding: '14px 22px', fontFamily: MONO, fontWeight: 700, fontSize: 28, opacity: p(f, 66, 72), transform: `translateX(${(1 - p(f, 66, 80, E.expo)) * -60}px)`}}>
          Aqua.ship(router, strategy, [USDC], [reserve])
        </div>
      </div>

      <Stage perspective={1500}>
        <Shadow x={460} y={200} w={640 * (1 - (wy + 110) / 1200)} o={0.2} />
        <Cuboid
          w={620}
          h={390}
          d={130}
          edge="#232323"
          top="#2e2e2e"
          pose={{x: 460, y: wy, rx: -10, ry}}
          front={
            <div style={{position: 'absolute', inset: 0, background: C.black, color: C.white, padding: 30, display: 'flex', flexDirection: 'column', justifyContent: 'space-between'}}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <span style={{...label, color: '#aaa'}}>LP wallet</span>
                <Logo size={38} color={C.mint} />
              </div>
              <div>
                <div style={{...label, fontSize: 19, color: '#888'}}>Sepolia · USDC</div>
                <div style={{...display(104), marginTop: 6}}>$2,025.18</div>
              </div>
              <div style={{...label, fontSize: 19, color: C.mint, opacity: p(f, 110, 118)}}>Balance unchanged by ship()</div>
            </div>
          }
        />
        {/* Virtual balance orbiting the wallet: same money, recorded, not moved */}
        {Array.from({length: 9}, (_, i) => {
          const a = (i / 9) * Math.PI * 2 + f * 0.035;
          return (
            <Coin
              key={i}
              size={66}
              color={C.mint}
              pose={{
                x: 460 + Math.cos(a) * (orbitR + 10),
                y: wy + Math.sin(a) * orbitR * 0.58,
                z: Math.sin(a) * orbitR,
                ry: (a * 180) / Math.PI,
                s: shipT,
              }}
            />
          );
        })}
      </Stage>

      {/* Real LP console ledger from the app */}
      <div style={{position: 'absolute', right: 70, bottom: 50, width: 960, perspective: 1200, opacity: p(f, 130, 136)}}>
        <div style={{transform: `translateY(${(1 - ledger) * 260}px) rotateX(${(1 - ledger) * 34 + 3}deg)`, transformOrigin: '50% 100%', border: `2px solid ${C.black}`, background: '#f5f5f5', boxShadow: '0 30px 60px rgba(0,0,0,.25)'}}>
          <Img src={staticFile('lp-ledger.png')} style={{display: 'block', width: '100%'}} />
        </div>
        <div style={{marginTop: 10, textAlign: 'right'}}>
          <Source>LP console · Sepolia</Source>
        </div>
      </div>
    </AbsoluteFill>
  );
};
