export const DESTINATIONS = [
  { id: 'sunset', name: '노을 바다', file: 'sunset-sea-sprites.png', step: 1.6, detail: '잔잔한 파도와 수면의 빛' },
  { id: 'campfire', name: '숲속 모닥불', file: 'campfire-sprites.png', step: .19, detail: '불꽃과 떠오르는 불씨' },
  { id: 'rain', name: '비 오는 정원', file: 'rain-sprites.png', step: .85, detail: '빗줄기와 물웅덩이의 잔물결' },
  { id: 'cat', name: '햇볕 아래 고양이', file: 'cat-sprites.png', step: 1.15, detail: '작은 숨결과 귀·꼬리의 움직임' },
  { id: 'aquarium', name: '수족관 전시실', file: 'aquarium-sprites.png', step: 1.3, detail: '헤엄치는 물고기와 해파리, 기포' },
  { id: 'fireflies', name: '반딧불이 숲', file: 'fireflies-sprites.png', step: 1.2, detail: '서로 다른 속도로 떠다니는 반딧불이' },
  { id: 'snow', name: '눈 내리는 산장', file: 'snow-sprites.png', step: 1.1, detail: '흩날리는 눈과 굴뚝 연기' },
  { id: 'creek', name: '작은 계곡', file: 'creek-sprites.png', step: .32, detail: '흐르는 폭포와 반짝이는 물결' },
  { id: 'meadow', name: '바람 부는 꽃밭', file: 'meadow-sprites.png', step: 1.05, detail: '바람에 흔들리는 꽃과 날아가는 나비' },
] as const
export type DestinationId = typeof DESTINATIONS[number]['id']
export type Destination = typeof DESTINATIONS[number]
const sequence = [0, 1, 2, 3, 2, 1] as const
export function spriteAt(seconds: number, stepSeconds: number) {
  const phase = Math.max(0, seconds) / stepSeconds
  const step = Math.floor(phase), fraction = phase - step
  return { from: sequence[step % 6], to: sequence[(step + 1) % 6], blend: (1 - Math.cos(fraction * Math.PI)) / 2 }
}
