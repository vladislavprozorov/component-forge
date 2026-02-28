import path from 'node:path'

import chalk from 'chalk'

import type { Architecture } from '../../types/folder-tree'
import { loadProjectConfig } from '../../utils/config'
import { logger } from '../../utils/logger'

import { buildMigrationPlan } from './plan-builder'
import { printMigrationPlan } from './printer'

export { buildMigrationPlan, scanTopLevelDirs } from './plan-builder'
export { classifyDir } from './classifier'
export type { FileMoveProposal, MigrationPlan } from './plan-builder'

/**
 * CLI entry point for the migrate command.
 */
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
