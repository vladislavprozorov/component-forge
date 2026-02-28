import fs from 'fs-extra'
import path from 'node:path'

import { fsdTemplate } from '../templates/fsd'
import { modularTemplate } from '../templates/modular'
import { Architecture, FolderTree, ProjectConfig } from '../types/folder-tree'
import { CONFIG_FILENAME, loadProjectConfig, writeProjectConfig } from '../utils/config'
import { logger } from '../utils/logger'

export { Architecture }

// Re-export so existing imports of CONFIG_FILENAME from this module keep working
// during the transition period — remove after all call sites are updated.
export { CONFIG_FILENAME }

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
 * Initialises the project folder structure for the given architecture
 * and writes .component-forge.json so subsequent commands know the architecture.
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

  const config: ProjectConfig = { architecture, srcDir: 'src' }
  writeProjectConfig(config, projectRoot)
  logger.success(`Created: ${CONFIG_FILENAME}`)

  logger.success('Project structure successfully created.')
}

// Re-export for modules that imported loadProjectConfig from here
export { loadProjectConfig }


