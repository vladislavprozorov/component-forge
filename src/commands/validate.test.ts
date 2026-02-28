import fs from 'fs-extra'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  checkPublicApiFiles,
  checkRequiredLayers,
  checkUnknownLayers,
} from './validate'

// ---------------------------------------------------------------------------
// Shared layer rule fixtures
// ---------------------------------------------------------------------------

const fsdRule = {
  required: ['app', 'shared'],
  allowed: ['app', 'processes', 'pages', 'widgets', 'features', 'entities', 'shared'],
}

const modularRule = {
  required: ['shared', 'core'],
  allowed: ['modules', 'shared', 'core'],
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cf-validate-test-'))
}

function mkdir(base: string, ...segments: string[]): string {
  const p = path.join(base, ...segments)
  fs.ensureDirSync(p)
  return p
}

function touch(base: string, ...segments: string[]): void {
  const p = path.join(base, ...segments)
  fs.ensureDirSync(path.dirname(p))
  fs.writeFileSync(p, '')
}

// ---------------------------------------------------------------------------
// checkRequiredLayers
// ---------------------------------------------------------------------------

describe('checkRequiredLayers', () => {
  let tmpDir: string

  beforeEach(() => { tmpDir = makeTempDir() })
  afterEach(() => { fs.removeSync(tmpDir) })

  it('returns no issues when all required layers exist', () => {
    mkdir(tmpDir, 'app')
    mkdir(tmpDir, 'shared')
    const issues = checkRequiredLayers(tmpDir, fsdRule, 'src')
    expect(issues).toHaveLength(0)
  })

  it('returns an error for each missing required layer', () => {
    // Neither app nor shared exist
    const issues = checkRequiredLayers(tmpDir, fsdRule, 'src')
    expect(issues).toHaveLength(2)
    expect(issues.every((i) => i.severity === 'error')).toBe(true)
  })

  it('message contains the missing layer path', () => {
    mkdir(tmpDir, 'app')
    // shared is missing
    const issues = checkRequiredLayers(tmpDir, fsdRule, 'src')
    expect(issues[0].message).toBe('Missing required layer: src/shared')
  })

  it('works for modular architecture', () => {
    mkdir(tmpDir, 'shared')
    // core is missing
    const issues = checkRequiredLayers(tmpDir, modularRule, 'src')
    expect(issues).toHaveLength(1)
    expect(issues[0].message).toBe('Missing required layer: src/core')
  })
})

// ---------------------------------------------------------------------------
// checkUnknownLayers
// ---------------------------------------------------------------------------

describe('checkUnknownLayers', () => {
  let tmpDir: string

  beforeEach(() => { tmpDir = makeTempDir() })
  afterEach(() => { fs.removeSync(tmpDir) })

  it('returns no issues when all dirs are allowed', () => {
    mkdir(tmpDir, 'app')
    mkdir(tmpDir, 'features')
    mkdir(tmpDir, 'shared')
    const issues = checkUnknownLayers(tmpDir, fsdRule, 'fsd', 'src')
    expect(issues).toHaveLength(0)
  })

  it('returns a warning for each unknown directory', () => {
    mkdir(tmpDir, 'app')
    mkdir(tmpDir, 'shared')
    mkdir(tmpDir, 'unknown-layer')
    const issues = checkUnknownLayers(tmpDir, fsdRule, 'fsd', 'src')
    expect(issues).toHaveLength(1)
    expect(issues[0].severity).toBe('warning')
  })

  it('message contains the dir name and architecture', () => {
    mkdir(tmpDir, 'random')
    const issues = checkUnknownLayers(tmpDir, fsdRule, 'fsd', 'src')
    expect(issues[0].message).toContain('"src/random"')
    expect(issues[0].message).toContain('FSD')
  })

  it('ignores files (only checks directories)', () => {
    touch(tmpDir, 'some-file.ts')
    const issues = checkUnknownLayers(tmpDir, fsdRule, 'fsd', 'src')
    expect(issues).toHaveLength(0)
  })

  it('returns empty array when srcPath does not exist', () => {
    const issues = checkUnknownLayers('/non/existent', fsdRule, 'fsd', 'src')
    expect(issues).toHaveLength(0)
  })

  it('reports correct architecture name for modular', () => {
    mkdir(tmpDir, 'alien-dir')
    const issues = checkUnknownLayers(tmpDir, modularRule, 'modular', 'src')
    expect(issues[0].message).toContain('MODULAR')
  })
})

// ---------------------------------------------------------------------------
// checkPublicApiFiles
// ---------------------------------------------------------------------------

describe('checkPublicApiFiles', () => {
  let tmpDir: string

  beforeEach(() => { tmpDir = makeTempDir() })
  afterEach(() => { fs.removeSync(tmpDir) })

  it('returns no issues when all slices have index.ts', () => {
    touch(tmpDir, 'features', 'auth', 'index.ts')
    touch(tmpDir, 'features', 'profile', 'index.ts')
    const issues = checkPublicApiFiles(tmpDir, fsdRule, 'src')
    expect(issues).toHaveLength(0)
  })

  it('returns a warning for each slice missing index.ts', () => {
    mkdir(tmpDir, 'features', 'auth') // no index.ts
    const issues = checkPublicApiFiles(tmpDir, fsdRule, 'src')
    expect(issues).toHaveLength(1)
    expect(issues[0].severity).toBe('warning')
    expect(issues[0].message).toBe('Missing public API: src/features/auth/index.ts')
  })

  it('skips app, shared, and core layers (they are not slice layers)', () => {
    // Even if app/shared have no index.ts, no warning should be produced
    mkdir(tmpDir, 'app', 'some-dir')
    mkdir(tmpDir, 'shared', 'some-dir')
    const issues = checkPublicApiFiles(tmpDir, fsdRule, 'src')
    expect(issues).toHaveLength(0)
  })

  it('skips layers that do not exist on disk', () => {
    // features dir does not exist — should not throw
    const issues = checkPublicApiFiles(tmpDir, fsdRule, 'src')
    expect(issues).toHaveLength(0)
  })

  it('detects missing index.ts across multiple slice layers', () => {
    mkdir(tmpDir, 'features', 'auth')   // missing index.ts
    mkdir(tmpDir, 'entities', 'user')   // missing index.ts
    touch(tmpDir, 'pages', 'home', 'index.ts') // OK
    const issues = checkPublicApiFiles(tmpDir, fsdRule, 'src')
    expect(issues).toHaveLength(2)
    const messages = issues.map((i) => i.message)
    expect(messages).toContain('Missing public API: src/features/auth/index.ts')
    expect(messages).toContain('Missing public API: src/entities/user/index.ts')
  })

  it('works for modular architecture — checks modules layer', () => {
    mkdir(tmpDir, 'modules', 'auth') // missing index.ts
    const issues = checkPublicApiFiles(tmpDir, modularRule, 'src')
    expect(issues).toHaveLength(1)
    expect(issues[0].message).toBe('Missing public API: src/modules/auth/index.ts')
  })
})
