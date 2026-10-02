import { spriteAt, type DestinationId } from './destinations'
import { drawLandscape, loadLandscapes, type Landscapes } from './environment'
import { sceneAt } from './timeline'
export const STAGE = { width: 256, height: 320 }
const aperture = { x: 39, y: 42, width: 178, height: 231 }
export type Art = { cabin: HTMLImageElement; doors: HTMLImageElement; landscapes: Landscapes }
const asset = (name: string) => `${import.meta.env.BASE_URL}assets/${name}`
let artPromise: Promise<Art> | undefined
export function loadArt(): Promise<Art> {
  // React StrictMode and a preview remount reuse one decode/preparation job.
  return artPromise ??= prepareArt().catch(error => { artPromise = undefined; throw error })
}
async function prepareArt(): Promise<Art> {
  const load = async (name: string) => {
    const image = new Image()
    image.src = asset(name)
    await image.decode()
    return image
  }
  const [cabin, doors, landscapes] = await Promise.all([load('cabin-wide.png'), load('door-panels.png'), loadLandscapes(asset)])
  return { cabin, doors, landscapes }
}
export const soundUrl = asset('elevator-cycle.mp3')
export function drawScene(canvas: HTMLCanvasElement, art: Art, seconds: number, duration?: number, environmentSeconds = seconds + 7.3, destination: DestinationId = 'campfire') {
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  const scene = sceneAt(seconds, duration)
  const { x, y, width, height } = aperture
  ctx.fillStyle = '#f8ecd7'; ctx.fillRect(0, 0, STAGE.width, STAGE.height)
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, width, height); ctx.clip()
  const landscape = art.landscapes[destination]
  drawLandscape(ctx, landscape, environmentSeconds, x, y, width, height)
  const half = width / 2, travel = Math.round(half * scene.openness)
  const sw = art.doors.width / 2, sh = art.doors.height
  ctx.drawImage(art.doors, 0, 0, sw, sh, x - travel, y, half, height)
  ctx.drawImage(art.doors, sw, 0, sw, sh, x + half + travel, y, half, height)
  ctx.restore()
  ctx.drawImage(art.cabin, 0, 0, STAGE.width, STAGE.height)
  if (scene.bell) { ctx.fillStyle = '#fffbc5'; ctx.fillRect(227, 98, 4, 6) }
  const pose = spriteAt(environmentSeconds, landscape.definition.step)
  canvas.dataset.phase = scene.phase
  canvas.dataset.destination = destination
  canvas.dataset.environmentTime = environmentSeconds.toFixed(3)
  canvas.dataset.spriteFrame = String(pose.from)
  canvas.dataset.spriteBlend = pose.blend.toFixed(3)
  canvas.dataset.doorPixels = String(travel)
  canvas.dataset.audioTime = seconds.toFixed(2)
}
