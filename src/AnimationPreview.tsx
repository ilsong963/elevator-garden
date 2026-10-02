import { StrictMode, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { DESTINATIONS } from './destinations'
import { drawLandscape } from './environment'
import { drawScene, loadArt, type Art } from './renderer'
import { ambienceTime, SCENE_FPS } from './seaMotion'
import './preview.css'

function AnimationPreview() {
  const images = useRef<Art | null>(null)
  const canvases = useRef<(HTMLCanvasElement | null)[]>([])
  const origin = useRef(performance.now())
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [inside, setInside] = useState(true)
  useEffect(() => {
    let disposed = false
    void loadArt().then(art => { if (!disposed) { images.current = art; setReady(true) } }).catch(() => { if (!disposed) setError('풍경을 불러오지 못했어요. 새로고침해 주세요.') })
    return () => { disposed = true }
  }, [])
  useEffect(() => {
    if (!ready) return
    let raf = 0, previous = -1
    const render = () => {
      const time = ambienceTime(performance.now(), origin.current), tick = Math.floor(time * SCENE_FPS)
      if (images.current && tick !== previous) {
        DESTINATIONS.forEach((destination, i) => {
          const canvas = canvases.current[i]
          if (!canvas) return
          if (inside) drawScene(canvas, images.current!, 10, undefined, time, destination.id)
          else {
            drawLandscape(canvas.getContext('2d')!, images.current!.landscapes[destination.id], time, 0, 0, 256, 256)
            canvas.dataset.destination = destination.id
            canvas.dataset.environmentTime = time.toFixed(3)
          }
        })
        previous = tick
      }
      raf = requestAnimationFrame(render)
    }
    render()
    return () => cancelAnimationFrame(raf)
  }, [ready, inside])
  return <main className="preview">
    <header><div><h1>문 너머, 아홉 가지 풍경</h1><p>문이 열리기 전부터 흐르는 작은 움직임</p></div><a href="./">자동운행으로 보기 ↗</a></header>
    <nav aria-label="미리보기 방식"><button aria-pressed={inside} onClick={() => setInside(true)}>엘리베이터 안에서</button><button aria-pressed={!inside} onClick={() => setInside(false)}>풍경만 보기</button></nav>
    {error && <p role="alert">{error}</p>}
    {!ready && !error && <p role="status">풍경을 준비하고 있습니다.</p>}
    <div className={`preview-grid ${inside ? 'inside' : 'landscape'}`}>
      {DESTINATIONS.map((destination, i) => <article key={destination.id}>
        <canvas ref={node => { canvases.current[i] = node }} width={256} height={inside ? 320 : 256} role="img" aria-label={`${destination.name} 애니메이션`} />
        <div className="caption"><h2>{destination.name}</h2><p>{destination.detail}</p></div>
      </article>)}
    </div>
  </main>
}
createRoot(document.getElementById('root')!).render(<StrictMode><AnimationPreview /></StrictMode>)
