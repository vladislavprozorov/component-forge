import os from 'node:os'
import path from 'node:path'

import fs from 'fs-extra'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  checkBarrelContent,
  checkPublicApiFiles,
  checkRequiredLayers,
  checkSharedSegments,
  checkUnknownLayers,
  fixMissingPublicApi,
  SHARED_KNOWN_SEGMENTS,
} from './index'

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

// ---------------------------------------------------------------------------
// checkBarrelContent
// ---------------------------------------------------------------------------

describe('checkBarrelContent', () => {
  let tmpDir: string

  beforeEach(() => { tmpDir = makeTempDir() })
  afterEach(() => { fs.removeSync(tmpDir) })

  it('returns no issues when all barrel files have exports', () => {
    touch(tmpDir, 'features', 'auth', 'index.ts')
    fs.writeFileSync(path.join(tmpDir, 'features', 'auth', 'index.ts'), "export { default } from './AuthPage'\n")
    const issues = checkBarrelContent(tmpDir, fsdRule, 'src')
    expect(issues).toHaveLength(0)
  })

  it('returns a warning for an index.ts with no exports', () => {
    touch(tmpDir, 'features', 'auth', 'index.ts')
    // file is empty
    const issues = checkBarrelContent(tmpDir, fsdRule, 'src')
    expect(issues).toHaveLength(1)
    expect(issues[0].severity).toBe('warning')
    expect(issues[0].message).toBe('Empty barrel: src/features/auth/index.ts has no exports')
  })

  it('returns a warning for an index.ts that only has comments', () => {
    touch(tmpDir, 'features', 'auth', 'index.ts')
    fs.writeFileSync(path.join(tmpDir, 'features', 'auth', 'index.ts'), '// TODO: add exports\n')
    const issues = checkBarrelContent(tmpDir, fsdRule, 'src')
    expect(issues).toHaveLength(1)
    expect(issues[0].message).toContain('Empty barrel')
  })

  it('skips slices that have no index.ts at all', () => {
    mkdir(tmpDir, 'features', 'auth') // no index.ts
    const issues = checkBarrelContent(tmpDir, fsdRule, 'src')
    expect(issues).toHaveLength(0)
  })

  it('skips app, shared, and core layers', () => {
    touch(tmpDir, 'app', 'some-slice', 'index.ts')  // empty
    touch(tmpDir, 'shared', 'ui', 'index.ts')       // empty
    const issues = checkBarrelContent(tmpDir, fsdRule, 'src')
    expect(issues).toHaveLength(0)
  })

  it('skips layers that do not exist on disk', () => {
    const issues = checkBarrelContent(tmpDir, fsdRule, 'src')
    expect(issues).toHaveLength(0)
  })

  it('detects empty barrels across multiple slice layers', () => {
    touch(tmpDir, 'features', 'auth', 'index.ts')  // empty
    touch(tmpDir, 'entities', 'user', 'index.ts')  // empty
    touch(tmpDir, 'pages', 'home', 'index.ts')
    fs.writeFileSync(path.join(tmpDir, 'pages', 'home', 'index.ts'), "export { HomePage } from './HomePage'\n")
    const issues = checkBarrelContent(tmpDir, fsdRule, 'src')
    expect(issues).toHaveLength(2)
    const messages = issues.map((i) => i.message)
    expect(messages).toContain('Empty barrel: src/features/auth/index.ts has no exports')
    expect(messages).toContain('Empty barrel: src/entities/user/index.ts has no exports')
  })

  it('recognises export default as a valid export', () => {
    touch(tmpDir, 'features', 'auth', 'index.ts')
    fs.writeFileSync(path.join(tmpDir, 'features', 'auth', 'index.ts'), 'export default function Auth() {}\n')
    const issues = checkBarrelContent(tmpDir, fsdRule, 'src')
    expect(issues).toHaveLength(0)
  })

  it('recognises re-export wildcard as a valid export', () => {
    touch(tmpDir, 'features', 'auth', 'index.ts')
    fs.writeFileSync(path.join(tmpDir, 'features', 'auth', 'index.ts'), "export * from './model'\n")
    const issues = checkBarrelContent(tmpDir, fsdRule, 'src')
    expect(issues).toHaveLength(0)
  })

  it('works for modular architecture — checks modules layer', () => {
    touch(tmpDir, 'modules', 'dashboard', 'index.ts') // empty barrel
    const issues = checkBarrelContent(tmpDir, modularRule, 'src')
    expect(issues).toHaveLength(1)
    expect(issues[0].message).toBe('Empty barrel: src/modules/dashboard/index.ts has no exports')
  })
})

// ---------------------------------------------------------------------------
// checkSharedSegments
// ---------------------------------------------------------------------------

describe('checkSharedSegments', () => {
  let tmpDir: string

  beforeEach(() => { tmpDir = makeTempDir() })
  afterEach(() => { fs.removeSync(tmpDir) })

  it('returns no issues when all shared/ sub-dirs are known segments', () => {
    mkdir(tmpDir, 'shared', 'ui')
    mkdir(tmpDir, 'shared', 'lib')
    mkdir(tmpDir, 'shared', 'api')
    const issues = checkSharedSegments(tmpDir, 'src')
    expect(issues).toHaveLength(0)
  })

  it('returns a warning for an unknown segment directory', () => {
    mkdir(tmpDir, 'shared', 'utils') // not in known list
    const issues = checkSharedSegments(tmpDir, 'src')
    expect(issues).toHaveLength(1)
    expect(issues[0].severity).toBe('warning')
    expect(issues[0].message).toContain('"src/shared/utils"')
    expect(issues[0].message).toContain('not a recognised shared segment')
  })

  it('message lists expected segments', () => {
    mkdir(tmpDir, 'shared', 'helpers')
    const issues = checkSharedSegments(tmpDir, 'src')
    for (const seg of SHARED_KNOWN_SEGMENTS) {
      expect(issues[0].message).toContain(seg)
    }
  })

  it('returns multiple warnings for multiple unknown segments', () => {
    mkdir(tmpDir, 'shared', 'utils')
    mkdir(tmpDir, 'shared', 'constants')
    const issues = checkSharedSegments(tmpDir, 'src')
    expect(issues).toHaveLength(2)
    expect(issues.every((i) => i.severity === 'warning')).toBe(true)
  })

  it('returns no issues when shared/ does not exist', () => {
    const issues = checkSharedSegments(tmpDir, 'src')
    expect(issues).toHaveLength(0)
  })

  it('ignores files — only checks directories', () => {
    touch(tmpDir, 'shared', 'index.ts') // file, not dir
    const issues = checkSharedSegments(tmpDir, 'src')
    expect(issues).toHaveLength(0)
  })

  it('recognises all known segments without warnings', () => {
    for (const seg of SHARED_KNOWN_SEGMENTS) {
      mkdir(tmpDir, 'shared', seg)
    }
    const issues = checkSharedSegments(tmpDir, 'src')
    expect(issues).toHaveLength(0)
  })

  it('respects srcDir in the warning message', () => {
    mkdir(tmpDir, 'shared', 'helpers')
    const issues = checkSharedSegments(tmpDir, 'source')
    expect(issues[0].message).toContain('"source/shared/helpers"')
  })
})

// ---------------------------------------------------------------------------
// fixMissingPublicApi
// ---------------------------------------------------------------------------

describe('fixMissingPublicApi', () => {
  let tmpDir: string

  beforeEach(() => { tmpDir = makeTempDir() })
  afterEach(() => { fs.removeSync(tmpDir) })

  it('creates index.ts for a slice that is missing one', () => {
    mkdir(tmpDir, 'features', 'auth') // no index.ts
    const result = fixMissingPublicApi(tmpDir, fsdRule, 'src')
    expect(result).toHaveLength(1)
    expect(result[0].file).toBe('src/features/auth/index.ts')
    expect(fs.existsSync(path.join(tmpDir, 'features', 'auth', 'index.ts'))).toBe(true)
  })

  it('does not overwrite an existing index.ts', () => {
    const content = "export { Auth } from './ui/Auth'\n"
    touch(tmpDir, 'features', 'auth', 'index.ts')
    fs.writeFileSync(path.join(tmpDir, 'features', 'auth', 'index.ts'), content)

    fixMissingPublicApi(tmpDir, fsdRule, 'src')
    expect(fs.readFileSync(path.join(tmpDir, 'features', 'auth', 'index.ts'), 'utf8')).toBe(content)
  })

  it('returns empty array when all slices already have index.ts', () => {
    touch(tmpDir, 'features', 'auth', 'index.ts')
    fs.writeFileSync(path.join(tmpDir, 'features', 'auth', 'index.ts'), 'export {}\n')
    const result = fixMissingPublicApi(tmpDir, fsdRule, 'src')
    expect(result).toHaveLength(0)
  })

  it('fixes multiple slices across multiple layers in one call', () => {
    mkdir(tmpDir, 'features', 'auth')   // missing
    mkdir(tmpDir, 'features', 'cart')   // missing
    mkdir(tmpDir, 'entities', 'user')   // missing
    touch(tmpDir, 'pages', 'home', 'index.ts') // already has one
    fs.writeFileSync(path.join(tmpDir, 'pages', 'home', 'index.ts'), 'export {}\n')

    const result = fixMissingPublicApi(tmpDir, fsdRule, 'src')
    expect(result).toHaveLength(3)

    const files = result.map((r) => r.file)
    expect(files).toContain('src/features/auth/index.ts')
    expect(files).toContain('src/features/cart/index.ts')
    expect(files).toContain('src/entities/user/index.ts')
  })

  it('created index.ts contains an export statement (passes checkBarrelContent)', () => {
    mkdir(tmpDir, 'features', 'auth')
    fixMissingPublicApi(tmpDir, fsdRule, 'src')

    const content = fs.readFileSync(path.join(tmpDir, 'features', 'auth', 'index.ts'), 'utf8')
    expect(content).toMatch(/^\s*export\s/m)
  })

  it('absolutePath in result points to the created file', () => {
    mkdir(tmpDir, 'features', 'auth')
    const result = fixMissingPublicApi(tmpDir, fsdRule, 'src')
    expect(result[0].absolutePath).toBe(path.join(tmpDir, 'features', 'auth', 'index.ts'))
    expect(fs.existsSync(result[0].absolutePath)).toBe(true)
  })

  it('skips app, shared, and core layers', () => {
    mkdir(tmpDir, 'app', 'root')       // app is not a slice layer
    mkdir(tmpDir, 'shared', 'ui')      // shared is not a slice layer
    const result = fixMissingPublicApi(tmpDir, fsdRule, 'src')
    expect(result).toHaveLength(0)
  })

  it('skips layers that do not exist on disk', () => {
    // No directories at all — should not throw
    const result = fixMissingPublicApi(tmpDir, fsdRule, 'src')
    expect(result).toHaveLength(0)
  })

  it('works for modular architecture — fixes modules layer', () => {
    mkdir(tmpDir, 'modules', 'dashboard') // missing index.ts
    const result = fixMissingPublicApi(tmpDir, modularRule, 'src')
    expect(result).toHaveLength(1)
    expect(result[0].file).toBe('src/modules/dashboard/index.ts')
  })

  it('respects srcDir in the returned file path', () => {
    mkdir(tmpDir, 'features', 'auth')
    const result = fixMissingPublicApi(tmpDir, fsdRule, 'source')
    expect(result[0].file.startsWith('source/')).toBe(true)
  })
})
