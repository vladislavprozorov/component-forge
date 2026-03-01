import fs from 'fs-extra'
import path from 'node:path'

import { getSliceFiles } from '../templates/files'
import { Architecture, ProjectConfig, SliceType } from '../types/folder-tree'
import { loadProjectConfig } from '../utils/config'
import { logger } from '../utils/logger'

export { SliceType }

// ---------------------------------------------------------------------------
// Slice placement rules
// Each architecture maps slice types to target directories under srcDir
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
// File writing
// ---------------------------------------------------------------------------

function writeFile(filePath: string, content: string): void {
  fs.ensureDirSync(path.dirname(filePath))
  fs.writeFileSync(filePath, content)
  logger.success(`Created: ${path.relative(process.cwd(), filePath)}`)
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

  // Derive the bare name for use in templates (e.g. "forms/Input" → "Input")
  const sliceBaseName = path.basename(sliceName)

  // Create slice root
  fs.ensureDirSync(slicePath)
  logger.success(`Created: ${path.relative(process.cwd(), slicePath)}`)

  // Write templated files (ensureDirSync handles nested segment dirs)
  const files = getSliceFiles(sliceType, sliceBaseName)
  for (const [relativePath, content] of Object.entries(files)) {
    writeFile(path.join(slicePath, relativePath), content)
  }

  logger.info(`Generated ${sliceType} "${sliceName}" successfully.`)
}
