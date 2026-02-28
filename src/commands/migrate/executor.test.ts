import os from 'node:os'
import path from 'node:path'

import fs from 'fs-extra'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { executeMove, executeMigration } from './executor'
import { buildMigrationPlan, type FileMoveProposal } from './plan-builder'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string

function mkdir(relPath: string): void {
  fs.ensureDirSync(path.join(tmpDir, relPath))
}

function exists(relPath: string): boolean {
  return fs.existsSync(path.join(tmpDir, relPath))
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-executor-'))
})

afterEach(() => {
  fs.removeSync(tmpDir)
})

function proposal(from: string, to: string): FileMoveProposal {
  return { from, to, reason: 'test' }
}

// ---------------------------------------------------------------------------
// executeMove
// ---------------------------------------------------------------------------

describe('executeMove', () => {
  it('moves a directory and returns status moved', () => {
    mkdir('components')
    fs.writeFileSync(path.join(tmpDir, 'components', 'Button.tsx'), 'export {}')

    const result = executeMove(proposal('components', 'shared/ui/components'), tmpDir)

    expect(result.status).toBe('moved')
    expect(exists('components')).toBe(false)
    expect(exists('shared/ui/components')).toBe(true)
    expect(fs.existsSync(path.join(tmpDir, 'shared/ui/components/Button.tsx'))).toBe(true)
  })

  it('creates intermediate destination directories automatically', () => {
    mkdir('utils')

    const result = executeMove(proposal('utils', 'shared/lib/utils'), tmpDir)

    expect(result.status).toBe('moved')
    expect(exists('shared/lib/utils')).toBe(true)
  })

  it('skips when source does not exist', () => {
    const result = executeMove(proposal('nonexistent', 'shared/nonexistent'), tmpDir)

    expect(result.status).toBe('skipped')
    expect(result.error).toMatch(/does not exist/)
  })

  it('skips when destination already exists', () => {
    mkdir('features')
    mkdir('shared/ui/features') // dest already present

    const result = executeMove(proposal('features', 'shared/ui/features'), tmpDir)

    expect(result.status).toBe('skipped')
    expect(result.error).toMatch(/already exists/)
    // Source must NOT have been removed
    expect(exists('features')).toBe(true)
  })

  it('creates a backup copy before moving when backupDir is provided', () => {
    mkdir('pages')
    fs.writeFileSync(path.join(tmpDir, 'pages', 'Home.tsx'), 'export {}')

    const backupDir = path.join(tmpDir, '.backup')
    fs.ensureDirSync(backupDir)

    const result = executeMove(proposal('pages', 'src/pages'), tmpDir, backupDir)

    expect(result.status).toBe('moved')
    // Backup copy should exist
    expect(fs.existsSync(path.join(backupDir, 'pages', 'Home.tsx'))).toBe(true)
    // Original moved to dest
    expect(exists('src/pages')).toBe(true)
  })

  it('does not create backup when backupDir is undefined', () => {
    mkdir('models')

    const result = executeMove(proposal('models', 'entities/models'), tmpDir, undefined)

    expect(result.status).toBe('moved')
    expect(exists('entities/models')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// executeMigration
// ---------------------------------------------------------------------------

describe('executeMigration', () => {
  it('moves all proposed directories and returns correct counts', () => {
    mkdir('components')
    mkdir('utils')
    mkdir('pages')

    // Build a real plan for an fsd migration
    const plan = buildMigrationPlan(tmpDir, 'fsd')
    // Sanity: plan should have proposals for our dirs
    expect(plan.proposals.length).toBeGreaterThan(0)

    const result = executeMigration(plan, false)

    expect(result.errorCount).toBe(0)
    expect(result.movedCount).toBeGreaterThan(0)
    expect(result.movedCount + result.skippedCount).toBe(plan.proposals.length)
    expect(result.backupDir).toBeUndefined()
  })

  it('creates a backup directory when withBackup is true', () => {
    mkdir('components')

    const plan = buildMigrationPlan(tmpDir, 'fsd')
    const result = executeMigration(plan, true)

    expect(result.backupDir).toBeDefined()
    expect(fs.existsSync(result.backupDir!)).toBe(true)
  })

  it('returns skipped for a directory that was already at the destination', () => {
    mkdir('features') // already an FSD layer → no proposal generated

    const plan = buildMigrationPlan(tmpDir, 'fsd')
    // features is already a valid FSD layer — should have 0 proposals
    expect(plan.proposals.find((p) => p.from === 'features')).toBeUndefined()
  })

  it('handles an empty proposal list gracefully', () => {
    // No dirs → empty plan
    const plan = buildMigrationPlan(tmpDir, 'fsd')
    expect(plan.proposals).toHaveLength(0)

    const result = executeMigration(plan, false)

    expect(result.movedCount).toBe(0)
    expect(result.skippedCount).toBe(0)
    expect(result.errorCount).toBe(0)
  })

  it('reports moved and skipped counts correctly when some destinations pre-exist', () => {
    mkdir('utils')
    mkdir('components')
    // Pre-create the destination for 'components' → should be skipped
    mkdir(path.join('shared', 'ui', 'components'))

    const plan = buildMigrationPlan(tmpDir, 'fsd')
    const result = executeMigration(plan, false)

    // At least one move should succeed (utils → shared/utils or shared/)
    const utilsMove = result.moves.find((m) => m.proposal.from === 'utils')
    expect(utilsMove?.status).toBe('moved')

    // components destination already exists → skipped
    const compMove = result.moves.find((m) => m.proposal.from === 'components')
    expect(compMove?.status).toBe('skipped')
  })
})
