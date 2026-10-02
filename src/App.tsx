import { useEffect, useRef, useState } from 'react'
import { ambienceTime, SCENE_FPS } from './seaMotion'
import { Playback, idleState } from './Playback'
import { DestinationRotation } from './DestinationRotation'
import { drawScene, loadArt, soundUrl, STAGE, type Art } from './renderer'
import './style.css'

export default function App() {
  const ambienceOrigin = useRef(performance.now())
  const canvas = useRef<HTMLCanvasElement>(null)
  const art = useRef<Art | null>(null)
  const playback = useRef<Playback | null>(null)
  const destinations = useRef(new DestinationRotation())
  const [ready, setReady] = useState(false)
  const [state, setState] = useState(idleState)
  const [artError, setArtError] = useState('')
  useEffect(() => {
    let disposed = false
    const player = new Playback(new Audio(soundUrl), setState)
    playback.current = player
    void loadArt().then(images => {
      if (disposed) return
      art.current = images
      drawScene(canvas.current!, images, 0, undefined, ambienceTime(performance.now(), ambienceOrigin.current))
      setReady(true)
    }).catch(() => { if (!disposed) setArtError('풍경을 불러오지 못했어요. 새로고침해 주세요.') })
    return () => { disposed = true; player.dispose(); playback.current = null }
  }, [])
  useEffect(() => {
    if (!ready) return
    let frame = 0, lastTick = -1
    const render = () => {
      const player = playback.current, images = art.current
      if (player && images && canvas.current) {
        const t = player.tick(), seaTime = ambienceTime(performance.now(), ambienceOrigin.current)
        const tick = Math.floor(seaTime * SCENE_FPS)
        if (tick !== lastTick) {
          const duration = Number.isFinite(player.audio.duration) ? player.audio.duration : undefined
          const destination = destinations.current.update(t)
          drawScene(canvas.current, images, t, duration, seaTime, destination)
          canvas.current.setAttribute('aria-label', `밝은 도트 엘리베이터 안에서 ${images.landscapes[destination].definition.name}을 바라보는 장면`)
          canvas.current.dataset.operation = state.mode
          lastTick = tick
        }
      }
      if (state.mode !== 'idle') frame = requestAnimationFrame(render)
    }
    render()
    return () => cancelAnimationFrame(frame)
  }, [ready, state.mode])
  const error = artError || state.error
  return <main className="app">
    <section className="elevator" aria-label="아홉 가지 풍경으로 가는 엘리베이터">
      <div className={`scene ${ready ? 'ready' : ''}`}>
        <canvas ref={canvas} width={STAGE.width} height={STAGE.height} role="img" aria-label="밝은 도트 엘리베이터 안에서 풍경을 바라보는 장면" />
      </div>
      <footer className="controls">
        <button className="run-switch" type="button" role="switch" aria-label="자동 운행" aria-checked={state.automatic} disabled={!ready} onClick={() => void playback.current?.setAutomatic(!state.automatic)}>
          <span className="run-label">자동 운행</span><span className="switch-track" aria-hidden="true"><span className="switch-thumb"/></span><span className="switch-state" aria-hidden="true">{state.automatic ? 'ON' : 'OFF'}</span>
        </button>
      </footer>
      {error && <p className="error" role="alert">{error}</p>}
      <span className="sr-only" role="status">{!ready ? '풍경을 준비하고 있습니다.' : state.mode === 'finishing' ? '이번 문 여닫기를 마친 뒤 대기합니다.' : state.automatic ? '자동 운행 중' : '문을 닫고 대기 중'}</span>
    </section>
  </main>
}
