import fs from 'node:fs'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { runAnalyze } from './index'

vi.mock('../../utils/config', () => ({
  loadProjectConfig: () => ({ srcDir: '.tmp-analyze', architecture: 'fsd' }),
}))

vi.mock('../check/index', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>()
  return {
    ...original,
    loadAliasEntries: () => [{ prefix: '@/', target: '' }],
  }
})

describe('analyzeCommand', () => {
  const rootDir = process.cwd()
  const tmpDir = path.join(rootDir, '.tmp-analyze')

  beforeEach(() => {
    fs.mkdirSync(tmpDir, { recursive: true })
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    vi.clearAllMocks()
  })

  function write(relPath: string, content: string) {
    const fullPath = path.join(tmpDir, relPath)
    fs.mkdirSync(path.dirname(fullPath), { recursive: true })
    fs.writeFileSync(fullPath, content.trim(), 'utf8')
  }

  it('runs successfully on an empty project', () => {
    const result = runAnalyze(tmpDir, rootDir)
    expect(result.stats.totalFiles).toBe(0)
    expect(result.violations).toBe(0)
    expect(result.cycles).toBe(0)
    expect(result.orphans).toBe(0)
    expect(result.warnings).toBe(2) // missing app/ and shared/ layers
  })

  it('detects violations, orphans, and cycles', () => {
    // Scaffold required layers
    fs.mkdirSync(path.join(tmpDir, 'shared'))
    fs.mkdirSync(path.join(tmpDir, 'app'))

    // cycle + orphans: A -> B, B -> A, neither is imported from app
    write('features/a/index.ts', `import { b } from '../b'; export const a = 'a'`)
    write('features/b/index.ts', `import { a } from '../a'; export const b = 'b'`)

    // violation: shared -> features
    write(
      'shared/ui/button/index.ts',
      `import { a } from '../../../features/a'; export const btn = 'btn'`,
    )

    const result = runAnalyze(tmpDir, rootDir)

    expect(result.stats.totalFiles).toBe(3)
    expect(result.stats.layerCount).toBe(2) // features + shared
    expect(result.stats.sliceCount).toBe(3) // a, b, ui/button

    expect(result.cycles).toBeGreaterThan(0) // A <-> B
    expect(result.violations).toBeGreaterThan(0) // shared importing features
    expect(result.orphans).toBeGreaterThan(0) // a and b are only importing each other
  })
})
