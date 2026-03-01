import path from 'node:path'

import fs from 'fs-extra'
import ora from 'ora'

import { type Architecture, type ProjectConfig, SliceType } from '../../types/folder-tree'
import { loadProjectConfig } from '../../utils/config'
import { logger } from '../../utils/logger'
import { resolveSliceFiles } from '../../utils/template-resolver'

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
// Slice descriptions — shown in dry-run and success messages
// ---------------------------------------------------------------------------

const sliceDescriptions: Record<SliceType, string> = {
  feature:   'full vertical slice — ui + model + api',
  entity:    'data-layer slice    — model + api (no UI)',
  widget:    'composite UI block  — ui + model (no api)',
  page:      'route-level shell   — ui only',
  component: 'pure UI atom        — flat component (no model/api)',
  module:    'vertical module     — ui + model + api',
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
  const fileEntries = Object.entries(files)

  // ── Dry-run ──────────────────────────────────────────────────────────────

  if (dryRun) {
    logger.info(`Dry run — no files will be written.`)
    logger.info(`Type: ${sliceType}  (${sliceDescriptions[sliceType]})\n`)
    printDryRun(slicePath + '/')
    for (const relativePath of Object.keys(files)) {
      printDryRun(path.join(slicePath, relativePath))
    }
    logger.info(`\nDry run complete. Run without --dry-run to generate.`)
    return
  }

  // ── Execute with spinner ─────────────────────────────────────────────────

  const rel = path.relative(process.cwd(), slicePath)
  const spinner = ora({
    text: `Generating ${sliceType} "${sliceName}"…`,
    // Disable spinner in non-TTY environments (CI, pipes) so output stays clean
    isEnabled: process.stdout.isTTY,
  }).start()

  try {
    fs.ensureDirSync(slicePath)

    for (const [relativePath, content] of fileEntries) {
      const filePath = path.join(slicePath, relativePath)
      spinner.text = `Creating ${path.relative(process.cwd(), filePath)}…`
      writeFile(filePath, content)
    }

    const source = templatesDir ? ' (custom templates)' : ''
    const fileCount = fileEntries.length + 1 // +1 for the root dir itself

    spinner.succeed(
      `Generated ${sliceType} "${sliceName}"${source} — ${fileCount} file${fileCount === 1 ? '' : 's'}`,
    )

    // Print the created files list after spinner is done
    console.log()
    console.log(`  ${rel}/`)
    for (const relativePath of Object.keys(files)) {
      console.log(`    ${relativePath}`)
    }
    console.log()
    console.log(`  Structure: ${sliceDescriptions[sliceType]}`)
    console.log()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    spinner.fail(`Failed to generate ${sliceType} "${sliceName}": ${message}`)
    process.exit(1)
  }
}
