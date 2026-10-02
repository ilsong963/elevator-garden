import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
if (!existsSync(join(dist, 'index.html'))) throw new Error('먼저 npm run build를 실행해 주세요.')
const git = (args, cwd = root) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim()
const origin = git(['remote', 'get-url', 'origin'])
const directory = mkdtempSync(join(tmpdir(), 'elevator-pages-'))
try {
  git(['init', '-b', 'gh-pages'], directory)
  git(['remote', 'add', 'origin', origin], directory)
  if (git(['ls-remote', '--heads', 'origin', 'gh-pages'], directory)) {
    git(['fetch', '--depth=1', 'origin', 'gh-pages'], directory)
    git(['checkout', '-B', 'gh-pages', 'FETCH_HEAD'], directory)
  }
  for (const file of readdirSync(directory)) if (file !== '.git') rmSync(join(directory, file), { recursive: true, force: true })
  cpSync(dist, directory, { recursive: true })
  writeFileSync(join(directory, '.nojekyll'), '')
  git(['add', '.'], directory)
  if (!git(['diff', '--cached', '--name-only'], directory)) console.log('배포할 변경 사항이 없습니다.')
  else {
    git(['commit', '-m', `Deploy ${git(['rev-parse', '--short', 'HEAD'])}`], directory)
    git(['push', 'origin', 'gh-pages'], directory)
    console.log('GitHub Pages 배포 브랜치를 업데이트했습니다.')
  }
} finally {
  rmSync(directory, { recursive: true, force: true })
}
