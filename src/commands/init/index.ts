import path from 'node:path'

import { confirm, select, input } from '@inquirer/prompts'
import chalk from 'chalk'
import fs from 'fs-extra'

import { fsdTemplate } from '../../templates/fsd'
import { modularTemplate } from '../../templates/modular'
import type { Architecture, FolderTree, ProjectConfig } from '../../types/folder-tree'
import { CONFIG_FILENAMES, loadProjectConfig, writeForgeConfigTs } from '../../utils/config'
import { logger } from '../../utils/logger'

export { CONFIG_FILENAMES }
export { loadProjectConfig }

// ---------------------------------------------------------------------------
// Template registry
// ---------------------------------------------------------------------------

const templates: Record<Architecture, FolderTree> = {
  fsd: fsdTemplate,
  modular: modularTemplate,
}

// ---------------------------------------------------------------------------
// Architecture descriptions shown in the interactive selector
// ---------------------------------------------------------------------------

const ARCHITECTURE_DESCRIPTIONS: Record<Architecture, string> = {
  fsd: 'Feature-Sliced Design — layer-based architecture for large apps',
  modular: 'Modular — module-centric architecture for medium-sized apps',
}

// ---------------------------------------------------------------------------
// Folder structure creation
// ---------------------------------------------------------------------------

/**
 * Recursively creates folder structure from a FolderTree definition.
 * Returns the list of created paths (relative to cwd) for summary output.
 */
export function createStructure(tree: FolderTree, basePath: string, cwd: string): string[] {
  const created: string[] = []

  for (const [folderName, children] of Object.entries(tree)) {
    const folderPath = path.join(basePath, folderName)
    fs.ensureDirSync(folderPath)
    created.push(path.relative(cwd, folderPath))
    created.push(...createStructure(children, folderPath, cwd))
  }

  return created
}

// ---------------------------------------------------------------------------
// Interactive prompt
// ---------------------------------------------------------------------------

export interface InitAnswers {
  architecture: Architecture
  srcDir: string
}

/**
 * Runs interactive prompts to collect init parameters.
 * Throws if the user cancels (Ctrl+C) — caller handles the exit.
 */
export async function promptInitAnswers(): Promise<InitAnswers> {
  console.log(chalk.bold('\n  component-forge — project initialisation\n'))

  const architecture = await select<Architecture>({
    message: 'Choose your architecture:',
    choices: [
      {
        name: `${chalk.cyan('FSD')}  ${chalk.gray(ARCHITECTURE_DESCRIPTIONS.fsd)}`,
        value: 'fsd' as Architecture,
        short: 'FSD',
      },
      {
        name: `${chalk.cyan('Modular')}  ${chalk.gray(ARCHITECTURE_DESCRIPTIONS.modular)}`,
        value: 'modular' as Architecture,
        short: 'Modular',
      },
    ],
  })

  const srcDir = await input({
    message: 'Source directory:',
    default: 'src',
    validate: (value) => {
      const trimmed = value.trim()
      if (!trimmed) return 'Source directory cannot be empty'
      if (/[<>:"|?*]/.test(trimmed)) return 'Directory name contains invalid characters'
      return true
    },
    transformer: (value) => chalk.cyan(value),
  })

  const confirmed = await confirm({
    message: `Initialise ${chalk.bold(architecture.toUpperCase())} in ${chalk.bold(`./${srcDir.trim()}`)}?`,
    default: true,
  })

  if (!confirmed) {
    logger.info('Aborted.')
    process.exit(0)
  }

  return { architecture, srcDir: srcDir.trim() }
}

// ---------------------------------------------------------------------------
// Core init logic — pure, no side-effects on I/O apart from FS writes
// ---------------------------------------------------------------------------

/**
 * Performs the actual init: creates folder structure + writes config.
 * Exported so it can be called directly (non-interactive) or from tests.
 */
export function runInit(architecture: Architecture, srcDir: string, projectRoot: string): void {
  // Check for any existing config (ts, js, or legacy json)
  const existingConfig = [CONFIG_FILENAMES.ts, CONFIG_FILENAMES.js, CONFIG_FILENAMES.json]
    .find((f) => fs.existsSync(path.join(projectRoot, f)))

  if (existingConfig) {
    logger.error(`Project already initialised (${existingConfig} exists).`)
    logger.info('Remove the config file if you want to reinitialise.')
    process.exit(1)
  }

  logger.info(`\nInitialising ${chalk.bold(architecture.toUpperCase())} architecture in ${chalk.cyan(`./${srcDir}`)}…\n`)

  const template = templates[architecture]

  // Resolve the base path for structure (respects custom srcDir)
  const basePath = path.join(projectRoot, srcDir)
  const created = createStructure(template, basePath, projectRoot)

  for (const p of created) {
    logger.success(`Created: ${p}`)
  }

  const config: ProjectConfig = { architecture, srcDir }
  writeForgeConfigTs(config, projectRoot)
  logger.success(`\nCreated: ${CONFIG_FILENAMES.ts}`)

  console.log(
    chalk.bold(`\n  ✓ ${architecture.toUpperCase()} project initialised successfully!\n`),
  )
  console.log(
    chalk.gray(`  Next steps:\n`) +
      chalk.white(`    component-forge generate feature <name>\n`) +
      chalk.white(`    component-forge validate\n`) +
      chalk.white(`    component-forge check\n`),
  )
}

// ---------------------------------------------------------------------------
// Command entry point
// ---------------------------------------------------------------------------

/**
 * Called from index.ts.
 * If architecture is provided — runs non-interactively (backwards-compatible).
 * If omitted — runs interactive prompts.
 */
export function initCommand(architecture?: Architecture): void {
  if (architecture) {
    // Non-interactive path — keep full backwards compatibility
    runInit(architecture, 'src', process.cwd())
    return
  }

  // Interactive path
  promptInitAnswers()
    .then(({ architecture: arch, srcDir }) => {
      runInit(arch, srcDir, process.cwd())
    })
    .catch((err: unknown) => {
      // ExitPromptError is thrown when user presses Ctrl+C
      const isCancel =
        err instanceof Error && err.name === 'ExitPromptError'
      if (isCancel) {
        console.log(chalk.yellow('\n  Cancelled.\n'))
        process.exit(0)
      }
      throw err
    })
}
