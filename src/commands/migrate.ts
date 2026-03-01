import path from 'node:path'

import chalk from 'chalk'
import fs from 'fs-extra'

import type { Architecture } from '../types/folder-tree'
import { loadProjectConfig } from '../utils/config'
import { logger } from '../utils/logger'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FileMoveProposal {
  /** Current path relative to srcDir */
  from: string
  /** Proposed path relative to srcDir */
  to: string
  reason: string
}

export interface MigrationPlan {
  targetArchitecture: Architecture
  sourceDir: string
  proposals: FileMoveProposal[]
  unknownFiles: string[]
  summary: string
}

// ---------------------------------------------------------------------------
// FSD classification heuristics
//
// Maps a current folder-name pattern to the FSD layer it should live in.
// Patterns are checked in order — first match wins.
// ---------------------------------------------------------------------------

interface LayerHeuristic {
  pattern: RegExp
  layer: string
  subdir?: string // e.g. "ui" for shared/ui
}

const FSD_HEURISTICS: LayerHeuristic[] = [
  // App / bootstrap
  { pattern: /^(app|bootstrap|main|root|providers?|router|store)$/i, layer: 'app' },

  // Pages / routes
  { pattern: /^(pages?|routes?|screens?|views?)$/i, layer: 'pages' },

  // Widgets (composite blocks)
  { pattern: /^(widgets?|layouts?|containers?|blocks?)$/i, layer: 'widgets' },

  // Features (user actions)
  { pattern: /^(features?|use-?cases?|actions?|mutations?)$/i, layer: 'features' },

  // Entities (domain models)
  { pattern: /^(entities|models?|domain|types?|interfaces?)$/i, layer: 'entities' },

  // Shared UI
  { pattern: /^(ui|components?|elements?|atoms?|molecules?)$/i, layer: 'shared', subdir: 'ui' },

  // Shared utilities
  { pattern: /^(utils?|helpers?|lib|libs?|common|shared)$/i, layer: 'shared' },

  // Shared API clients
  { pattern: /^(api|services?|http|clients?|fetchers?)$/i, layer: 'shared', subdir: 'api' },

  // Shared hooks
  { pattern: /^(hooks?)$/i, layer: 'shared', subdir: 'hooks' },

  // Shared constants
  { pattern: /^(constants?|config|configs?|settings?)$/i, layer: 'shared', subdir: 'config' },

  // Assets — skip (no move suggestion)
  { pattern: /^(assets?|images?|icons?|fonts?|static)$/i, layer: 'shared', subdir: 'assets' },
]

// ---------------------------------------------------------------------------
// Directory scanner — returns top-level entries inside srcDir
// ---------------------------------------------------------------------------

export function scanTopLevelDirs(srcPath: string): string[] {
  if (!fs.existsSync(srcPath)) return []

  return fs
    .readdirSync(srcPath, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
}

// ---------------------------------------------------------------------------
// Classifier — maps a directory name to an FSD destination
// ---------------------------------------------------------------------------

export function classifyDir(
  dirName: string,
): { layer: string; subdir?: string } | null {
  for (const h of FSD_HEURISTICS) {
    if (h.pattern.test(dirName)) {
      return { layer: h.layer, subdir: h.subdir }
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Plan builder
// ---------------------------------------------------------------------------

export function buildMigrationPlan(
  srcPath: string,
  targetArch: Architecture,
): MigrationPlan {
  const dirs = scanTopLevelDirs(srcPath)
  const proposals: FileMoveProposal[] = []
  const unknownFiles: string[] = []
  const sourceDir = srcPath

  if (targetArch === 'fsd') {
    for (const dir of dirs) {
      // Skip already-correct FSD layers
      const fsdLayers = ['app', 'pages', 'widgets', 'features', 'entities', 'shared', 'processes']
      if (fsdLayers.includes(dir)) continue

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
  } else {
    // modular target — group everything non-shared into modules/
    const modularBase = ['modules', 'shared', 'core']
    for (const dir of dirs) {
      if (modularBase.includes(dir)) continue

      const classification = classifyDir(dir)
      const isSharedCandidate =
        classification &&
        ['shared'].includes(classification.layer) &&
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
  }

  const movedCount = proposals.length
  const unknownCount = unknownFiles.length

  const summary =
    movedCount === 0 && unknownCount === 0
      ? `No changes needed — project already looks like ${targetArch.toUpperCase()}.`
      : `${movedCount} director${movedCount === 1 ? 'y' : 'ies'} to move` +
        (unknownCount > 0 ? `, ${unknownCount} unknown (manual review needed)` : '') +
        '.'

  return { targetArchitecture: targetArch, sourceDir, proposals, unknownFiles, summary }
}

// ---------------------------------------------------------------------------
// Printer — renders the plan as coloured CLI output
// ---------------------------------------------------------------------------

export function printMigrationPlan(plan: MigrationPlan): void {
  const { proposals, unknownFiles, summary, targetArchitecture, sourceDir } = plan
  const rel = path.relative(process.cwd(), sourceDir) || '.'

  console.log(
    chalk.bold(`\n  Migration plan → ${chalk.cyan(targetArchitecture.toUpperCase())}\n`),
  )
  console.log(chalk.gray(`  Analysed: ${rel}\n`))
  console.log(chalk.gray(`  ${'─'.repeat(58)}`))

  if (proposals.length === 0 && unknownFiles.length === 0) {
    console.log(chalk.green(`\n  ✓ ${summary}\n`))
    return
  }

  if (proposals.length > 0) {
    console.log(chalk.bold(`\n  Proposed moves (${proposals.length}):\n`))

    for (const p of proposals) {
      const fromFmt = chalk.yellow(p.from.padEnd(24))
      const toFmt = chalk.green(p.to)
      console.log(`    ${fromFmt} → ${toFmt}`)
      console.log(chalk.gray(`      ↳ ${p.reason}`))
    }
  }

  if (unknownFiles.length > 0) {
    console.log(chalk.bold(`\n  Needs manual review (${unknownFiles.length}):\n`))
    for (const f of unknownFiles) {
      console.log(`    ${chalk.red('?')} ${chalk.white(f)}`)
    }
    console.log(
      chalk.gray('\n    These directories don\'t match known patterns.'),
    )
    console.log(
      chalk.gray(
        `    Run ${chalk.white('component-forge explain fsd')} to understand the target structure.`,
      ),
    )
  }

  console.log(chalk.gray(`\n  ${'─'.repeat(58)}`))
  console.log(chalk.bold(`\n  Summary: ${summary}\n`))

  console.log(chalk.yellow('  ⚠ This is a dry-run analysis — no files were moved.\n'))
  console.log(
    chalk.gray(
      '  To apply: move each directory manually or use your IDE\'s refactor tools.\n',
    ),
  )
  console.log(
    chalk.gray(
      `  After moving, run ${chalk.white('component-forge validate')} and ${chalk.white('component-forge check')} to verify.\n`,
    ),
  )
}

// ---------------------------------------------------------------------------
// Command entry point
// ---------------------------------------------------------------------------

export function migrateCommand(targetArchitecture: Architecture): void {
  const config = loadProjectConfig()

  if (config.architecture === targetArchitecture) {
    logger.info(
      `Project is already configured as ${chalk.bold(targetArchitecture.toUpperCase())}.`,
    )
    logger.info(
      `Run ${chalk.cyan('component-forge validate')} to check the current structure.`,
    )
    return
  }

  const srcPath = path.join(process.cwd(), config.srcDir)
  const plan = buildMigrationPlan(srcPath, targetArchitecture)
  printMigrationPlan(plan)
}
