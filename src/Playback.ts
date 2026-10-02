import { CYCLE } from './timeline'

export type PlaybackState = { automatic: boolean; mode: 'idle' | 'running' | 'finishing'; starting: boolean; error: string }
export const idleState: PlaybackState = { automatic: false, mode: 'idle', starting: false, error: '' }

// OFF prevents the next arrival. The current open/hold/close sequence keeps its audio clock.
export class Playback {
  private generation = 0
  private disposed = false
  private state: PlaybackState = { ...idleState }
  constructor(readonly audio: HTMLAudioElement, private notify: (state: PlaybackState) => void = () => {}) {
    audio.preload = 'auto'
    audio.volume = .55
    audio.addEventListener('timeupdate', this.update)
    audio.addEventListener('ended', this.ended)
    audio.addEventListener('error', this.failed)
  }
  private emit() { if (!this.disposed) this.notify({ ...this.state }) }
  private update = () => { this.tick() }
  private ended = () => {
    if (this.state.automatic) void this.beginCycle()
    else this.park()
  }
  private failed = () => { this.park('소리를 불러오지 못했어요. 자동 운행을 다시 켜주세요.') }
  async setAutomatic(enabled: boolean) {
    if (this.disposed) return
    this.state.automatic = enabled
    this.state.error = ''
    if (enabled) {
      if (this.state.mode !== 'idle') {
        this.state.mode = 'running'
        this.audio.loop = true
        this.emit()
        return
      }
      await this.beginCycle()
      return
    }
    // A closed cabin can park now. Once opening has begun, finish that visit
    // without seeking, pausing or shortening the viewing time.
    const time = this.audio.currentTime
    if (this.state.mode === 'idle' || time < CYCLE.openStart || time >= CYCLE.closeEnd) { this.park(); return }
    this.state.mode = 'finishing'
    this.audio.loop = false
    this.emit()
  }

  private async beginCycle() {
    if (this.disposed) return
    const request = ++this.generation
    if (this.audio.error) this.audio.load()
    this.audio.currentTime = 0
    this.audio.loop = true
    this.state.mode = 'running'
    this.state.starting = true
    this.emit()
    await this.play(request)
  }
  private async play(request: number) {
    try {
      await this.audio.play()
      if (request !== this.generation || this.disposed) {
        if (this.state.mode === 'idle' || this.disposed) this.audio.pause()
        return
      }
      this.state.starting = false
      this.emit()
    } catch {
      if (request === this.generation && !this.disposed) this.park('소리를 재생하지 못했어요. 자동 운행을 다시 켜주세요.')
    }
  }
  private park(error = '') {
    ++this.generation
    this.state = { ...idleState, error }
    this.audio.pause()
    this.audio.loop = false
    this.audio.currentTime = 0
    this.emit()
  }
  tick() {
    if (this.state.mode === 'finishing' && this.audio.currentTime >= CYCLE.closeEnd) this.park()
    return this.state.mode === 'idle' ? 0 : this.audio.currentTime
  }
  dispose() {
    this.disposed = true
    this.audio.removeEventListener('timeupdate', this.update)
    this.audio.removeEventListener('ended', this.ended)
    this.audio.removeEventListener('error', this.failed)
    this.park()
    this.audio.removeAttribute('src')
    this.audio.load()
  }
}
