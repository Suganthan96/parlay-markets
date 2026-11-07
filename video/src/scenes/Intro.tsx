import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Halftone} from '../components/Halftone';
import {C, display, label} from '../lib/tokens';
import {E, kf, p, shake} from '../lib/motion';

const Letters: React.FC<{text: string; f: number; at: number; size: number; color?: string}> = ({text, f, at, size, color}) => (
  <div style={{...display(size), color, display: 'flex', overflow: 'hidden', paddingBottom: size * 0.24, marginBottom: -size * 0.24}}>
    {text.split('').map((c, i) => {
      const t = p(f, at + i * 1.6, at + i * 1.6 + 16, E.expo);
      return (
        <span key={i} style={{display: 'inline-block', transform: `translateY(${(1 - t) * 110}%) rotate(${(1 - t) * 8}deg)`, whiteSpace: 'pre'}}>
          {c}
        </span>
      );
    })}
  </div>
);

export const Intro: React.FC = () => {
  const f = useCurrentFrame();

  // Act 1: three legs slam in on the beat and become the logo.
  const barKeys = [15, 30, 45];
  const barW = [720, 480, 720];
  const fill = p(f, 62, 78, E.inOutQuint); // bars grow until they fill the frame
  const shakeNow = [15, 30, 45].reduce(
    (acc, at) => {
      const s = shake(f, at, 16, 10);
      return {x: acc.x + s.x, y: acc.y + s.y};
    },
    {x: 0, y: 0},
  );

  // Act 2: the site's grid, then the page tilts back behind the tagline.
  const tilt = p(f, 158, 186, E.inOutQuint);
  const wave = (x: number, y: number, fr: number) => {
    const d = Math.hypot(x - 480, y - 540);
    const front = p(fr, 84, 150) * 2400;
    const hit = Math.max(0, 1 - Math.abs(d - front) / 200);
    return (d < front ? 1 : 0) + hit * 1.5 + Math.sin(d * 0.018 - fr * 0.22) * 0.25;
  };

  return (
    <AbsoluteFill style={{background: C.black, overflow: 'hidden'}}>
      {/* Column rules drawing in */}
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: (1920 / 4) * i,
            top: 0,
            width: 1,
            height: 1080,
            background: '#333',
            transformOrigin: i % 2 ? 'top' : 'bottom',
            transform: `scaleY(${p(f, 0 + i * 2, 18 + i * 2, E.expo)})`,
          }}
        />
      ))}

      {/* Three legs → logo */}
      <div style={{position: 'absolute', inset: 0, display: f >= 80 ? 'none' : 'block', transform: `translate(${shakeNow.x}px,${shakeNow.y}px)`}}>
        {barKeys.map((at, i) => {
          const t = p(f, at, at + 12, E.expo);
          const y = 300 + i * 180;
          const colors = [C.white, C.mint, C.white];
          const sx = (barW[i] * t + (2200 - barW[i] * t) * fill) / 720;
          const sy = 1 + fill * 2.4;
          const yFill = y + (i - 1) * fill * 60;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: 960 - 360 * (1 - fill) - 1100 * fill,
                top: yFill,
                width: 720,
                height: 120,
                background: colors[i],
                transformOrigin: 'left center',
                transform: `translateX(${(1 - t) * (i % 2 ? 1400 : -1400)}px) scale(${sx}, ${sy})`,
              }}
            />
          );
        })}
      </div>

      {/* Landing-page grid, rebuilt from the site's cells */}
      {f >= 76 && (
        <AbsoluteFill style={{perspective: 1500}}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              transformOrigin: '50% 50%',
              transform: `translateZ(${-1100 * tilt}px) rotateX(${tilt * 52}deg) rotateZ(${tilt * -18}deg)`,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gridTemplateRows: '1fr 1fr',
              gap: 1,
              background: C.midGray,
            }}
          >
            <div style={{background: C.white, display: 'flex', alignItems: 'flex-end', padding: 60}}>
              <Letters text="Parlay" f={f} at={84} size={230} color={C.black} />
            </div>
            <div style={{overflow: 'hidden'}}>
              <Halftone width={960} height={540} wave={(x, y, fr) => wave(x + 960, y, fr)} />
            </div>
            <div style={{overflow: 'hidden'}}>
              <Halftone width={960} height={540} gap={10} radius={2.6} bg="#d0d0d0" wave={(x, y, fr) => wave(x, y + 540, fr)} />
            </div>
            <div style={{background: C.lightGray, display: 'flex', alignItems: 'flex-end', padding: 60}}>
              <Letters text="Markets" f={f} at={100} size={214} color={C.black} />
            </div>
          </div>
        </AbsoluteFill>
      )}

      {/* Tagline slams */}
      {f >= 160 && (
        <AbsoluteFill style={{justifyContent: 'center', padding: '0 110px', background: `rgba(17,17,17,${p(f, 160, 176) * 0.86})`}}>
          <div
            style={{
              ...display(176),
              color: C.white,
              opacity: p(f, 165, 167),
              transform: `scale(${kf(f, [[165, 1.5], [177, 1, E.pow4]])})`,
              transformOrigin: 'left center',
            }}
          >
            THE FIRST
          </div>
          <div style={{...display(176), color: C.white, opacity: p(f, 180, 182), transform: `translateX(${kf(f, [[180, -340], [191, 0, E.expo]])}px)`}}>
            PARLAY
          </div>
          <div
            style={{
              ...display(176),
              color: C.mint,
              opacity: p(f, 195, 197),
              transform: `translateY(${kf(f, [[195, 90], [207, 0, E.circ]])}px) rotate(${kf(f, [[195, 4], [207, 0, E.circ]])}deg)`,
              transformOrigin: 'left bottom',
            }}
          >
            ON 1INCH AQUA.
          </div>
          <div style={{...label, color: '#999', marginTop: 34, opacity: p(f, 208, 216)}}>ETHGlobal Mumbai 2026</div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
