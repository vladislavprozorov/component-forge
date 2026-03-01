import fs from 'fs-extra'
import path from 'node:path'

import { fsdTemplate } from '../templates/fsd'
import { modularTemplate } from '../templates/modular'
import { Architecture, FolderTree, ProjectConfig } from '../types/folder-tree'
import { logger } from '../utils/logger'

export { Architecture }

export const CONFIG_FILENAME = '.component-forge.json'

/**
 * Template registry — maps architecture → folder tree definition
 */
const templates: Record<Architecture, FolderTree> = {
  fsd: fsdTemplate,
  modular: modularTemplate,
}

/**
 * Recursively creates folder structure from a FolderTree definition
 */
function createStructure(tree: FolderTree, basePath: string): void {
  for (const [folderName, children] of Object.entries(tree)) {
    const folderPath = path.join(basePath, folderName)

    fs.ensureDirSync(folderPath)
    logger.success(`Created: ${path.relative(process.cwd(), folderPath)}`)

    createStructure(children, folderPath)
  }
}

/**
 * Writes .component-forge.json to the project root.
 * This config is used by subsequent commands (generate, validate)
 * to understand the project's architecture without extra flags.
 */
function writeProjectConfig(architecture: Architecture, projectRoot: string): void {
  const config: ProjectConfig = {
    architecture,
    srcDir: 'src',
  }

  const configPath = path.join(projectRoot, CONFIG_FILENAME)
  fs.writeJsonSync(configPath, config, { spaces: 2 })
  logger.success(`Created: ${CONFIG_FILENAME}`)
}

/**
 * Initialises the project folder structure for the given architecture
 * and writes the project config file.
 */
export function initCommand(architecture: Architecture): void {
  const template = templates[architecture]
  const projectRoot = process.cwd()
  const configPath = path.join(projectRoot, CONFIG_FILENAME)

  if (fs.existsSync(configPath)) {
    logger.error(`Project already initialised (${CONFIG_FILENAME} exists).`)
    logger.info('Remove it manually if you want to reinitialise.')
    process.exit(1)
  }

  logger.info(`Initialising ${architecture.toUpperCase()} architecture…`)

  createStructure(template, projectRoot)
  writeProjectConfig(architecture, projectRoot)

  logger.success('Project structure successfully created.')
}

