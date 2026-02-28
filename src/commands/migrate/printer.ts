import path from 'node:path'

import chalk from 'chalk'

import type { MigrationPlan } from './plan-builder'

/**
 * Renders a MigrationPlan as colour-coded CLI output.
 * Pure function — receives the plan, writes to stdout.
 */
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
  console.log(
    chalk.gray(
      "  To apply: move each directory manually or use your IDE's refactor tools.\n",
    ),
  )
  console.log(
    chalk.gray(
      `  After moving, run ${chalk.white('component-forge validate')} and ${chalk.white('component-forge check')} to verify.\n`,
    ),
  )
}
