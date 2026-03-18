import path from 'node:path'

import chalk from 'chalk'

import type { Architecture } from '../../types/folder-tree'
import { loadProjectConfig, writeProjectConfig } from '../../utils/config'
import { logger } from '../../utils/logger'

import { executeMigration } from './executor'
import { buildMigrationPlan } from './plan-builder'
import { printExecutionResult, printMigrationPlan } from './printer'

export { buildMigrationPlan, scanTopLevelDirs } from './plan-builder'
export { classifyDir } from './classifier'
export { executeMove, executeMigration } from './executor'
export type { FileMoveProposal, MigrationPlan } from './plan-builder'
export type { ExecutionResult, MoveResult } from './executor'

export interface MigrateOptions {
  /** When true, actually moves the files instead of just printing the plan. */
  execute?: boolean
  /** When true (and execute is true), copies source dirs to a backup folder before moving. */
  backup?: boolean
}

/**
 * CLI entry point for the migrate command.
 */
export function migrateCommand(
  targetArchitecture: Architecture,
  options: MigrateOptions = {},
): void {
  const { execute = false, backup = false } = options
  const config = loadProjectConfig()

  if (config.architecture === targetArchitecture) {
    logger.info(`Project is already configured as ${chalk.bold(targetArchitecture.toUpperCase())}.`)
    logger.info(`Run ${chalk.cyan('component-forge validate')} to check the current structure.`)
    return
  }

  const srcPath = path.join(process.cwd(), config.srcDir)
  const plan = buildMigrationPlan(srcPath, targetArchitecture)

  if (!execute) {
    // Dry-run: just print the plan
    printMigrationPlan(plan)
    return
  }

  // --- Execute mode ---
  if (plan.proposals.length === 0) {
    logger.success('✓ Nothing to move — project already matches the target structure.')
    return
  }

  logger.info(
    chalk.bold(`\n  Executing migration → ${chalk.cyan(targetArchitecture.toUpperCase())}\n`),
  )

  if (backup) {
    logger.info(chalk.gray('  Creating backup before moving files…'))
  }

  const result = executeMigration(plan, backup)
  printExecutionResult(result, targetArchitecture)

  // Update forge.config architecture if all moves succeeded with no errors
  if (result.errorCount === 0) {
    try {
      writeProjectConfig({ ...config, architecture: targetArchitecture }, process.cwd())
      logger.success(`\n  ✓ forge.config updated: architecture → "${targetArchitecture}"`)
    } catch {
      logger.info(
        chalk.yellow(
          `\n  ⚠ Could not update forge.config automatically.\n` +
            `    Update "architecture" to "${targetArchitecture}" manually.`,
        ),
      )
    }
  }

  if (result.errorCount > 0) {
    process.exit(1)
  }
}
