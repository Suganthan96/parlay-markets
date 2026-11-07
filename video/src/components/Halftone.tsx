import {useLayoutEffect, useRef} from 'react';
import {useCurrentFrame} from 'remotion';

/** Animated halftone field from the site's .halftone cells. Dot radius follows a travelling wave. */
export const Halftone: React.FC<{
  width: number;
  height: number;
  gap?: number;
  radius?: number;
  color?: string;
  bg?: string;
  wave?: (x: number, y: number, f: number) => number;
  style?: React.CSSProperties;
}> = ({width, height, gap = 12, radius = 2.2, color = 'rgba(0,0,0,0.5)', bg = '#EBEBEB', wave, style}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const f = useCurrentFrame();
  useLayoutEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let y = gap / 2; y < height; y += gap) {
      for (let x = gap / 2; x < width; x += gap) {
        const r = radius * (wave ? wave(x, y, f) : 1);
        if (r <= 0.05) continue;
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, Math.PI * 2);
      }
    }
    ctx.fill();
  });
  return <canvas ref={ref} width={width} height={height} style={{display: 'block', ...style}} />;
};
