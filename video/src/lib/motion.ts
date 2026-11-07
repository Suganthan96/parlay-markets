import {Easing} from 'remotion';

export const BEAT = 15; // 120 BPM at 30fps

export const E = {
  linear: (x: number) => x,
  expo: Easing.out(Easing.exp),
  pow4: Easing.out(Easing.poly(4)),
  circ: Easing.out(Easing.circle),
  back: Easing.out(Easing.back(1.7)),
  backBig: Easing.out(Easing.back(3)),
  inOut: Easing.inOut(Easing.cubic),
  inOutQuint: Easing.inOut(Easing.poly(5)),
  in: Easing.in(Easing.cubic),
};

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Progress 0..1 of `f` across [a, b], eased. */
export const p = (f: number, a: number, b: number, e: (x: number) => number = E.linear) =>
  e(clamp((f - a) / (b - a)));

/** Keyframed number: [[frame, value, easeIntoThisKey?], ...]. */
export type Key = [number, number, ((x: number) => number)?];
export const kf = (f: number, keys: Key[]) => {
  if (f <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [b, vb, e] = keys[i];
    const [a, va] = keys[i - 1];
    if (f <= b) return mix(va, vb, (e ?? E.inOut)(clamp((f - a) / (b - a))));
  }
  return keys[keys.length - 1][1];
};

/** Deterministic index-seeded pseudo-random in 0..1. */
export const rnd = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Damped screen shake starting at frame `at`. */
export const shake = (f: number, at: number, amp = 24, len = 18) => {
  if (f < at || f > at + len) return {x: 0, y: 0};
  const d = 1 - (f - at) / len;
  return {x: Math.sin(f * 2.9) * amp * d * d, y: Math.cos(f * 3.7) * amp * d * d};
};
