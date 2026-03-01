import fs from 'fs-extra'
import path from 'node:path'

import { fsdTemplate } from '../templates/fsd'
import { modularTemplate } from '../templates/modular'
import { logger } from '../utils/logger'

/**
 * Тип дерева папок
 */
type FolderTree = {
  [key: string]: FolderTree
}

/**
 * Поддерживаемые архитектуры
 */
export type Architecture = 'fsd' | 'modular'

/**
 * Реестр шаблонов
 */
const templates: Record<Architecture, FolderTree> = {
  fsd: fsdTemplate,
  modular: modularTemplate,
}

/**
 * Рекурсивное создание структуры папок
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
 * Инициализация архитектуры
 */
export function initCommand(architecture: Architecture): void {
  const template = templates[architecture]

  if (!template) {
    logger.error(`Unknown architecture: ${architecture}`)
    logger.info('Available architectures: fsd, modular')
    process.exit(1)
  }

  const projectRoot = process.cwd()

  logger.info(`Initializing ${architecture.toUpperCase()} architecture...`)

  createStructure(template, projectRoot)

  logger.success('Project structure successfully created.')
}
