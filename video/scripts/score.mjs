// Generates the original 60s score (120 BPM, 1 beat = 15 frames at 30fps) as public/score.wav.
import {writeFileSync} from 'node:fs';
const SR = 44100, DUR = 60.5, N = Math.floor(SR * DUR), BEAT = 0.5;
const L = new Float32Array(N), R = new Float32Array(N);
const f2s = (f) => f / 30;
const add = (i, l, r = l) => { if (i >= 0 && i < N) { L[i] += l; R[i] += r; } };

function pluck(t, f, g = 0.14) { const s = Math.floor(t * SR);
  for (let i = 0; i < 0.5 * SR; i++) { const x = i / SR; const v = (Math.sin(2 * Math.PI * f * x) + 0.4 * Math.sin(4 * Math.PI * f * x)) * Math.exp(-x * 7) * g; add(s + i, v * 0.8, v); } }

// Harmony: Am F C G, one chord per 2 bars.
const CH = [[110, 220, 261.63, 329.63], [87.31, 174.61, 220, 261.63], [130.81, 196, 261.63, 329.63], [98, 196, 246.94, 293.66]];
const barsOf = (t) => t / (BEAT * 4);
const padGain = (t) => t < 2 ? 0 : t < 8 ? 0.05 : t < 17.5 ? 0.09 : t < 20 ? 0.03 : t < 30 ? 0.08 : t < 50 ? 0.1 : t < 58 ? 0.09 * (1 - (t - 50) / 10) : 0;
const bassOn = (t) => (t >= 8 && t < 17.5) || (t >= 24 && t < 50);
const pad = new Float32Array(4 * 6);
let lpL = 0, lpR = 0, bassPh = 0;
for (let i = 0; i < N; i++) { const t = i / SR; const c = CH[Math.floor(barsOf(t) / 2) % 4];
  let vL = 0, vR = 0; c.forEach((f, k) => { for (let d = 0; d < 2; d++) { const id = k * 2 + d; pad[id] = (pad[id] + (f * (d ? 1.004 : 0.996)) / SR) % 1; const saw = pad[id] * 2 - 1; if (d) vR += saw; else vL += saw; } });
  const duck = 1;
  const cut = 0.012 + 0.05 * (0.5 + 0.5 * Math.sin(t * 0.33)) + (t > 30 && t < 50 ? 0.05 : 0);
  lpL += cut * (vL - lpL); lpR += cut * (vR - lpR); const g = padGain(t) * duck * 0.42; L[i] += lpL * g; R[i] += lpR * g;
  if (bassOn(t)) { const eighth = (t % (BEAT / 2)) / (BEAT / 2); bassPh += (2 * Math.PI * c[0] * (c[0] > 100 ? 0.5 : 1)) / SR; const b = Math.tanh(Math.sin(bassPh) * 2.2) * Math.exp(-eighth * 2.2) * 0.3 * duck; L[i] += b; R[i] += b; } }
const scale = [440, 523.25, 659.25, 783.99, 880, 659.25, 523.25, 587.33];
for (let b = 0; b < 40; b++) { const t = 30 + b * BEAT / 2; if (t < 50 && b % 3 !== 1) pluck(t, scale[b % 8], 0.075); }

// Musical accents only, in absolute frames. No percussion, noise or sound effects.
[15, 30, 45].forEach((f, i) => pluck(f2s(f), [220, 261.63, 329.63][i], 0.22));
[1040, 1070, 1100, 1130].forEach((f, i) => pluck(f2s(f), [659.25, 783.99, 880, 1046.5][i], 0.2));
[1445, 1451, 1457].forEach((f, i) => pluck(f2s(f), [880, 1046.5, 1318.5][i], 0.2));

let peak = 0; for (let i = 0; i < N; i++) { L[i] = Math.tanh(L[i] * 1.15); R[i] = Math.tanh(R[i] * 1.15); peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])); }
const fade = (i) => (i > N - SR * 0.4 ? (N - i) / (SR * 0.4) : 1);
const buf = Buffer.alloc(44 + N * 4); const w = (s, o) => buf.write(s, o);
w('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); w('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); w('data', 36); buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) { const g = (0.89 / peak) * fade(i); buf.writeInt16LE(Math.round(L[i] * g * 32767), 44 + i * 4); buf.writeInt16LE(Math.round(R[i] * g * 32767), 46 + i * 4); }
writeFileSync(new URL('../public/score.wav', import.meta.url), buf);
