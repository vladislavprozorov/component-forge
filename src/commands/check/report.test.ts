import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { type CheckResult, writeJsonReport } from './index'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'forge-report-'))
}

function makeCheckResult(partial: Partial<CheckResult> = {}): CheckResult {
  return {
    violations: [],
    checkedFiles: 0,
    ...partial,
  }
}

// ---------------------------------------------------------------------------
// writeJsonReport
// ---------------------------------------------------------------------------

describe('writeJsonReport', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = makeTmpDir()
  })
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('creates the output file at the given path', () => {
    const outPath = path.join(tmpDir, 'report.json')
    writeJsonReport(makeCheckResult({ checkedFiles: 5 }), outPath, 'fsd')
    expect(fs.existsSync(outPath)).toBe(true)
  })

  it('writes valid JSON', () => {
    const outPath = path.join(tmpDir, 'report.json')
    writeJsonReport(makeCheckResult({ checkedFiles: 3 }), outPath, 'fsd')
    const raw = fs.readFileSync(outPath, 'utf8')
    expect(() => JSON.parse(raw)).not.toThrow()
  })

  it('report contains all required top-level fields', () => {
    const outPath = path.join(tmpDir, 'report.json')
    writeJsonReport(makeCheckResult({ checkedFiles: 7 }), outPath, 'modular')
    const report = JSON.parse(fs.readFileSync(outPath, 'utf8'))

    expect(report).toHaveProperty('timestamp')
    expect(report).toHaveProperty('architecture', 'modular')
    expect(report).toHaveProperty('checkedFiles', 7)
    expect(report).toHaveProperty('violations')
    expect(report).toHaveProperty('summary')
  })

  it('timestamp is a valid ISO-8601 string', () => {
    const outPath = path.join(tmpDir, 'report.json')
    writeJsonReport(makeCheckResult(), outPath, 'fsd')
    const { timestamp } = JSON.parse(fs.readFileSync(outPath, 'utf8'))
    expect(new Date(timestamp).toISOString()).toBe(timestamp)
  })

  it('serialises violations with all fields', () => {
    const violations = [
      {
        file: 'features/auth/index.ts',
        importPath: '../cart',
        message: 'Layer "features" must not import from "features"',
        hint: 'Extract to shared/',
      },
    ]
    const outPath = path.join(tmpDir, 'report.json')
    writeJsonReport(makeCheckResult({ violations, checkedFiles: 2 }), outPath, 'fsd')
    const report = JSON.parse(fs.readFileSync(outPath, 'utf8'))

    expect(report.violations).toHaveLength(1)
    const v = report.violations[0]
    expect(v.file).toBe('features/auth/index.ts')
    expect(v.importPath).toBe('../cart')
    expect(v.message).toContain('features')
    expect(v.hint).toBe('Extract to shared/')
  })

  it('summary.total matches violations count', () => {
    const violations = [
      { file: 'features/auth/index.ts', importPath: '../cart', message: 'm', hint: 'h' },
      { file: 'features/auth/index.ts', importPath: '../wishlist', message: 'm', hint: 'h' },
      { file: 'entities/user/index.ts', importPath: '../../features/auth', message: 'm', hint: 'h' },
    ]
    const outPath = path.join(tmpDir, 'report.json')
    writeJsonReport(makeCheckResult({ violations, checkedFiles: 5 }), outPath, 'fsd')
    const report = JSON.parse(fs.readFileSync(outPath, 'utf8'))

    expect(report.summary.total).toBe(3)
  })

  it('summary.byFile counts violations per file correctly', () => {
    const violations = [
      { file: 'features/auth/index.ts', importPath: '../cart', message: 'm', hint: 'h' },
      { file: 'features/auth/index.ts', importPath: '../wishlist', message: 'm', hint: 'h' },
      { file: 'entities/user/index.ts', importPath: '../../features/auth', message: 'm', hint: 'h' },
    ]
    const outPath = path.join(tmpDir, 'report.json')
    writeJsonReport(makeCheckResult({ violations, checkedFiles: 5 }), outPath, 'fsd')
    const { summary } = JSON.parse(fs.readFileSync(outPath, 'utf8'))

    expect(summary.byFile['features/auth/index.ts']).toBe(2)
    expect(summary.byFile['entities/user/index.ts']).toBe(1)
  })

  it('produces an empty violations array when there are no violations', () => {
    const outPath = path.join(tmpDir, 'report.json')
    writeJsonReport(makeCheckResult({ checkedFiles: 10 }), outPath, 'fsd')
    const report = JSON.parse(fs.readFileSync(outPath, 'utf8'))

    expect(report.violations).toEqual([])
    expect(report.summary.total).toBe(0)
    expect(report.summary.byFile).toEqual({})
  })

  it('creates intermediate directories when they do not exist', () => {
    const outPath = path.join(tmpDir, 'reports', 'ci', 'report.json')
    writeJsonReport(makeCheckResult({ checkedFiles: 1 }), outPath, 'fsd')
    expect(fs.existsSync(outPath)).toBe(true)
  })

  it('report file ends with a newline', () => {
    const outPath = path.join(tmpDir, 'report.json')
    writeJsonReport(makeCheckResult(), outPath, 'fsd')
    const raw = fs.readFileSync(outPath, 'utf8')
    expect(raw.endsWith('\n')).toBe(true)
  })

  it('works with absolute output paths', () => {
    const outPath = path.join(tmpDir, 'abs-report.json')
    expect(path.isAbsolute(outPath)).toBe(true)
    writeJsonReport(makeCheckResult({ checkedFiles: 4 }), outPath, 'modular')
    expect(fs.existsSync(outPath)).toBe(true)
  })
})
