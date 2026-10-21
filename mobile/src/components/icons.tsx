/**
 * Wavelength's own icon set (docs/specs/art-first.md). Drawn on a 24×24 grid
 * with one stroke weight and round caps; curves are deliberately a little
 * uneven so the set reads as drawn, not generated. Reaction icons take
 * `filled` for the reacted state.
 */

import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { COLORS } from './ui';

export interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  filled?: boolean;
}

function Frame({ size = 24, children }: { size?: number; children: React.ReactNode }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {children}
    </Svg>
  );
}

const stroke = (p: IconProps) => ({
  stroke: p.color ?? COLORS.ink,
  strokeWidth: p.strokeWidth ?? 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

const fillIf = (p: IconProps) => (p.filled ? p.color ?? COLORS.ink : 'none');

// --- Navigation -------------------------------------------------------------

/** nearby — a single wave that swells in the middle. Also the Wavelength mark. */
export function Waves(p: IconProps) {
  return (
    <Frame size={p.size}>
      <Path
        d="M2.4 12 C3.9 12 4.5 9.8 5.7 9.8 S7.3 14.3 8.7 14.3 S10.5 4.6 12 4.6 S13.4 19.3 15.1 19.3 S16.7 9.6 18.2 9.6 S19.7 12.1 21.6 12.1"
        {...stroke(p)}
      />
    </Frame>
  );
}

/** map — a point inside loose, unfinished rings. */
export function Ripple(p: IconProps) {
  return (
    <Frame size={p.size}>
      <Circle cx={12} cy={12} r={1.8} fill={p.color ?? COLORS.ink} />
      <Circle cx={12} cy={12} r={5} {...stroke(p)} />
      <Path d="M15.25 3.07 A9.5 9.5 0 1 1 3.77 16.75" {...stroke(p)} />
      <Path d="M2.64 13.65 A9.5 9.5 0 0 1 11.17 2.54" {...stroke(p)} />
    </Frame>
  );
}

/** people — two circles that overlap. */
export function Pair(p: IconProps) {
  return (
    <Frame size={p.size}>
      <Circle cx={9} cy={12} r={5.6} {...stroke(p)} />
      <Circle cx={15.2} cy={12.3} r={5.6} {...stroke(p)} />
    </Frame>
  );
}

/** you — one circle, a point slightly off center. */
export function Self(p: IconProps) {
  return (
    <Frame size={p.size}>
      <Circle cx={12} cy={12} r={8} {...stroke(p)} />
      <Circle cx={13.4} cy={10.6} r={1.7} fill={p.color ?? COLORS.ink} />
    </Frame>
  );
}

// --- Reactions --------------------------------------------------------------

/** reaction: fire */
export function Flame(p: IconProps) {
  return (
    <Frame size={p.size}>
      <Path
        d="M12 3 C14.2 6.6 18 9 17.6 14.1 C17.2 18.4 14.6 21 12 21 C8.9 21 6.4 18.6 6.4 15.1 C6.4 12.1 8.4 10.6 9.6 8.4 C10.1 10.9 10.9 12.2 12.1 12.3 C13.1 9.7 12.8 6.3 12 3 Z"
        fill={fillIf(p)}
        {...stroke(p)}
      />
    </Frame>
  );
}

/** reaction: heart */
export function Heart(p: IconProps) {
  return (
    <Frame size={p.size}>
      <Path
        d="M12 20 C7.1 16.6 3.5 13.6 3.5 9.6 C3.5 6.5 5.7 4.5 8.3 4.5 C10 4.5 11.3 5.5 12 7 C12.8 5.4 14.1 4.4 15.9 4.4 C18.4 4.4 20.5 6.4 20.5 9.4 C20.5 13.5 16.9 16.6 12 20 Z"
        fill={fillIf(p)}
        {...stroke(p)}
      />
    </Frame>
  );
}

/** reaction: headphones ("same") */
export function Phones(p: IconProps) {
  return (
    <Frame size={p.size}>
      <Path d="M4.6 14.2 V12.2 C4.6 7.9 7.9 4.6 12 4.6 C16.1 4.6 19.4 7.9 19.4 12.1 V14.2" {...stroke(p)} />
      <Path d="M4.4 13.6 H6.6 C7.3 13.6 7.8 14.1 7.8 14.8 V18.6 C7.8 19.3 7.3 19.8 6.6 19.8 H5.4 C4.8 19.8 4.3 19.3 4.3 18.7 Z" fill={fillIf(p)} {...stroke(p)} />
      <Path d="M19.6 13.6 H17.4 C16.7 13.6 16.2 14.1 16.2 14.8 V18.6 C16.2 19.3 16.7 19.8 17.4 19.8 H18.6 C19.2 19.8 19.7 19.3 19.7 18.7 Z" fill={fillIf(p)} {...stroke(p)} />
    </Frame>
  );
}

/** reaction: surprised ("new to me") — a four-point spark and a stray glint. */
export function Spark(p: IconProps) {
  return (
    <Frame size={p.size}>
      <Path
        d="M11 4 C11.6 9.3 14.3 12 19.6 12.6 C14.3 13.2 11.6 15.9 11 21.2 C10.4 15.9 7.7 13.2 2.4 12.6 C7.7 12 10.4 9.3 11 4 Z"
        fill={fillIf(p)}
        {...stroke(p)}
      />
      <Circle cx={19} cy={5} r={1.3} fill={p.color ?? COLORS.ink} />
    </Frame>
  );
}

/** reaction: clap ("yes") — two palms leaning in until the fingertips meet, three marks of impact. */
export function Hands(p: IconProps) {
  return (
    <Frame size={p.size}>
      <Rect x={6.3} y={8.4} width={4} height={12.2} rx={2} rotation={14} origin="8.3, 20.6" fill={fillIf(p)} {...stroke(p)} />
      <Rect x={13.7} y={8.4} width={4} height={12.2} rx={2} rotation={-14} origin="15.7, 20.6" fill={fillIf(p)} {...stroke(p)} />
      <Path d="M12 2.6 V4.9" {...stroke(p)} />
      <Path d="M7.9 3.9 L9 5.8" {...stroke(p)} />
      <Path d="M16.1 3.9 L15 5.8" {...stroke(p)} />
    </Frame>
  );
}

// --- Actions ----------------------------------------------------------------

/** message — a speech curve with a tail. */
export function Note(p: IconProps) {
  return (
    <Frame size={p.size}>
      <Path
        d="M7.2 4.6 H16.8 C18.4 4.6 19.6 5.8 19.6 7.4 V13.4 C19.6 15 18.4 16.2 16.8 16.2 H11.6 L7.4 19.6 C7.2 19.8 6.9 19.6 6.9 19.4 V16.2 C5.5 16 4.4 14.9 4.4 13.4 V7.4 C4.4 5.8 5.6 4.6 7.2 4.6 Z"
        fill={fillIf(p)}
        {...stroke(p)}
      />
    </Frame>
  );
}

/** open elsewhere (Spotify) — an arrow leaving an open circle. */
export function Link(p: IconProps) {
  return (
    <Frame size={p.size}>
      <Path d="M19.52 9.26 A8 8 0 1 1 14.74 4.48" {...stroke(p)} />
      <Path d="M11.6 12.4 L20.2 3.8" {...stroke(p)} />
      <Path d="M15.2 3.6 H20.4 V8.8" {...stroke(p)} />
    </Frame>
  );
}

/** back — an open chevron with a slight bow. */
export function Back(p: IconProps) {
  return (
    <Frame size={p.size}>
      <Path d="M14.8 5.2 C12.4 7.6 10.4 9.8 8.2 12 C10.4 14.2 12.4 16.4 14.8 18.8" {...stroke(p)} />
    </Frame>
  );
}

/** more — three points, the middle one a touch larger. */
export function More(p: IconProps) {
  const c = p.color ?? COLORS.ink;
  return (
    <Frame size={p.size}>
      <Circle cx={5.5} cy={12} r={1.4} fill={c} />
      <Circle cx={12} cy={12} r={1.7} fill={c} />
      <Circle cx={18.5} cy={12} r={1.4} fill={c} />
    </Frame>
  );
}

/** earlier — a clock face, hands at a lazy ten past. */
export function Clock(p: IconProps) {
  return (
    <Frame size={p.size}>
      <Circle cx={12} cy={12.2} r={8.2} {...stroke(p)} />
      <Path d="M12 7.4 V12.3 L15.4 14.1" {...stroke(p)} />
    </Frame>
  );
}

/** Reaction type → icon. Server types are unchanged. */
export const REACTION_ICONS = {
  fire: Flame,
  heart: Heart,
  headphones: Phones,
  surprised: Spark,
  clap: Hands,
} as const;
