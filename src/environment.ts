import { DESTINATIONS, spriteAt, type Destination, type DestinationId } from './destinations'
import { seaMotionAt } from './seaMotion'

const SIZE = 256
type Point = readonly [number, number]
type Polygon = readonly Point[]
type Mask = { shapes: readonly Polygon[]; color?: 'flame' | 'light' | 'water' }
export type Landscape = { definition: Destination; frames: HTMLCanvasElement[]; layers: HTMLCanvasElement[] }
export type Landscapes = Record<DestinationId, Landscape>
const rectangle = (x: number, y: number, w: number, h: number): Polygon => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]

// Regions are in source-frame coordinates. Only these pixels can change;
// land, cabin, door, aquarium frame and foreground remain pinned to frame A.
const masks: Partial<Record<DestinationId, Mask>> = {
  campfire: { shapes: [rectangle(.39, .40, .23, .22)], color: 'flame' },
  cat: { shapes: [[[.39, .445], [.445, .402], [.62, .397], [.70, .44], [.71, .55], [.42, .545]]] },
  rain: { shapes: [[[.22, .455], [.94, .445], [1, .575], [.80, .64], [.53, .585], [.36, .56], [.20, .57]]] },
  creek: { shapes: [
    [[.22, .38], [.26, .365], [.39, .375], [.42, .465], [.355, .49], [.19, .49]],
    [[.60, .405], [.63, .40], [.665, .47], [.745, .48], [.75, .515], [.66, .515]],
    [[.42, .305], [.51, .30], [.52, .36], [.40, .36]],
    [[.14, .50], [.39, .49], [.43, .52], [.80, .505], [.87, .54], [1, .53], [1, .66], [.87, .65], [.80, .68], [.14, .69], [.03, .65], [.20, .62]],
  ], color: 'water' },
  aquarium: { shapes: [rectangle(.166, .15, .795, .438)] },
  fireflies: { shapes: [rectangle(0, .08, 1, .77)], color: 'light' },
  snow: { shapes: [rectangle(.67, .015, .125, .242)] },
  meadow: { shapes: [[[0, .40], [.14, .37], [.36, .46], [.59, .49], [.75, .465], [1, .435], [1, .62], [.89, .675], [.10, .65], [0, .60]]] },
}

function colorMatches(kind: Mask['color'], r: number, g: number, b: number) {
  if (kind === 'flame') return r > 170 && g > 65 && r > b * 1.65 && g > b * 1.15
  if (kind === 'light') return r > 190 && g > 135 && b < g * .78
  if (kind === 'water') return (g > r * 1.07 && b > r * 1.06) || (r > 176 && g > 200 && b > 193)
  return true
}

function canvas() {
  const result = document.createElement('canvas')
  result.width = result.height = SIZE
  return result
}
export function prepareLandscape(image: HTMLImageElement, definition: Destination): Landscape {
  const frames = Array.from({ length: 4 }, (_, frame) => {
    const result = canvas(), ctx = result.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    const w = image.naturalWidth / 2, h = image.naturalHeight / 2
    ctx.drawImage(image, frame % 2 * w, Math.floor(frame / 2) * h, w, h, 0, 0, SIZE, SIZE)
    return result
  })
  const specification = masks[definition.id]
  if (!specification) return { definition, frames, layers: [] }
  const mask = canvas(), ctx = mask.getContext('2d')!
  ctx.fillStyle = '#fff'
  for (const shape of specification.shapes) {
    ctx.beginPath()
    shape.forEach(([x, y], i) => i ? ctx.lineTo(x * SIZE, y * SIZE) : ctx.moveTo(x * SIZE, y * SIZE))
    ctx.closePath(); ctx.fill()
  }
  if (specification.color) {
    const pixels = ctx.getImageData(0, 0, SIZE, SIZE)
    const sources = frames.map(frame => frame.getContext('2d')!.getImageData(0, 0, SIZE, SIZE).data)
    // Union across all poses also clears the old flame/firefly silhouette.
    for (let i = 0; i < pixels.data.length; i += 4) {
      if (!sources.some(source => colorMatches(specification.color, source[i], source[i + 1], source[i + 2]))) pixels.data[i + 3] = 0
    }
    ctx.putImageData(pixels, 0, 0)
  }
  const layers = frames.map(frame => {
    const layer = canvas(), c = layer.getContext('2d')!
    c.drawImage(frame, 0, 0)
    c.globalCompositeOperation = 'destination-in'; c.drawImage(mask, 0, 0)
    return layer
  })
  return { definition, frames, layers }
}

export async function loadLandscapes(asset: (name: string) => string): Promise<Landscapes> {
  // At most two full-resolution sheets decode at once. Keep only small cached
  // frames after preparation, instead of retaining eight large decoded sheets.
  const result = {} as Landscapes
  let next = 0
  await Promise.all(Array.from({ length: 2 }, async () => {
    while (next < DESTINATIONS.length) {
      const definition = DESTINATIONS[next++]
      const image = new Image()
      image.src = asset(definition.file)
      await image.decode()
      result[definition.id] = prepareLandscape(image, definition)
    }
  }))
  return result
}

const fraction = (value: number) => value - Math.floor(value)
const seed = (i: number) => fraction(Math.sin(i * 127.1 + 311.7) * 43758.5453)
function dot(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, alpha = 1, width = 1, height = 1) {
  ctx.globalAlpha = alpha; ctx.fillStyle = color
  ctx.fillRect(Math.round(x), Math.round(y), width, height)
}
function sparkles(ctx: CanvasRenderingContext2D, t: number, left: number, top: number, width: number, height: number, count: number) {
  for (let i = 0; i < count; i++) {
    const glow = Math.max(0, Math.sin(t * (1.7 + seed(i) * 1.5) + i * 2.4))
    dot(ctx, left + seed(i + 21) * width, top + seed(i + 65) * height, '#e3fff3', glow * .4, 1 + i % 3)
  }
}

function particles(ctx: CanvasRenderingContext2D, id: DestinationId, t: number) {
  if (id === 'campfire') {
    for (let i = 0; i < 11; i++) {
      const life = fraction(t * (.17 + seed(i) * .13) + seed(i + 70))
      const x = 128 + Math.sin(t * .9 + i * 4) * (3 + life * 9)
      dot(ctx, x, 143 - life * 45, i % 3 ? '#ffd77b' : '#ff9860', Math.sin(life * Math.PI) * .8)
    }
  } else if (id === 'rain') {
    for (let i = 0; i < 90; i++) {
      const progress = fraction(seed(i) + t * (.5 + seed(i + 2) * .55))
      const x = seed(i + 91) * 270 - progress * 8
      dot(ctx, x, progress * 234 - 8, '#d5e4ea', .18 + seed(i + 8) * .22, 1, 2 + i % 3)
    }
    for (let i = 0; i < 12; i++) {
      const p = fraction(t * .6 + seed(i + 100))
      ctx.globalAlpha = (1 - p) * .4; ctx.strokeStyle = '#e1eced'; ctx.lineWidth = .65
      ctx.beginPath(); ctx.ellipse(65 + seed(i + 40) * 166, 123 + seed(i + 150) * 22, 1 + p * 4, .5 + p * 1.5, 0, 0, Math.PI * 2); ctx.stroke()
    }
  } else if (id === 'fireflies') {
    for (let i = 0; i < 27; i++) {
      const x = 26 + seed(i + 1) * 202 + Math.sin(t * (.23 + seed(i) * .17) + i) * 8
      const y = 57 + seed(i + 25) * 143 + Math.cos(t * .31 + i * 1.7) * 5
      const a = Math.pow(Math.max(0, Math.sin(t * (.6 + seed(i + 4) * .6) + i * 2)), 1.5)
      dot(ctx, x - 1, y - 1, '#efd573', a * .15, 3, 3)
      dot(ctx, x, y, '#fff4b0', a * .95)
    }
  } else if (id === 'snow') {
    for (let i = 0; i < 66; i++) {
      const depth = seed(i + 10), speed = .023 + depth * .049
      const y = fraction(seed(i) + t * speed) * 247
      const x = fraction(seed(i + 84) + t * .007) * 270 - 7 + Math.sin(t * .55 + i) * (2 + depth * 4)
      dot(ctx, x, y, '#f5f2ff', .38 + depth * .5, depth > .83 ? 2 : 1, depth > .83 ? 2 : 1)
    }
  } else if (id === 'aquarium') {
    ctx.save(); ctx.beginPath(); ctx.rect(43, 39, 201, 110); ctx.clip()
    for (let i = 0; i < 18; i++) {
      const p = fraction(t * (.045 + seed(i) * .04) + seed(i + 3))
      const x = 57 + seed(i + 68) * 168 + Math.sin(t + i) * 1.6
      ctx.globalAlpha = Math.sin(p * Math.PI) * .5; ctx.strokeStyle = '#bceefa'; ctx.lineWidth = .7
      ctx.strokeRect(Math.round(x), Math.round(145 - p * 102), i % 4 ? 1 : 2, i % 4 ? 1 : 2)
    }
    sparkles(ctx, t, 65, 44, 160, 12, 12)
    ctx.restore()
  } else if (id === 'creek') {
    sparkles(ctx, t, 48, 139, 162, 30, 42)
  } else if (id === 'cat') {
    // Tiny sunlit specks, kept away from the entrance and never mistaken for snow.
    for (let i = 0; i < 6; i++) {
      const alpha = Math.max(0, Math.sin(t * .6 + i * 2)) * .35
      dot(ctx, 72 + seed(i) * 112 + Math.sin(t * .2 + i) * 3, 65 + seed(i + 4) * 57 - Math.sin(t * .3 + i) * 2, '#fff8ce', alpha)
    }
  } else if (id === 'meadow') {
    for (let i = 0; i < 2; i++) {
      const x = 99 + Math.sin(t * .18 + i * 3) * 54, y = 123 + Math.cos(t * .23 + i * 2) * 13
      const wing = Math.floor(t * 7 + i) % 3 === 0 ? 1 : 3
      dot(ctx, x - wing, y - 1, i ? '#ffe8a9' : '#ffc5d8', .9, wing, 2)
      dot(ctx, x + 1, y - 1, i ? '#fff0c8' : '#ffe1e9', .9, wing, 2)
      dot(ctx, x, y, '#72585c', .85, 1, 2)
    }
  }
  ctx.globalAlpha = 1
}

function sunset(ctx: CanvasRenderingContext2D, landscape: Landscape, t: number) {
  const top = 112, height = SIZE - top
  for (let row = top; row < SIZE; row += 2) {
    const motion = seaMotionAt(t, (row - top) / height)
    const sy = Math.max(top, Math.min(SIZE - 2, row + motion.flow))
    ctx.globalAlpha = 1
    ctx.drawImage(landscape.frames[motion.from], 0, sy, SIZE, 2, motion.shift, row, SIZE, 2)
    ctx.globalAlpha = motion.blend
    ctx.drawImage(landscape.frames[motion.to], 0, sy, SIZE, 2, motion.shift, row, SIZE, 2)
  }
  for (let i = 0; i < 40; i++) {
    const depth = (i + 1) / 41
    const spread = Math.sin(i * 12.9898) * (3 + depth * 35)
    const glow = Math.max(0, Math.sin(t * (1.8 + i % 5 * .23) + i * 2.4))
    dot(ctx, 128 + spread, top + depth * height * .78, '#fff5c5', glow * .32, 1 + i % 4)
  }
}

// Draw through a rectangular viewport without changing the square artwork's
// aspect ratio. Only its side margins are cropped by the elevator aperture.
export function drawLandscape(ctx: CanvasRenderingContext2D, landscape: Landscape, t: number, x: number, y: number, width: number, height: number) {
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, width, height); ctx.clip()
  ctx.translate(x + (width - height) / 2, y); ctx.scale(height / SIZE, height / SIZE)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(landscape.frames[0], 0, 0)
  if (landscape.definition.id === 'sunset') sunset(ctx, landscape, t)
  else {
    const pose = spriteAt(t, landscape.definition.step)
    ctx.drawImage(landscape.layers[pose.from], 0, 0)
    ctx.globalAlpha = pose.blend; ctx.drawImage(landscape.layers[pose.to], 0, 0); ctx.globalAlpha = 1
    particles(ctx, landscape.definition.id, t)
  }
  ctx.restore()
}
