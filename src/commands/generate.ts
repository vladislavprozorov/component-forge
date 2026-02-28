import fs from 'fs-extra'
import path from 'node:path'

import { Architecture, ProjectConfig, SliceType } from '../types/folder-tree'
import { logger } from '../utils/logger'
import { CONFIG_FILENAME } from './init'

export { SliceType }

// ---------------------------------------------------------------------------
// Slice placement rules
// Each architecture defines where each slice type lives under srcDir
// ---------------------------------------------------------------------------

type SlicePlacementMap = Partial<Record<SliceType, string>>

const placementByArchitecture: Record<Architecture, SlicePlacementMap> = {
  fsd: {
    feature: 'features',
    entity: 'entities',
    widget: 'widgets',
    page: 'pages',
    component: 'shared/ui',
  },
  modular: {
    module: 'modules',
    component: 'shared/ui',
  },
}

// ---------------------------------------------------------------------------
// Slice segment definitions
// Defines which internal segments (subdirs) each slice type gets
// ---------------------------------------------------------------------------

const segmentsBySliceType: Partial<Record<SliceType, string[]>> = {
  feature: ['ui', 'model', 'api'],
  entity: ['ui', 'model', 'api'],
  widget: ['ui', 'model'],
  page: ['ui'],
  module: ['ui', 'model', 'api'],
  component: [],
}

// ---------------------------------------------------------------------------
// Config loading
// ---------------------------------------------------------------------------

function loadProjectConfig(): ProjectConfig {
  const configPath = path.join(process.cwd(), CONFIG_FILENAME)

  if (!fs.existsSync(configPath)) {
    logger.error(`No ${CONFIG_FILENAME} found.`)
    logger.info('Run "component-forge init <architecture>" first.')
    process.exit(1)
  }

  return fs.readJsonSync(configPath) as ProjectConfig
}

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

/**
 * Resolves the absolute path for the slice being generated.
 * Supports nested names like "forms/Input" → src/shared/ui/forms/Input
 */
function resolveSlicePath(
  config: ProjectConfig,
  sliceType: SliceType,
  sliceName: string,
): string {
  const placement = placementByArchitecture[config.architecture][sliceType]

  if (!placement) {
    const available = Object.keys(placementByArchitecture[config.architecture]).join(', ')
    logger.error(
      `Slice type "${sliceType}" is not supported for ${config.architecture} architecture.`,
    )
    logger.info(`Available types for ${config.architecture}: ${available}`)
    process.exit(1)
  }

  return path.join(process.cwd(), config.srcDir, placement, sliceName)
}

// ---------------------------------------------------------------------------
// File generation
// ---------------------------------------------------------------------------

/**
 * Generates index.ts that re-exports all segments — enforcing public API boundary.
 */
function generatePublicApi(slicePath: string, segments: string[]): void {
  const content =
    segments.length > 0
      ? segments.map((s) => `export * from './${s}'`).join('\n') + '\n'
      : '// Public API — add your exports here\n'

  fs.writeFileSync(path.join(slicePath, 'index.ts'), content)
}

// ---------------------------------------------------------------------------
// Command entry point
// ---------------------------------------------------------------------------

export function generateCommand(sliceType: SliceType, sliceName: string): void {
  const config = loadProjectConfig()
  const slicePath = resolveSlicePath(config, sliceType, sliceName)

  if (fs.existsSync(slicePath)) {
    logger.error(`Already exists: ${path.relative(process.cwd(), slicePath)}`)
    process.exit(1)
  }

  const segments = segmentsBySliceType[sliceType] ?? []

  // Create slice root
  fs.ensureDirSync(slicePath)
  logger.success(`Created: ${path.relative(process.cwd(), slicePath)}`)

  // Create segments
  for (const segment of segments) {
    const segmentPath = path.join(slicePath, segment)
    fs.ensureDirSync(segmentPath)
    logger.success(`Created: ${path.relative(process.cwd(), segmentPath)}`)
  }

  // Generate public API
  generatePublicApi(slicePath, segments)
  logger.success(`Created: ${path.relative(process.cwd(), path.join(slicePath, 'index.ts'))}`)

  logger.info(`Generated ${sliceType} "${sliceName}" successfully.`)
}

