import {loadFont as loadSerif} from '@remotion/google-fonts/SourceSerif4';
import {loadFont as loadMono} from '@remotion/google-fonts/JetBrainsMono';

const serif = loadSerif('normal', {weights: ['600', '700', '900'], subsets: ['latin']});
const mono = loadMono('normal', {weights: ['500', '700'], subsets: ['latin']});

// Tokens lifted from frontend/app/globals.css.
export const C = {
  black: '#111111',
  white: '#ffffff',
  mint: '#B8F5C8',
  lightGray: '#E8E8E8',
  midGray: '#D0D0D0',
  halftoneBg: '#EBEBEB',
  appBg: '#EFEDE8',
  green: '#16a34a',
  loss: '#FF5A4E',
};
export const SERIF = serif.fontFamily;
export const MONO = mono.fontFamily;

export const label: React.CSSProperties = {
  fontFamily: SERIF,
  fontWeight: 700,
  fontSize: 24,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
};
export const display = (size: number): React.CSSProperties => ({
  fontFamily: SERIF,
  fontWeight: 900,
  fontSize: size,
  lineHeight: 0.92,
  letterSpacing: '-0.03em',
});
