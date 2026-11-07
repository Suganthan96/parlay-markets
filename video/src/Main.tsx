import {Audio} from '@remotion/media';
import {TransitionSeries} from '@remotion/transitions';
import {AbsoluteFill, staticFile, useCurrentFrame} from 'remotion';
import {HowItWorks} from './scenes/HowItWorks';
import {Intro} from './scenes/Intro';
import {Outro} from './scenes/Outro';
import {Problem} from './scenes/Problem';
import {Solution} from './scenes/Solution';
import {C} from './lib/tokens';
import {E, p} from './lib/motion';

// Scene cuts hide behind a shutter of the site's four grid columns.
const CUTS = [
  {at: 240, c: C.mint},
  {at: 600, c: C.black},
  {at: 840, c: C.mint},
  {at: 1500, c: C.black},
];

const Shutter: React.FC = () => {
  const f = useCurrentFrame();
  const cut = CUTS.find((x) => f >= x.at - 16 && f <= x.at + 16);
  if (!cut) return null;
  return (
    <AbsoluteFill style={{flexDirection: 'row'}}>
      {[0, 1, 2, 3].map((i) => {
        const inT = p(f, cut.at - 15 + i * 2, cut.at - 6 + i * 2, E.inOut);
        const outT = p(f, cut.at + i * 2, cut.at + 8 + i * 2, E.inOut);
        return (
          <div key={i} style={{flex: 1, position: 'relative', overflow: 'hidden'}}>
            <div style={{position: 'absolute', inset: '-1px', background: cut.c, transformOrigin: i % 2 ? 'bottom' : 'top', transform: `scaleY(${inT})`, opacity: outT >= 1 ? 0 : 1, clipPath: `inset(${outT * 100}% 0 0 0)`}} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export const Main: React.FC = () => (
  <AbsoluteFill style={{background: C.black}}>
    <TransitionSeries>
      <TransitionSeries.Sequence name="Intro" durationInFrames={240}>
        <Intro />
      </TransitionSeries.Sequence>
      <TransitionSeries.Sequence name="Problem" durationInFrames={360}>
        <Problem />
      </TransitionSeries.Sequence>
      <TransitionSeries.Sequence name="Solution" durationInFrames={240}>
        <Solution />
      </TransitionSeries.Sequence>
      <TransitionSeries.Sequence name="How it works" durationInFrames={660}>
        <HowItWorks />
      </TransitionSeries.Sequence>
      <TransitionSeries.Sequence name="Outro" durationInFrames={300}>
        <Outro />
      </TransitionSeries.Sequence>
    </TransitionSeries>
    <Shutter />
    <Audio src={staticFile('score.wav')} durationInFrames={1800} />
  </AbsoluteFill>
);
