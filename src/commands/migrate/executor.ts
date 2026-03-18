import path from 'node:path'

import fs from 'fs-extra'

import type { FileMoveProposal, MigrationPlan } from './plan-builder'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MoveResult {
  proposal: FileMoveProposal
  /** Absolute destination path that was written. */
  dest: string
  status: 'moved' | 'skipped' | 'error'
  /** Populated only when status === 'error'. */
  error?: string
}

export interface ExecutionResult {
  moves: MoveResult[]
  /** Absolute path to the backup directory, or undefined if --backup was not requested. */
  backupDir?: string
  movedCount: number
  skippedCount: number
  errorCount: number
}

// ---------------------------------------------------------------------------
// Single move
// ---------------------------------------------------------------------------

/**
 * Moves one directory from `srcPath/<proposal.from>` to `srcPath/<proposal.to>`.
 *
 * - If the destination already exists the move is **skipped** (non-destructive).
 * - If `backupDir` is provided the source is copied there before moving.
 * - Returns a `MoveResult` describing what happened — never throws.
 */
export function executeMove(
  proposal: FileMoveProposal,
  srcPath: string,
  backupDir?: string,
): MoveResult {
  const from = path.join(srcPath, proposal.from)
  const dest = path.join(srcPath, proposal.to)

  try {
    if (!fs.existsSync(from)) {
      return { proposal, dest, status: 'skipped', error: `Source does not exist: ${proposal.from}` }
    }

    if (fs.existsSync(dest)) {
      return {
        proposal,
        dest,
        status: 'skipped',
        error: `Destination already exists: ${proposal.to}`,
      }
    }

    // Backup before moving
    if (backupDir) {
      const backupDest = path.join(backupDir, proposal.from)
      fs.copySync(from, backupDest, { overwrite: false })
    }

    // Ensure parent directory exists, then move
    fs.ensureDirSync(path.dirname(dest))
    fs.moveSync(from, dest)

    return { proposal, dest, status: 'moved' }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { proposal, dest, status: 'error', error: message }
  }
}

// ---------------------------------------------------------------------------
// Full plan execution
// ---------------------------------------------------------------------------

/**
 * Executes all proposals in the migration plan.
 *
 * @param plan       The plan produced by `buildMigrationPlan`.
 * @param withBackup When true, copies every source directory into a
 *                   `.migrate-backup-<timestamp>` folder before moving.
 *
 * Pure in the sense that all side effects are file-system writes; the
 * function itself is deterministic given the same plan + filesystem state.
 */
export function executeMigration(plan: MigrationPlan, withBackup: boolean): ExecutionResult {
  const { proposals, sourceDir } = plan

  // Create timestamped backup directory once, reuse for all moves
  const backupDir = withBackup
    ? path.join(sourceDir, `../.migrate-backup-${Date.now()}`)
    : undefined

  if (backupDir) {
    fs.ensureDirSync(backupDir)
  }

  const moves: MoveResult[] = []

  for (const proposal of proposals) {
    const result = executeMove(proposal, sourceDir, backupDir)
    moves.push(result)
  }

  return {
    moves,
    backupDir,
    movedCount: moves.filter((m) => m.status === 'moved').length,
    skippedCount: moves.filter((m) => m.status === 'skipped').length,
    errorCount: moves.filter((m) => m.status === 'error').length,
  }
}
