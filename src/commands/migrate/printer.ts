import path from 'node:path'

import chalk from 'chalk'

import type { Architecture } from '../../types/folder-tree'

import type { ExecutionResult } from './executor'
import type { MigrationPlan } from './plan-builder'

/**
 * Renders a MigrationPlan as colour-coded CLI output.
 * Pure function — receives the plan, writes to stdout.
 */
export function printMigrationPlan(plan: MigrationPlan): void {
  const { proposals, unknownFiles, summary, targetArchitecture, sourceDir } = plan
  const rel = path.relative(process.cwd(), sourceDir) || '.'

  console.log(chalk.bold(`\n  Migration plan → ${chalk.cyan(targetArchitecture.toUpperCase())}\n`))
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

    console.log(chalk.gray("\n    These directories don't match known patterns."))
    console.log(
      chalk.gray(
        `    Run ${chalk.white('component-forge explain fsd')} to understand the target structure.`,
      ),
    )
  }

  console.log(chalk.gray(`\n  ${'─'.repeat(58)}`))
  console.log(chalk.bold(`\n  Summary: ${summary}\n`))
  console.log(chalk.yellow('  ⚠ This is a dry-run analysis — no files were moved.\n'))
  console.log(chalk.gray('  To apply: run the command again with the --execute flag.\n'))
  console.log(
    chalk.gray(
      `  After moving, run ${chalk.white('component-forge validate')} and ${chalk.white('component-forge check')} to verify.\n`,
    ),
  )
}

// ---------------------------------------------------------------------------
// Execution result printer
// ---------------------------------------------------------------------------

/**
 * Renders the result of an executed migration to stdout.
 */
export function printExecutionResult(
  result: ExecutionResult,
  targetArchitecture: Architecture,
): void {
  const { moves, backupDir, movedCount, skippedCount, errorCount } = result

  console.log(
    chalk.bold(`\n  Migration result → ${chalk.cyan(targetArchitecture.toUpperCase())}\n`),
  )
  console.log(chalk.gray(`  ${'─'.repeat(58)}`))

  for (const m of moves) {
    if (m.status === 'moved') {
      const fromFmt = chalk.yellow(m.proposal.from.padEnd(24))
      const toFmt = chalk.green(m.proposal.to)
      console.log(`\n  ${chalk.green('✓')} ${fromFmt} → ${toFmt}`)
    } else if (m.status === 'skipped') {
      console.log(`\n  ${chalk.gray('–')} ${chalk.gray(m.proposal.from.padEnd(24))} skipped`)
      if (m.error) console.log(chalk.gray(`      ↳ ${m.error}`))
    } else {
      console.log(`\n  ${chalk.red('✗')} ${chalk.red(m.proposal.from.padEnd(24))} error`)
      if (m.error) console.log(chalk.red(`      ↳ ${m.error}`))
    }
  }

  console.log(chalk.gray(`\n  ${'─'.repeat(58)}`))

  const summaryParts = [
    movedCount > 0 ? chalk.green(`${movedCount} moved`) : null,
    skippedCount > 0 ? chalk.gray(`${skippedCount} skipped`) : null,
    errorCount > 0 ? chalk.red(`${errorCount} errors`) : null,
  ].filter(Boolean)

  console.log(chalk.bold(`\n  Summary: ${summaryParts.join('  ')}\n`))

  if (backupDir) {
    console.log(chalk.gray(`  Backup: ${path.relative(process.cwd(), backupDir)}\n`))
  }

  if (errorCount > 0) {
    console.log(chalk.red('  Some moves failed. Check the errors above and move them manually.\n'))
  } else if (movedCount > 0) {
    console.log(
      chalk.gray(
        `  Run ${chalk.white('component-forge validate')} and ${chalk.white('component-forge check')} to verify.\n`,
      ),
    )
  }
}
