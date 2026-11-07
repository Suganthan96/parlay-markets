import {Composition, Folder} from 'remotion';
import {Main} from './Main';
import {HowItWorks} from './scenes/HowItWorks';
import {Intro} from './scenes/Intro';
import {Outro} from './scenes/Outro';
import {Problem} from './scenes/Problem';
import {Solution} from './scenes/Solution';

const base = {width: 1920, height: 1080, fps: 30};

export const RemotionRoot: React.FC = () => (
  <>
    <Folder name="Scenes">
      <Composition id="Intro" component={Intro} durationInFrames={240} {...base} />
      <Composition id="Problem" component={Problem} durationInFrames={360} {...base} />
      <Composition id="Solution" component={Solution} durationInFrames={240} {...base} />
      <Composition id="HowItWorks" component={HowItWorks} durationInFrames={660} {...base} />
      <Composition id="Outro" component={Outro} durationInFrames={300} {...base} />
    </Folder>
    <Composition id="ParlayMarkets" component={Main} durationInFrames={1800} {...base} />
  </>
);
