export const CYCLE = { bell: 1, openStart: 4, openEnd: 8, closeStart: 12, closeEnd: 16, duration: 21.168 } as const
export type Phase = 'arriving' | 'opening' | 'viewing' | 'closing' | 'travelling'
// Slow at either end, with a stronger acceleration through the middle.
const doorEase = (t: number) => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
export function sceneAt(time: number, duration: number = CYCLE.duration) {
  const t = ((time % duration) + duration) % duration
  let openness = 0, phase: Phase = 'arriving'
  if (t >= CYCLE.closeEnd) phase = 'travelling'
  else if (t >= CYCLE.closeStart) { phase = 'closing'; openness = 1 - doorEase((t - CYCLE.closeStart) / (CYCLE.closeEnd - CYCLE.closeStart)) }
  else if (t >= CYCLE.openEnd) { phase = 'viewing'; openness = 1 }
  else if (t >= CYCLE.openStart) { phase = 'opening'; openness = doorEase((t - CYCLE.openStart) / (CYCLE.openEnd - CYCLE.openStart)) }
  return { phase, openness, bell: t >= 1 && t < 2.2 }
}
