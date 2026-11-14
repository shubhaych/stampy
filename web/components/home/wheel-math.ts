/** Pure geometry and easing for the Case Wheel (A1). Modeled on Vouch's claim-wheel math, sized for 15 cards. */

export const CARD_COUNT = 15;
export const ENTRANCE_DURATION = 1.2;
export const DRIFT_DEG_PER_SEC = 4;
export const SCROLL_DEG_PER_PX = 0.04;

export const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

export function normalizeDelta(deg: number): number {
  let d = ((deg % 360) + 360) % 360;
  if (d > 180) d -= 360;
  return d;
}

function cubic(t: number, a: number, b: number) {
  const u = 1 - t;
  return 3 * u * u * t * a + 3 * u * t * t * b + t * t * t;
}
function cubicDeriv(t: number, a: number, b: number) {
  const u = 1 - t;
  return 3 * u * u * a + 6 * u * t * (b - a) + 3 * t * t * (1 - b);
}
/** cubic-bezier(0.33, 0, 0.2, 1) */
export function easeEntrance(x: number): number {
  let t = clamp(x, 0, 1);
  for (let i = 0; i < 6; i++) {
    const dx = cubicDeriv(t, 0.33, 0.2);
    if (Math.abs(dx) < 1e-6) break;
    t = clamp(t - (cubic(t, 0.33, 0.2) - x) / dx, 0, 1);
  }
  return cubic(t, 0, 1);
}

export interface WheelLayout { radius: number; cardW: number; hideDeg: number; pivotY: number }

export function layoutForFrame(width: number, height: number): WheelLayout {
  const cardW = clamp(width * 0.12, 112, 158);
  const radius = clamp(Math.min(width * 0.5, height * 0.95), 300, 640);
  const half = width / 2 - cardW * 0.6;
  const hideDeg = Math.min(80, (Math.asin(clamp(half / radius, 0, 0.99)) * 180) / Math.PI);
  return { radius, cardW, hideDeg, pivotY: radius + height * 0.12 };
}

export interface CardPose { angle: number; opacity: number; scale: number; z: number; visible: boolean }

/** Pose of card i at rotation `rot` (deg) and entrance time `t` (s). */
export function poseFor(i: number, rot: number, t: number, layout: WheelLayout): CardPose {
  const home = (i * 360) / CARD_COUNT;
  const angle = normalizeDelta(home + rot);
  const order = (angle + 180) / 360;
  const deal = easeEntrance(clamp((t - order * 0.45) / (ENTRANCE_DURATION - 0.3), 0, 1));
  const from = Math.abs(angle);
  const visible = from < layout.hideDeg + 6;
  const edge = clamp((layout.hideDeg + 6 - from) / 14, 0, 1);
  return {
    angle: angle * deal + (1 - deal) * (angle > 0 ? 70 : -70),
    opacity: deal * edge,
    scale: 0.86 + 0.14 * (1 - from / 90),
    z: Math.round(100 - from),
    visible,
  };
}
