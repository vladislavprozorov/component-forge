import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { runWatchCheck } from './watcher'

import type { CheckViolation } from './index'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeViolation(file: string, importPath: string): CheckViolation {
  return {
    file,
    importPath,
    message: 'test violation',
    hint: 'test hint',
  }
}

// ---------------------------------------------------------------------------
// runWatchCheck — pure diff logic
// ---------------------------------------------------------------------------

describe('runWatchCheck — diff logic', () => {
  let tmpDir: string

  beforeEach(() => {
    // Create a minimal FSD src structure so runCheck finds 0 violations
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-watcher-'))
    const shared = path.join(tmpDir, 'shared', 'utils')
    fs.mkdirSync(shared, { recursive: true })
    // Clean file — no bad imports
    fs.writeFileSync(
      path.join(shared, 'index.ts'),
      `export const noop = () => {}\n`,
    )
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('returns empty violations and empty diff for a clean directory', () => {
    const result = runWatchCheck(tmpDir, 'fsd', [])
    expect(result.violations).toHaveLength(0)
    expect(result.added).toHaveLength(0)
    expect(result.resolved).toHaveLength(0)
    expect(result.checkedFiles).toBeGreaterThanOrEqual(1)
  })

  it('detects added violations on first run (empty previous)', () => {
    // Add a file with an FSD violation: shared importing from features
    // From shared/badImport.ts, one ".." goes up to srcDir, then into features/
    const sharedDir = path.join(tmpDir, 'shared')
    fs.mkdirSync(sharedDir, { recursive: true })
    fs.writeFileSync(
      path.join(sharedDir, 'badImport.ts'),
      `import { something } from '../features/auth'\n`,
    )

    const result = runWatchCheck(tmpDir, 'fsd', [])
    expect(result.violations.length).toBeGreaterThanOrEqual(1)
    expect(result.added.length).toBe(result.violations.length)
    expect(result.resolved).toHaveLength(0)
  })

  it('resolved = previous - next when a violation disappears', () => {
    const prevViolation = makeViolation('shared/badImport.ts', '../../features/auth')

    // Directory has no violations
    const result = runWatchCheck(tmpDir, 'fsd', [prevViolation])
    expect(result.resolved).toHaveLength(1)
    expect(result.resolved[0].file).toBe('shared/badImport.ts')
    expect(result.added).toHaveLength(0)
  })

  it('added = next - previous when a new violation appears', () => {
    const existingViolation = makeViolation('shared/old.ts', '../features/x')

    const sharedDir = path.join(tmpDir, 'shared')
    fs.mkdirSync(sharedDir, { recursive: true })
    fs.writeFileSync(
      path.join(sharedDir, 'newBad.ts'),
      `import { a } from '../features/auth'\n`,
    )

    const result = runWatchCheck(tmpDir, 'fsd', [existingViolation])

    // The new file's violation should be in added
    const addedFiles = result.added.map((v) => v.file)
    expect(addedFiles.some((f) => f.includes('newBad'))).toBe(true)
  })

  it('added and resolved are both empty when violations are identical', () => {
    const sharedDir = path.join(tmpDir, 'shared')
    fs.mkdirSync(sharedDir, { recursive: true })
    fs.writeFileSync(
      path.join(sharedDir, 'badImport.ts'),
      `import { something } from '../features/auth'\n`,
    )

    // First run
    const first = runWatchCheck(tmpDir, 'fsd', [])

    // Second run with same violations as previous
    const second = runWatchCheck(tmpDir, 'fsd', first.violations)
    expect(second.added).toHaveLength(0)
    expect(second.resolved).toHaveLength(0)
    expect(second.violations.length).toBe(first.violations.length)
  })

  it('handles both added and resolved simultaneously', () => {
    const old = makeViolation('shared/old.ts', '../features/gone')

    const sharedDir = path.join(tmpDir, 'shared')
    fs.mkdirSync(sharedDir, { recursive: true })
    fs.writeFileSync(
      path.join(sharedDir, 'newBad.ts'),
      `import { x } from '../features/auth'\n`,
    )

    const result = runWatchCheck(tmpDir, 'fsd', [old])

    // old violation resolved (old.ts does not exist)
    expect(result.resolved).toHaveLength(1)
    expect(result.resolved[0].file).toBe('shared/old.ts')

    // new violation added
    const addedFiles = result.added.map((v) => v.file)
    expect(addedFiles.some((f) => f.includes('newBad'))).toBe(true)
  })

  it('works with modular architecture — no violations for clean directory', () => {
    const modDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-watcher-mod-'))
    try {
      const dir = path.join(modDir, 'modules', 'auth')
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(path.join(dir, 'index.ts'), `export const x = 1\n`)

      const result = runWatchCheck(modDir, 'modular', [])
      expect(result.violations).toHaveLength(0)
      expect(result.added).toHaveLength(0)
      expect(result.resolved).toHaveLength(0)
    } finally {
      fs.rmSync(modDir, { recursive: true, force: true })
    }
  })
})
