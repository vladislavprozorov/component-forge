import fs from 'fs-extra'
import path from 'node:path'

import { Architecture, ProjectConfig, SliceType } from '../types/folder-tree'
import { loadProjectConfig } from '../utils/config'
import { logger } from '../utils/logger'
import { resolveSliceFiles } from '../utils/template-resolver'

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
// File I/O
// ---------------------------------------------------------------------------

function writeFile(filePath: string, content: string): void {
  fs.ensureDirSync(path.dirname(filePath))
  fs.writeFileSync(filePath, content)
  logger.success(`Created: ${path.relative(process.cwd(), filePath)}`)
}

function printDryRun(filePath: string): void {
  logger.info(`Would create: ${path.relative(process.cwd(), filePath)}`)
}

// ---------------------------------------------------------------------------
// Command entry point
// ---------------------------------------------------------------------------

export interface GenerateOptions {
  dryRun?: boolean
}

export function generateCommand(
  sliceType: SliceType,
  sliceName: string,
  options: GenerateOptions = {},
): void {
  const { dryRun = false } = options
  const config = loadProjectConfig()
  const slicePath = resolveSlicePath(config, sliceType, sliceName)

  if (!dryRun && fs.existsSync(slicePath)) {
    logger.error(`Already exists: ${path.relative(process.cwd(), slicePath)}`)
    process.exit(1)
  }

  // Resolve templates directory (absolute path) if configured
  const templatesDir = config.templates
    ? path.resolve(process.cwd(), config.templates)
    : undefined

  // Derive the bare name for use in templates (e.g. "forms/Input" → "Input")
  const sliceBaseName = path.basename(sliceName)
  const files = resolveSliceFiles(sliceType, sliceBaseName, templatesDir)

  if (dryRun) {
    logger.info(`Dry run — no files will be written.\n`)
    printDryRun(slicePath + '/')
    for (const relativePath of Object.keys(files)) {
      printDryRun(path.join(slicePath, relativePath))
    }
    logger.info(`\nDry run complete. Run without --dry-run to generate.`)
    return
  }

  // Create slice root
  fs.ensureDirSync(slicePath)
  logger.success(`Created: ${path.relative(process.cwd(), slicePath)}`)

  // Write files from templates
  for (const [relativePath, content] of Object.entries(files)) {
    writeFile(path.join(slicePath, relativePath), content)
  }

  if (templatesDir) {
    logger.info(`Generated ${sliceType} "${sliceName}" successfully (custom templates).`)
  } else {
    logger.info(`Generated ${sliceType} "${sliceName}" successfully.`)
  }
}
