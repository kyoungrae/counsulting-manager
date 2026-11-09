import { execFileSync } from 'node:child_process'
import { writeFile, realpath } from 'node:fs/promises'
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import vm from 'node:vm'
import { prepareConsultantImport } from '../server/consultants.js'

// This exact Git blob is the reviewed PR #5 consultant master. Never evaluate
// an arbitrary file or revision supplied by a caller.
const reviewedBlob = 'f34084945962ca4a52c43336daf8b7612894338c'
try {
  const output = process.argv[2]
  if (!output || !isAbsolute(output) || process.argv.length !== 3) throw new Error('absolute output path required')
  const repo = await realpath(execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim())
  const parent = await realpath(dirname(output))
  const target = resolve(parent, basename(output))
  const relativeTarget = relative(repo, target)
  if (!relativeTarget || (!relativeTarget.startsWith(`..${sep}`) && relativeTarget !== '..' && !isAbsolute(relativeTarget))) throw new Error('output must be outside repository')
  const source = execFileSync('git', ['cat-file', 'blob', reviewedBlob], { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 })
  const match = source.match(/export const CONSULTANT_MASTER = (\[[\s\S]*?\n\]);/)
  if (!match) throw new Error('reviewed master not found')
  const entries = vm.runInNewContext(`(${match[1]})`, Object.create(null), { timeout: 1000 })
  const consultants = prepareConsultantImport(entries)
  await writeFile(target, JSON.stringify({ consultants }, null, 2) + '\n', { flag: 'wx', mode: 0o600 })
  console.log(`상담사 ${consultants.length}명의 초기 이전 파일을 생성했습니다.`)
} catch {
  console.error('추출에 실패했습니다. 검토된 원본 Git 개체와 저장 경로를 확인하세요. 기존 파일은 덮어쓰지 않습니다.')
  process.exitCode = 1
}
