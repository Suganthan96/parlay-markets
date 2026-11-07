import {C, MONO, SERIF, display, label} from '../lib/tokens';

/** Real 3D stage: one static lens, children anchored at the frame centre. */
export const Stage: React.FC<{children: React.ReactNode; perspective?: number; style?: React.CSSProperties}> = ({
  children,
  perspective = 1500,
  style,
}) => (
  <div style={{position: 'absolute', inset: 0, perspective, perspectiveOrigin: '50% 50%', overflow: 'hidden', ...style}}>
    <div style={{position: 'absolute', left: '50%', top: '50%', transformStyle: 'preserve-3d'}}>{children}</div>
  </div>
);

export type Pose = {x?: number; y?: number; z?: number; rx?: number; ry?: number; rz?: number; s?: number};
export const poseCss = ({x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1}: Pose) =>
  `translate3d(${x}px,${y}px,${z}px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale3d(${s},${s},${s})`;

/** Extruded box with six real faces, centred on its pose. */
export const Cuboid: React.FC<{
  w: number;
  h: number;
  d: number;
  pose: Pose;
  front: React.ReactNode;
  back?: React.ReactNode;
  edge?: string;
  edgeDark?: string;
  top?: string;
}> = ({w, h, d, pose, front, back, edge = '#1d1d1d', edgeDark = '#0a0a0a', top}) => {
  const face = (t: string, width: number, height: number, bg: string, children?: React.ReactNode) => (
    <div
      style={{
        position: 'absolute',
        left: (w - width) / 2,
        top: (h - height) / 2,
        width,
        height,
        background: bg,
        transform: t,
        backfaceVisibility: 'hidden',
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  );
  return (
    <div
      style={{
        position: 'absolute',
        width: w,
        height: h,
        marginLeft: -w / 2,
        marginTop: -h / 2,
        transformStyle: 'preserve-3d',
        transform: poseCss(pose),
      }}
    >
      {face(`translateZ(${d / 2}px)`, w, h, C.white, front)}
      {face(`rotateY(180deg) translateZ(${d / 2}px)`, w, h, C.black, back)}
      {face(`rotateY(90deg) translateZ(${w / 2}px)`, d, h, edge)}
      {face(`rotateY(-90deg) translateZ(${w / 2}px)`, d, h, edge)}
      {face(`rotateX(90deg) translateZ(${h / 2}px)`, w, d, top ?? edge)}
      {face(`rotateX(-90deg) translateZ(${h / 2}px)`, w, d, edgeDark)}
    </div>
  );
};

/** Moving specular band, driven by the object's rotation so the surface reads as lit. */
export const Sheen: React.FC<{ry: number; rx?: number; strength?: number}> = ({ry, rx = 0, strength = 0.55}) => {
  const pos = 50 + ry * 2.4 + rx * 0.8;
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        background: `linear-gradient(112deg, rgba(255,255,255,0) ${pos - 22}%, rgba(255,255,255,${strength}) ${pos}%, rgba(255,255,255,0) ${pos + 22}%)`,
        mixBlendMode: 'overlay',
      }}
    />
  );
};

export const Logo: React.FC<{size: number; color?: string}> = ({size, color = 'currentColor'}) => (
  <svg viewBox="0 0 48 48" width={size} height={size} fill={color}>
    <rect x="6" y="6" width="36" height="8" />
    <rect x="6" y="20" width="24" height="8" />
    <rect x="6" y="34" width="36" height="8" />
  </svg>
);

export const MARKETS = {
  a: {home: 'Man City', away: 'Arsenal', tag: 'EPL'},
  b: {home: 'Real Madrid', away: 'Barcelona', tag: 'UCL'},
};

/** Front of a market card, following PolyCard in frontend/app/(dapp)/markets/page.tsx. */
export const MarketFace: React.FC<{m: {home: string; away: string; tag: string}; ry?: number; picked?: boolean}> = ({m, ry = 0, picked}) => (
  <div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', color: C.black, background: C.white}}>
    <div style={{...label, fontSize: 19, color: '#777', padding: '20px 26px', borderBottom: `2px solid ${C.midGray}`, display: 'flex', justifyContent: 'space-between'}}>
      <span>{m.tag} · LMSR</span>
      <span>Sepolia</span>
    </div>
    <div style={{flex: 1, padding: 26, display: 'flex', flexDirection: 'column', justifyContent: 'space-between'}}>
      <div style={{...display(58), lineHeight: 1}}>
        {m.home}
        <div style={{...display(30), color: '#999', margin: '8px 0', letterSpacing: 0}}>vs</div>
        {m.away}
      </div>
      <div>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
          <span style={{...display(84), color: C.green}}>50%</span>
          <span style={{...display(84), color: '#999'}}>50%</span>
        </div>
        <div style={{...label, fontSize: 19, display: 'flex', justifyContent: 'space-between', marginTop: 8}}>
          <span style={{color: C.green}}>Home</span>
          <span style={{color: '#999'}}>Away</span>
        </div>
        <div style={{height: 10, background: '#eee', marginTop: 14}}>
          <div style={{height: '100%', width: '50%', background: C.green}} />
        </div>
      </div>
    </div>
    <div style={{...label, fontSize: 19, padding: '18px 26px', background: picked ? C.mint : C.white, borderTop: `2px solid ${C.midGray}`}}>
      {picked ? '✓ In parlay · Home' : 'Add to parlay'}
    </div>
    <Sheen ry={ry} />
  </div>
);

export const CardBack: React.FC = () => (
  <div style={{position: 'absolute', inset: 0, background: C.black, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.mint}}>
    <Logo size={170} />
  </div>
);

/** Flat ticket front; legs tick over to won when `won` > 0. */
export const TicketFace: React.FC<{won?: number; ry?: number}> = ({won = 0, ry = 0}) => {
  const legs = [
    ['Man City', 'Arsenal'],
    ['Real Madrid', 'Barcelona'],
  ];
  return (
    <div style={{position: 'absolute', inset: 0, background: won >= 2 ? C.mint : C.white, color: C.black, display: 'flex', flexDirection: 'column'}}>
      <div style={{background: C.black, color: C.white, padding: '16px 26px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
        <span style={{display: 'flex', alignItems: 'center', gap: 12, ...label}}>
          <Logo size={30} color={C.mint} /> Parlay ticket
        </span>
        <span style={{...label, fontSize: 19, color: C.mint}}>{won >= 2 ? '✓ Won' : '● Live'}</span>
      </div>
      {legs.map(([h, a], i) => (
        <div key={h} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 26px', borderBottom: `2px solid ${won >= 2 ? '#8fdca3' : C.midGray}`}}>
          <span style={{fontFamily: SERIF, fontWeight: 700, fontSize: 28}}>
            {h} <span style={{color: '#777', fontWeight: 600}}>vs {a}</span>
          </span>
          <span style={{...label, fontSize: 19, color: won > i ? C.green : '#999'}}>{won > i ? '✓ Won' : 'Pending'}</span>
        </div>
      ))}
      <div style={{flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 26px'}}>
        <div>
          <div style={{...label, fontSize: 18, color: '#555'}}>Stake</div>
          <div style={{...display(52)}}>$10.00</div>
        </div>
        <div style={{textAlign: 'right'}}>
          <div style={{...label, fontSize: 18, color: '#555'}}>{won >= 2 ? 'Pays' : 'If all win'}</div>
          <div style={{...display(52)}}>$36.36</div>
        </div>
      </div>
      <Sheen ry={ry} />
    </div>
  );
};

/** Coin with a real rim: stacked discs in Z. */
export const Coin: React.FC<{pose: Pose; size?: number; color?: string}> = ({pose, size = 70, color = C.mint}) => (
  <div style={{position: 'absolute', width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2, transformStyle: 'preserve-3d', transform: poseCss(pose)}}>
    {[0, 1, 2, 3, 4, 5, 6].map((i) => (
      <div
        key={i}
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: i === 6 ? color : '#6fbf86',
          transform: `translateZ(${i * 1.6 - 5}px)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: SERIF,
          fontWeight: 900,
          fontSize: size * 0.56,
          color: C.black,
        }}
      >
        {i === 6 ? '$' : null}
      </div>
    ))}
  </div>
);

export const Source: React.FC<{children: React.ReactNode; color?: string}> = ({children, color = '#777'}) => (
  <div style={{fontFamily: MONO, fontWeight: 500, fontSize: 24, color, letterSpacing: '0.02em'}}>{children}</div>
);

/** Soft contact shadow; a flat leaf, so its blur can't flatten the 3D parent. */
export const Shadow: React.FC<{x: number; y: number; w: number; o?: number}> = ({x, y, w, o = 0.28}) => (
  <div style={{position: 'absolute', left: x - w / 2, top: y, width: w, height: w * 0.16, borderRadius: '50%', background: `rgba(0,0,0,${o})`, filter: 'blur(22px)'}} />
);
