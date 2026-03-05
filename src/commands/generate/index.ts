import path from 'node:path'

import chalk from 'chalk'
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

/**
 * Prints a single file preview for --dry-run:
 *   ┌─ src/features/auth/index.ts
 *   │  export { AuthPage } from './ui/AuthPage'
 *   └─
 *
 * Exported for unit testing.
 */
export function printFilePreview(relPath: string, content: string): void {
  const lines = content.split('\n')
  // Trim trailing blank lines
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop()

  console.log(chalk.cyan(`  ┌─ ${relPath}`))
  for (const line of lines) {
    console.log(chalk.gray(`  │  `) + chalk.white(line))
  }
  console.log(chalk.cyan(`  └─`))
  console.log()
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
    const rel = path.relative(process.cwd(), slicePath)
    console.log()
    console.log(
      chalk.bold(`  Dry run — ${sliceType} `) +
      chalk.cyan(`"${sliceName}"`) +
      chalk.gray(`  (${sliceDescriptions[sliceType]})`),
    )
    console.log(chalk.gray(`  Target: ${rel}/\n`))

    for (const [relativePath, content] of fileEntries) {
      const fullRel = path.join(rel, relativePath)
      printFilePreview(fullRel, content)
    }

    console.log(
      chalk.yellow(`  ${fileEntries.length} file(s) would be created.`) +
      chalk.gray(`  Run without --dry-run to generate.`),
    )
    console.log()
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

// ---------------------------------------------------------------------------
// List command — scan srcDir and print existing slices per layer
// ---------------------------------------------------------------------------

/**
 * Scans a layer directory and returns the names of its direct slice subdirs.
 */
export function scanLayerSlices(layerPath: string): string[] {
  if (!fs.existsSync(layerPath)) return []
  return fs
    .readdirSync(layerPath, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
}

/** Returns the list of layer directory names relevant for a given architecture. */
export function getLayersForArchitecture(architecture: Architecture): string[] {
  if (architecture === 'fsd') {
    return ['app', 'processes', 'pages', 'widgets', 'features', 'entities', 'shared']
  }
  return ['modules', 'shared', 'core']
}

/** Describes what lives inside shared/ui — treated as components. */
const SHARED_UI_LAYERS: Record<Architecture, string | null> = {
  fsd: 'shared/ui',
  modular: 'shared/ui',
}

export interface SliceListEntry {
  layer: string
  slices: string[]
}

/**
 * Scans srcPath and returns all existing slices grouped by layer.
 * Empty layers are included so callers know what's configured but empty.
 */
export function listSlices(srcPath: string, architecture: Architecture): SliceListEntry[] {
  const layers = getLayersForArchitecture(architecture)
  const result: SliceListEntry[] = []

  for (const layer of layers) {
    const layerPath = path.join(srcPath, layer)
    const slices = scanLayerSlices(layerPath)
    result.push({ layer, slices })
  }

  // shared/ui gets its own entry (components)
  const sharedUiRel = SHARED_UI_LAYERS[architecture]
  if (sharedUiRel) {
    const sharedUiPath = path.join(srcPath, sharedUiRel)
    const components = scanLayerSlices(sharedUiPath)
    if (components.length > 0) {
      // Merge into shared entry or add separately
      const sharedEntry = result.find((e) => e.layer === 'shared')
      if (sharedEntry) {
        // Annotate the components under shared/ui distinctly
        const annotated = components.map((c) => `ui/${c}`)
        sharedEntry.slices = [
          ...sharedEntry.slices.filter((s) => s !== 'ui'),
          ...annotated,
        ].sort()
      }
    }
  }

  return result
}

export function listCommand(): void {
  const config = loadProjectConfig()
  const srcPath = path.join(process.cwd(), config.srcDir)
  const entries = listSlices(srcPath, config.architecture)

  const totalSlices = entries.reduce((n, e) => n + e.slices.length, 0)

  console.log()
  console.log(
    chalk.bold(`  ${config.architecture.toUpperCase()} slices in ${chalk.cyan(config.srcDir + '/')}`),
  )
  console.log(chalk.gray(`  ${'─'.repeat(48)}`))
  console.log()

  let hasAny = false

  for (const { layer, slices } of entries) {
    const layerPath = path.join(srcPath, layer)
    const exists = fs.existsSync(layerPath)

    if (!exists) {
      console.log(chalk.gray(`  ${layer}/`) + chalk.red('  (missing)'))
      continue
    }

    if (slices.length === 0) {
      console.log(chalk.gray(`  ${layer}/`) + chalk.gray('  (empty)'))
      continue
    }

    console.log(chalk.white(`  ${layer}/`))
    for (const slice of slices) {
      const indexExists = fs.existsSync(path.join(srcPath, layer, slice, 'index.ts'))
      const indicator = indexExists ? chalk.green('✓') : chalk.yellow('!')
      console.log(`    ${indicator} ${chalk.cyan(slice)}`)
    }
    hasAny = true
  }

  console.log()
  console.log(chalk.gray(`  ${'─'.repeat(48)}`))

  if (!hasAny) {
    console.log(chalk.yellow(`  No slices found. Run "component-forge generate" to create one.`))
  } else {
    console.log(
      chalk.gray(`  Total: `) + chalk.white(`${totalSlices} slice${totalSlices === 1 ? '' : 's'}`),
    )
    console.log(
      chalk.gray(`  `) +
      chalk.green('✓') + chalk.gray(' = has index.ts  ') +
      chalk.yellow('!') + chalk.gray(' = missing index.ts'),
    )
  }
  console.log()
}
