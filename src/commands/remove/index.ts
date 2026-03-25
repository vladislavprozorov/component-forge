import fs from 'node:fs'
import path from 'node:path'

import chalk from 'chalk'

import { loadProjectConfig } from '../../utils/config'
import { logger } from '../../utils/logger'
import { generateInfo } from '../info/index'

export function removeCommand(target: string, options: { force?: boolean }): void {
  const config = loadProjectConfig()
  const srcPath = path.join(process.cwd(), config.srcDir)

  const normalizedTarget = target.replace(/\\/g, '/')
  const targetFullPath = path.join(srcPath, ...normalizedTarget.split('/'))

  if (!fs.existsSync(targetFullPath)) {
    logger.error(`Target slice "${normalizedTarget}" does not exist at ${targetFullPath}`)
    process.exit(1)
  }

  logger.info(`Analyzing dependencies for ${chalk.bold(normalizedTarget)}...`)

  // Check dependents
  const info = generateInfo(srcPath, normalizedTarget, config.architecture)
  const dependentCount = Object.keys(info.dependents).length

  if (dependentCount > 0 && !options.force) {
    logger.error(
      `Cannot remove ${chalk.bold(normalizedTarget)} because it is imported by other slices:`,
    )

    for (const [layer, slices] of Object.entries(info.dependents)) {
      console.log(`  ${chalk.cyan(layer)}`)
      for (const s of slices) {
        console.log(`    ├─ ${s}`)
      }
    }

    console.log(chalk.yellow(`\nUse --force to delete anyway, or remove these imports first.`))
    process.exit(1)
  }

  logger.info(`Removing ${chalk.bold(normalizedTarget)}...`)
  fs.rmSync(targetFullPath, { recursive: true, force: true })
  logger.success(`✓ Successfully removed ${normalizedTarget}`)
}
