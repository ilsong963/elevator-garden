import { DESTINATIONS, type DestinationId } from './destinations'
import { CYCLE } from './timeline'

// Visit every destination before reshuffling. The first new scene is the
// approved campfire; the familiar sunset remains part of every complete tour.
export class DestinationRotation {
  current: DestinationId = 'campfire'
  private remaining: DestinationId[] = []
  private hasOpened = false
  constructor(private random: () => number = Math.random) {}
  next() {
    if (!this.remaining.length) {
      this.remaining = DESTINATIONS.map(item => item.id).filter(id => id !== this.current)
      for (let i = this.remaining.length - 1; i > 0; i--) {
        const j = Math.floor(this.random() * (i + 1))
        ;[this.remaining[i], this.remaining[j]] = [this.remaining[j], this.remaining[i]]
      }
    }
    this.current = this.remaining.pop()!
    return this.current
  }
  update(time: number) {
    const closed = time < CYCLE.openStart || time >= CYCLE.closeEnd
    // Prefer switching at 16s, safely behind closed doors. A resumed tab can
    // miss that boundary; defer until closed instead of swapping an open view.
    if (closed && this.hasOpened) { this.next(); this.hasOpened = false }
    if (time >= CYCLE.openStart && time < CYCLE.closeEnd) this.hasOpened = true
    return this.current
  }
}
