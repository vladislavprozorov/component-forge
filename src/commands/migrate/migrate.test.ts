import os from 'node:os'
import path from 'node:path'

import fs from 'fs-extra'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { buildMigrationPlan, classifyDir, scanTopLevelDirs } from './index'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string

function mkdir(relPath: string): void {
  fs.ensureDirSync(path.join(tmpDir, relPath))
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-migrate-'))
})

afterEach(() => {
  fs.removeSync(tmpDir)
})

// ---------------------------------------------------------------------------
// scanTopLevelDirs
// ---------------------------------------------------------------------------

describe('scanTopLevelDirs', () => {
  it('returns only directory names, not files', () => {
    mkdir('components')
    mkdir('utils')
    fs.writeFileSync(path.join(tmpDir, 'index.ts'), '')

    const dirs = scanTopLevelDirs(tmpDir)
    expect(dirs).toContain('components')
    expect(dirs).toContain('utils')
    expect(dirs).not.toContain('index.ts')
  })

  it('returns empty array for non-existent path', () => {
    expect(scanTopLevelDirs('/non/existent/path')).toEqual([])
  })

  it('returns empty array for empty directory', () => {
    expect(scanTopLevelDirs(tmpDir)).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// classifyDir
// ---------------------------------------------------------------------------

describe('classifyDir', () => {
  it('classifies "components" as shared/ui', () => {
    const result = classifyDir('components')
    expect(result).not.toBeNull()
    expect(result!.layer).toBe('shared')
    expect(result!.subdir).toBe('ui')
  })

  it('classifies "utils" as shared', () => {
    const result = classifyDir('utils')
    expect(result).not.toBeNull()
    expect(result!.layer).toBe('shared')
  })

  it('classifies "pages" as pages', () => {
    const result = classifyDir('pages')
    expect(result).not.toBeNull()
    expect(result!.layer).toBe('pages')
  })

  it('classifies "views" as pages', () => {
    const result = classifyDir('views')
    expect(result).not.toBeNull()
    expect(result!.layer).toBe('pages')
  })

  it('classifies "store" as app', () => {
    const result = classifyDir('store')
    expect(result).not.toBeNull()
    expect(result!.layer).toBe('app')
  })

  it('classifies "api" as shared/api', () => {
    const result = classifyDir('api')
    expect(result).not.toBeNull()
    expect(result!.layer).toBe('shared')
    expect(result!.subdir).toBe('api')
  })

  it('classifies "hooks" as shared/hooks', () => {
    const result = classifyDir('hooks')
    expect(result).not.toBeNull()
    expect(result!.layer).toBe('shared')
    expect(result!.subdir).toBe('hooks')
  })

  it('returns null for unrecognised directory', () => {
    expect(classifyDir('my-weird-custom-dir')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// buildMigrationPlan — FSD target
// ---------------------------------------------------------------------------

describe('buildMigrationPlan → fsd', () => {
  it('proposes moves for standard React project structure', () => {
    mkdir('components')
    mkdir('pages')
    mkdir('utils')
    mkdir('api')
    mkdir('hooks')

    const plan = buildMigrationPlan(tmpDir, 'fsd')

    // pages is already an FSD layer — should be skipped
    const froms = plan.proposals.map((p) => p.from)
    expect(froms).not.toContain('pages')

    // components, utils, api, hooks should get proposals
    expect(froms).toContain('components')
    expect(froms).toContain('utils')
    expect(froms).toContain('api')
    expect(froms).toContain('hooks')
  })

  it('skips directories already in correct FSD layers', () => {
    mkdir('features')
    mkdir('entities')
    mkdir('shared')
    mkdir('widgets')
    mkdir('pages')
    mkdir('app')

    const plan = buildMigrationPlan(tmpDir, 'fsd')
    expect(plan.proposals).toHaveLength(0)
  })

  it('puts unrecognised dirs in unknownFiles', () => {
    mkdir('super-weird-module')

    const plan = buildMigrationPlan(tmpDir, 'fsd')
    expect(plan.unknownFiles).toContain('super-weird-module')
    expect(plan.proposals).toHaveLength(0)
  })

  it('proposal has correct from/to/reason shape', () => {
    mkdir('components')

    const plan = buildMigrationPlan(tmpDir, 'fsd')
    const proposal = plan.proposals.find((p) => p.from === 'components')!

    expect(proposal).toBeDefined()
    expect(proposal.to).toContain('shared')
    expect(proposal.to).toContain('ui')
    expect(proposal.reason).toContain('shared')
  })

  it('summary reflects proposal count', () => {
    mkdir('components')
    mkdir('utils')

    const plan = buildMigrationPlan(tmpDir, 'fsd')
    expect(plan.summary).toMatch(/\d+ director/)
  })

  it('summary says no changes when already FSD', () => {
    mkdir('features')
    mkdir('shared')

    const plan = buildMigrationPlan(tmpDir, 'fsd')
    expect(plan.summary).toContain('No changes needed')
  })
})

// ---------------------------------------------------------------------------
// buildMigrationPlan — modular target
// ---------------------------------------------------------------------------

describe('buildMigrationPlan → modular', () => {
  it('wraps unknown dirs as modules/', () => {
    mkdir('auth')
    mkdir('cart')

    const plan = buildMigrationPlan(tmpDir, 'modular')
    const froms = plan.proposals.map((p) => p.from)
    expect(froms).toContain('auth')
    expect(froms).toContain('cart')

    const authProp = plan.proposals.find((p) => p.from === 'auth')!
    expect(authProp.to).toMatch(/^modules/)
  })

  it('puts utils-like dirs under shared/', () => {
    mkdir('utils')

    const plan = buildMigrationPlan(tmpDir, 'modular')
    const utilsProp = plan.proposals.find((p) => p.from === 'utils')!
    expect(utilsProp.to).toMatch(/^shared/)
  })

  it('skips already-correct modular dirs', () => {
    mkdir('modules')
    mkdir('shared')
    mkdir('core')

    const plan = buildMigrationPlan(tmpDir, 'modular')
    expect(plan.proposals).toHaveLength(0)
  })
})
