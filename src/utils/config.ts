import fs from 'fs-extra'
import path from 'node:path'

import { ProjectConfig } from '../types/folder-tree'
import { logger } from './logger'

export const CONFIG_FILENAME = '.component-forge.json'

/**
 * Reads and returns the project config from .component-forge.json.
 * Exits with a user-friendly error if the file does not exist.
 */
export function loadProjectConfig(): ProjectConfig {
  const configPath = path.join(process.cwd(), CONFIG_FILENAME)

  if (!fs.existsSync(configPath)) {
    logger.error(`No ${CONFIG_FILENAME} found.`)
    logger.info('Run "component-forge init <architecture>" first.')
    process.exit(1)
  }

  return fs.readJsonSync(configPath) as ProjectConfig
}

/**
 * Writes the project config to .component-forge.json.
 */
export function writeProjectConfig(config: ProjectConfig, projectRoot: string): void {
  const configPath = path.join(projectRoot, CONFIG_FILENAME)
  fs.writeJsonSync(configPath, config, { spaces: 2 })
}
