import path from 'node:path'

import fs from 'fs-extra'

import type { Architecture } from '../../types/folder-tree'

import { classifyDir } from './classifier'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FileMoveProposal {
  /** Current directory name relative to srcDir */
  from: string
  /** Proposed path relative to srcDir */
  to: string
  /** Human-readable reason for the move */
  reason: string
}

export interface MigrationPlan {
  targetArchitecture: Architecture
  sourceDir: string
  proposals: FileMoveProposal[]
  /** Directories that didn't match any known pattern — need manual review */
  unknownFiles: string[]
  summary: string
}

// ---------------------------------------------------------------------------
// Directory scanner
// ---------------------------------------------------------------------------

/**
 * Returns the names of top-level directories inside srcPath.
 * Files at the root level are intentionally ignored.
 */
export function scanTopLevelDirs(srcPath: string): string[] {
  if (!fs.existsSync(srcPath)) return []

  return fs
    .readdirSync(srcPath, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
}

// ---------------------------------------------------------------------------
// Plan builder
// ---------------------------------------------------------------------------

const FSD_LAYERS = new Set([
  'app', 'processes', 'pages', 'widgets', 'features', 'entities', 'shared',
])

const MODULAR_BASE = new Set(['modules', 'shared', 'core'])

function buildFsdProposals(
  dirs: string[],
): { proposals: FileMoveProposal[]; unknownFiles: string[] } {
  const proposals: FileMoveProposal[] = []
  const unknownFiles: string[] = []

  for (const dir of dirs) {
    if (FSD_LAYERS.has(dir)) continue // already correct

    const classification = classifyDir(dir)
    if (!classification) {
      unknownFiles.push(dir)
      continue
    }

    const { layer, subdir } = classification
    const to = subdir ? path.join(layer, subdir, dir) : path.join(layer, dir)

    proposals.push({
      from: dir,
      to,
      reason: `"${dir}" maps to FSD layer "${layer}"${subdir ? `/${subdir}` : ''}`,
    })
  }

  return { proposals, unknownFiles }
}

function buildModularProposals(dirs: string[]): FileMoveProposal[] {
  const proposals: FileMoveProposal[] = []

  for (const dir of dirs) {
    if (MODULAR_BASE.has(dir)) continue

    const classification = classifyDir(dir)
    const isSharedCandidate =
      classification?.layer === 'shared' &&
      !['api', 'services'].includes(dir.toLowerCase())

    if (isSharedCandidate) {
      proposals.push({
        from: dir,
        to: path.join('shared', dir),
        reason: `"${dir}" is a shared utility/UI — belongs under shared/`,
      })
    } else {
      proposals.push({
        from: dir,
        to: path.join('modules', dir),
        reason: `"${dir}" is a feature domain — wrap as a module`,
      })
    }
  }

  return proposals
}

function buildSummary(
  proposals: FileMoveProposal[],
  unknownFiles: string[],
  target: Architecture,
): string {
  if (proposals.length === 0 && unknownFiles.length === 0) {
    return `No changes needed — project already looks like ${target.toUpperCase()}.`
  }

  const moved = proposals.length
  const unknown = unknownFiles.length
  return (
    `${moved} director${moved === 1 ? 'y' : 'ies'} to move` +
    (unknown > 0 ? `, ${unknown} unknown (manual review needed)` : '') +
    '.'
  )
}

/**
 * Builds a migration plan by analysing top-level directories in srcPath.
 * Pure function — no filesystem writes, safe to call at any time.
 */
export function buildMigrationPlan(
  srcPath: string,
  targetArch: Architecture,
): MigrationPlan {
  const dirs = scanTopLevelDirs(srcPath)

  const { proposals, unknownFiles } =
    targetArch === 'fsd'
      ? buildFsdProposals(dirs)
      : { proposals: buildModularProposals(dirs), unknownFiles: [] }

  return {
    targetArchitecture: targetArch,
    sourceDir: srcPath,
    proposals,
    unknownFiles,
    summary: buildSummary(proposals, unknownFiles, targetArch),
  }
}
