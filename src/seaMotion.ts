const sequence = [0, 1, 2, 3, 2, 1] as const
export const SEA_STEP_SECONDS = 1.6
export const SCENE_FPS = 30

// Landscape time is independent of the door/audio cycle. It is already in motion
// when the door first reveals it, and never rewinds on the next arrival.
export function ambienceTime(nowMs: number, originMs: number) {
  return 7.3 + Math.max(0, nowMs - originMs) / 1000
}
export function seaMotionAt(seconds: number, depth = 0) {
  const phase = Math.max(0, seconds - depth * .38) / SEA_STEP_SECONDS
  const step = Math.floor(phase), fraction = phase - step
  const envelope = Math.sin(Math.PI * depth)
  return {
    from: sequence[step % sequence.length],
    to: sequence[(step + 1) % sequence.length],
    blend: (1 - Math.cos(fraction * Math.PI)) / 2,
    // Two travelling swells move the texture toward shore and back. Both vanish
    // at the horizon and at the dry sand, keeping those anchors completely still.
    shift: Math.sin(seconds * 1.12 - depth * 5.2) * envelope * 1.7,
    flow: (Math.sin(seconds * 1.65 - depth * 7.5) * 2.3 + Math.sin(seconds * .61 - depth * 3) * .65) * envelope,
  }
}
