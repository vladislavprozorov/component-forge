import fs from 'fs-extra'
import path from 'node:path'

import { logger } from '../utils/logger'

/**
 * Поддерживаемые типы слайсов
 */
export type SliceType = 'feature' | 'entity' | 'widget' | 'page' | 'component' | 'module'

/**
 * Карта слайсов FSD → папка назначения
 */
const fsdSliceMap: Partial<Record<SliceType, string>> = {
  feature: 'src/features',
  entity: 'src/entities',
  widget: 'src/widgets',
  page: 'src/pages',
}

/**
 * Карта для Modular архитектуры
 */
const modularSliceMap: Partial<Record<SliceType, string>> = {
  module: 'src/modules',
  component: 'src/shared/ui',
}

/**
 * Внутренняя структура слайса
 * feature/auth → auth/ui, auth/model, auth/api, auth/index.ts
 */
const sliceInternals: Partial<Record<SliceType, string[]>> = {
  feature: ['ui', 'model', 'api'],
  entity: ['ui', 'model', 'api'],
  widget: ['ui', 'model'],
  page: ['ui'],
  module: ['ui', 'model', 'api'],
  component: [],
}

/**
 * Резолв целевой папки для слайса
 */
function resolveTargetDir(sliceType: SliceType, sliceName: string): string {
  const base =
    fsdSliceMap[sliceType] ??
    modularSliceMap[sliceType]

  if (!base) {
    logger.error(`Unknown slice type: "${sliceType}"`)
    logger.info(`Available types: feature, entity, widget, page, component, module`)
    process.exit(1)
  }

  return path.join(process.cwd(), base, sliceName)
}

/**
 * Генерация index.ts — public API слайса
 */
function generateIndexFile(slicePath: string, internals: string[]): void {
  const exports = internals
    .map((dir) => `export * from './${dir}'`)
    .join('\n')

  const content = exports ? `${exports}\n` : `// Public API\n`

  fs.writeFileSync(path.join(slicePath, 'index.ts'), content)
}

/**
 * Команда generate
 */
export function generateCommand(sliceType: SliceType, sliceName: string): void {
  const targetDir = resolveTargetDir(sliceType, sliceName)

  if (fs.existsSync(targetDir)) {
    logger.error(`Already exists: ${path.relative(process.cwd(), targetDir)}`)
    process.exit(1)
  }

  fs.ensureDirSync(targetDir)
  logger.success(`Created: ${path.relative(process.cwd(), targetDir)}`)

  const internals = sliceInternals[sliceType] ?? []

  for (const dir of internals) {
    const subDir = path.join(targetDir, dir)
    fs.ensureDirSync(subDir)
    logger.success(`Created: ${path.relative(process.cwd(), subDir)}`)
  }

  generateIndexFile(targetDir, internals)
  logger.success(`Created: ${path.relative(process.cwd(), path.join(targetDir, 'index.ts'))}`)

  logger.info(`Generated ${sliceType} "${sliceName}" successfully.`)
}
