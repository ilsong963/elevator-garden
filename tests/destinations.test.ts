import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { DESTINATIONS, spriteAt } from '../src/destinations'
import { DestinationRotation } from '../src/DestinationRotation'

describe('destination changes happen behind closed doors', () => {
  it('keeps one view throughout opening, viewing, and closing', () => {
    const rotation = new DestinationRotation(() => .35)
    for (const time of [0, 1, 3.9, 4, 6, 8, 12, 15.99]) expect(rotation.update(time)).toBe('campfire')
    const next = rotation.update(16)
    expect(next).not.toBe('campfire')
    for (const time of [17, 20, 0, 3, 8, 15.99]) expect(rotation.update(time)).toBe(next)
    expect(rotation.update(16)).not.toBe(next)
  })
  it('does not skip scenes while parked or toggled before opening', () => {
    const rotation = new DestinationRotation(() => .4)
    for (let i = 0; i < 20; i++) for (const time of [0, 2, 0]) expect(rotation.update(time)).toBe('campfire')
  })
  it('selects a new visit after OFF finishes and resets the audio clock', () => {
    const rotation = new DestinationRotation(() => .5)
    rotation.update(10)
    const next = rotation.update(0)
    expect(next).not.toBe('campfire')
    expect(rotation.update(0)).toBe(next)
    expect(rotation.update(8)).toBe(next)
  })
  it('never swaps an open view after a background tab misses a cycle boundary', () => {
    const rotation = new DestinationRotation(() => .5)
    rotation.update(14)
    expect(rotation.update(6)).toBe('campfire')
    expect(rotation.update(16)).not.toBe('campfire')
  })
  it('visits all nine destinations and never immediately repeats across shuffles', () => {
    const rotation = new DestinationRotation(() => .42)
    const firstTour = [rotation.current, ...Array.from({ length: 8 }, () => rotation.next())]
    expect(new Set(firstTour).size).toBe(9)
    let previous = rotation.current
    for (let i = 0; i < 200; i++) { const next = rotation.next(); expect(next).not.toBe(previous); previous = next }
  })
})

describe('animation sprite assets', () => {
  it.each(DESTINATIONS)('$id has four equal square frames in an actual PNG sheet', destination => {
    const file = readFileSync(new URL(`../public/assets/${destination.file}`, import.meta.url))
    expect(file.subarray(1, 4).toString()).toBe('PNG')
    const width = file.readUInt32BE(16), height = file.readUInt32BE(20)
    expect(width).toBe(height)
    expect(width % 2).toBe(0)
    expect(width).toBeGreaterThanOrEqual(1024)
  })
  it.each(DESTINATIONS)('$id has continuous pose transitions and a moving phase before arrival', destination => {
    const before = spriteAt(destination.step - .00001, destination.step)
    const after = spriteAt(destination.step + .00001, destination.step)
    expect(before.to).toBe(after.from)
    expect(before.blend).toBeGreaterThan(.999)
    expect(after.blend).toBeLessThan(.001)
    const states = new Set(Array.from({ length: 30 }, (_, i) => JSON.stringify(spriteAt(7.3 + i / 30, destination.step))))
    expect(states.size).toBe(30)
  })
})
