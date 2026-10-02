import { describe, expect, it } from 'vitest'
import { CYCLE, sceneAt } from '../src/timeline'
import { Playback, idleState, type PlaybackState } from '../src/Playback'
import { ambienceTime, seaMotionAt, SEA_STEP_SECONDS, SCENE_FPS } from '../src/seaMotion'

describe('recording-synchronized sprites', () => {
  it('matches arrival, opening, full view, closing and travel', () => {
    expect(sceneAt(1)).toMatchObject({ bell: true, openness: 0 })
    expect(sceneAt(4)).toMatchObject({ phase: 'opening', openness: 0 })
    expect(sceneAt(6).openness).toBe(.5)
    // Most travel happens in the middle two seconds; both ends settle gently.
    expect(sceneAt(5).openness).toBeLessThan(.1)
    expect(sceneAt(7).openness).toBeGreaterThan(.9)
    expect(sceneAt(8)).toMatchObject({ phase: 'viewing', openness: 1 })
    expect(sceneAt(11.99).openness).toBe(1)
    expect(sceneAt(12)).toMatchObject({ phase: 'closing', openness: 1 })
    expect(sceneAt(14).openness).toBe(.5)
    expect(sceneAt(13).openness).toBeGreaterThan(.9)
    expect(sceneAt(15).openness).toBeLessThan(.1)
    expect(sceneAt(16)).toMatchObject({ phase: 'travelling', openness: 0 })
  })
  it('does not accumulate timing error over repeated cycles', () => {
    for (let cycle = 0; cycle < 1000; cycle++) expect(sceneAt(cycle * CYCLE.duration + 6).openness).toBeCloseTo(.5, 8)
    expect(sceneAt(CYCLE.duration).phase).toBe('arriving')
  })
  it('blends continuously through each wave frame boundary', () => {
    for (let i = 1; i < 7; i++) {
      const before = seaMotionAt(i * SEA_STEP_SECONDS - .001), after = seaMotionAt(i * SEA_STEP_SECONDS + .001)
      expect(before.to).toBe(after.from)
      expect(before.blend).toBeGreaterThan(.999)
      expect(after.blend).toBeLessThan(.001)
    }
    expect(seaMotionAt(SEA_STEP_SECONDS / 2).blend).toBeCloseTo(.5)
    expect(SEA_STEP_SECONDS * 6).toBeGreaterThan(8)
    expect(SEA_STEP_SECONDS * 6).toBeLessThan(12)
  })
  it('has moving water before and throughout door opening, without rewinding on an audio loop', () => {
    const origin = 1000
    const times = [0, 3.9, 4.1, 6, 8, 21.1, 21.2].map(t => ambienceTime(origin + t * 1000, origin))
    expect(times[0]).toBeGreaterThan(0)
    expect(times.every((t, i) => i === 0 || t > times[i - 1])).toBe(true)
    expect(seaMotionAt(times[1], .6).flow).not.toBe(seaMotionAt(times[2], .6).flow)
    expect(times[6] - times[5]).toBeCloseTo(.1)
  })
  it('creates distinct intermediate movement at 30fps while holding the horizon and sand still', () => {
    const frames = new Set(Array.from({ length: SCENE_FPS }, (_, i) => JSON.stringify(seaMotionAt(7.3 + i / SCENE_FPS, .6))))
    expect(frames.size).toBe(30)
    for (let t = 0; t < 12; t += .2) {
      expect(seaMotionAt(t, 0).flow).toBeCloseTo(0)
      expect(seaMotionAt(t, 1).flow).toBeCloseTo(0)
      expect(Math.abs(seaMotionAt(t, .6).flow)).toBeLessThan(3)
    }
  })

})
class FakeAudio extends EventTarget {
  currentTime = 0; duration = CYCLE.duration; loop = false; preload = ''; volume = 1; paused = true; error = null
  play = async () => { this.paused = false }
  pause() { this.paused = true }
  load() {} removeAttribute() {}
}
const makePlayer = () => {
  const audio = new FakeAudio()
  let state: PlaybackState = { ...idleState }
  const player = new Playback(audio as unknown as HTMLAudioElement, next => { state = next })
  return { audio, player, state: () => state }
}
describe('OFF finishes the visit and prevents the next opening', () => {
  it.each([4, 6, 8, 10, 11.9, 12, 14, 15.5])('does not seek, pause or shorten the visit when switched OFF at %s seconds', async time => {
    const { audio, player, state } = makePlayer()
    await player.setAutomatic(true); audio.currentTime = time
    await player.setAutomatic(false)
    expect(audio.currentTime).toBe(time)
    expect(audio.paused).toBe(false)
    expect(state()).toMatchObject({ automatic: false, mode: 'finishing' })
    expect(audio.loop).toBe(false)
    audio.currentTime = 15.9; player.tick()
    expect(state().mode).toBe('finishing'); expect(audio.paused).toBe(false)
    audio.currentTime = 16; player.tick()
    expect(state()).toMatchObject({ automatic: false, mode: 'idle' })
    expect(audio.paused).toBe(true); expect(player.tick()).toBe(0)
    audio.dispatchEvent(new Event('timeupdate'))
    expect(state().mode).toBe('idle')
  })
  it.each([0, 2, 3.99, 16, 19])('does not open the closed doors when OFF is pressed at %s seconds', async time => {
    const { audio, player, state } = makePlayer()
    await player.setAutomatic(true); audio.currentTime = time
    await player.setAutomatic(false)
    expect(state().mode).toBe('idle'); expect(audio.currentTime).toBe(0); expect(audio.paused).toBe(true)
  })
  it('starts from zero when ON is pressed after the completed visit', async () => {
    const { audio, player, state } = makePlayer()
    await player.setAutomatic(true); audio.currentTime = 10
    await player.setAutomatic(false); audio.currentTime = 16; player.tick()
    await player.setAutomatic(true)
    expect(audio.currentTime).toBe(0); expect(audio.loop).toBe(true); expect(audio.paused).toBe(false)
    expect(state()).toMatchObject({ automatic: true, mode: 'running' })
  })
  it('re-enables the next cycle without jumping when ON is pressed before the visit finishes', async () => {
    const { audio, player, state } = makePlayer()
    await player.setAutomatic(true); audio.currentTime = 10
    await player.setAutomatic(false); audio.currentTime = 11
    await player.setAutomatic(true)
    expect(audio.currentTime).toBe(11); expect(state()).toMatchObject({ automatic: true, mode: 'running' })
    audio.currentTime = 16; player.tick()
    expect(audio.paused).toBe(false); expect(audio.loop).toBe(true)
  })
  it('cancels pending playback if OFF is pressed before the first opening', async () => {
    const { audio, player, state } = makePlayer()
    let finish!: () => void
    audio.play = () => new Promise(resolve => { finish = () => { audio.paused = false; resolve() } })
    const pending = player.setAutomatic(true); await player.setAutomatic(false); finish(); await pending
    expect(audio.paused).toBe(true); expect(state().mode).toBe('idle')
  })
  it('does not let an obsolete start cancel a newer ON request', async () => {
    const { audio, player, state } = makePlayer()
    const finishes: (() => void)[] = []
    audio.play = () => new Promise(resolve => { finishes.push(() => { audio.paused = false; resolve() }) })
    const first = player.setAutomatic(true); await player.setAutomatic(false); const second = player.setAutomatic(true)
    finishes[1](); await second; finishes[0](); await first
    expect(audio.paused).toBe(false); expect(state().automatic).toBe(true)
  })
  it('parks on load failure and allows retry', async () => {
    const { audio, player, state } = makePlayer()
    audio.play = async () => { throw new Error('media failed') }
    await player.setAutomatic(true)
    expect(state()).toMatchObject({ automatic: false, mode: 'idle' }); expect(state().error).toBeTruthy()
  })
  it('parks using media events even when animation frames are throttled', async () => {
    const { audio, player, state } = makePlayer()
    await player.setAutomatic(true); audio.currentTime = 10; await player.setAutomatic(false)
    audio.currentTime = 16.1; audio.dispatchEvent(new Event('timeupdate'))
    expect(state().mode).toBe('idle'); expect(audio.paused).toBe(true)
  })
})
