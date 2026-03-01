#!/usr/bin/env node

import { Command } from 'commander'

import { checkCommand } from './commands/check'
import { AVAILABLE_TOPICS, explainCommand } from './commands/explain'
import { type SliceType, generateCommand } from './commands/generate'
import { initCommand } from './commands/init'
import { migrateCommand } from './commands/migrate'
import { validateCommand } from './commands/validate'
import type { Architecture } from './types/folder-tree'

// Read version from package.json at runtime — stays in sync automatically.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { version } = require('../package.json') as { version: string }

const program = new Command()

program
  .name('component-forge')
  .description('Architecture-first CLI for scalable React projects')
  .version(version)

// ---------------------------------------------------------------------------
// init
// ---------------------------------------------------------------------------

program
  .command('init')
  .description('Initialize project structure (interactive if no architecture provided)')
  .argument('[architecture]', 'Architecture type: fsd | modular (optional — prompts if omitted)')
  .action((architecture?: string) => {
    if (architecture !== undefined && !['fsd', 'modular'].includes(architecture)) {
      console.error(`error: architecture must be "fsd" or "modular", got "${architecture}"`)
      process.exit(1)
    }
    initCommand(architecture as Architecture | undefined)
  })

// ---------------------------------------------------------------------------
// generate
// ---------------------------------------------------------------------------

const SLICE_TYPES: SliceType[] = ['feature', 'entity', 'widget', 'page', 'component', 'module']

program
  .command('generate')
  .alias('g')
  .description('Generate a slice or component')
  .argument('<type>', `Slice type (${SLICE_TYPES.join(' | ')})`, (value) => {
    if (!SLICE_TYPES.includes(value as SliceType)) {
      throw new Error(`Type must be one of: ${SLICE_TYPES.join(', ')}`)
    }
    return value as SliceType
  })
  .argument(
    '<name>',
    'Slice name — supports nested paths (e.g. auth/LoginForm) to place the slice inside a subfolder',
  )
  .option('--dry-run', 'Preview files that would be generated without writing them')
  .addHelpText(
    'after',
    `
Slice types and their generated structure:
  feature    Full vertical slice → ui/<Name>.tsx  model/index.ts  api/index.ts  index.ts
  entity     Data-layer slice    → model/index.ts  api/index.ts  index.ts
  widget     Composite UI block  → ui/<Name>.tsx  model/index.ts  index.ts
  page       Route-level shell   → ui/<Name>Page.tsx  index.ts
  component  Pure UI atom        → <Name>.tsx  index.ts
  module     Vertical module     → ui/<Name>.tsx  model/index.ts  api/index.ts  index.ts

Nested paths:
  The <name> argument supports "/" separators to nest the slice inside a subdirectory.
  The basename is used for the component name in generated files.

Examples:
  $ component-forge g feature auth
      Creates: src/features/auth/

  $ component-forge g feature auth/LoginForm
      Creates: src/features/auth/LoginForm/   (component name: LoginForm)

  $ component-forge g entity user/profile/Address
      Creates: src/entities/user/profile/Address/   (component name: Address)

  $ component-forge g component Button --dry-run
      Preview: src/shared/ui/Button/
`
  )
  .action((type: SliceType, name: string, options: { dryRun?: boolean }) => {
    generateCommand(type, name, { dryRun: options.dryRun })
  })

// ---------------------------------------------------------------------------
// validate
// ---------------------------------------------------------------------------

program
  .command('validate')
  .description('Validate project structure against the configured architecture')
  .action(() => {
    validateCommand()
  })

// ---------------------------------------------------------------------------
// check
// ---------------------------------------------------------------------------

program
  .command('check')
  .description('Check that imports do not violate architecture layer boundaries')
  .option('--watch', 'Re-run check automatically when files change')
  .addHelpText(
    'after',
    `
  Each violation is printed with a targeted "→ Fix:" hint.
  Exits with code 1 when violations are found (useful in CI pipelines).

  Options:
    --watch   Watch source files and re-run on every change (great during development)

  Examples:
    $ component-forge check
    $ component-forge check --watch
`
  )
  .action((options: { watch?: boolean }) => {
    checkCommand({ watch: options.watch })
  })

// ---------------------------------------------------------------------------
// migrate
// ---------------------------------------------------------------------------

program
  .command('migrate')
  .description('Analyse current project structure and propose a migration plan')
  .requiredOption('--to <architecture>', 'Target architecture: fsd | modular')
  .addHelpText(
    'after',
    `
  Scans your source directory and prints a step-by-step migration plan.
  No files are moved — this is a dry-run analysis only.

  Examples:
    $ component-forge migrate --to fsd
    $ component-forge migrate --to modular
`
  )
  .option('--execute', 'Apply the migration — actually move the files', false)
  .option('--backup', 'Create a backup before moving (requires --execute)', false)
  .action((options: { to: string; execute: boolean; backup: boolean }) => {
    if (!['fsd', 'modular'].includes(options.to)) {
      console.error(`error: --to must be "fsd" or "modular", got "${options.to}"`)
      process.exit(1)
    }
    migrateCommand(options.to as Architecture, {
      execute: options.execute,
      backup: options.backup,
    })
  })

// ---------------------------------------------------------------------------
// explain
// ---------------------------------------------------------------------------

program
  .command('explain')
  .description('Print architecture documentation in the terminal')
  .argument('<topic>', `Topic to explain: ${AVAILABLE_TOPICS.join(' | ')}`)
  .addHelpText(
    'after',
    `
  Available topics: fsd, modular, layers, slices, segments

  Examples:
    $ component-forge explain fsd
    $ component-forge explain layers
    $ component-forge explain slices
`
  )
  .action((topic: string) => {
    explainCommand(topic)
  })

program.parse(process.argv)
