#!/usr/bin/env node

import { Command } from 'commander'

import { checkCommand } from './commands/check'
import { AVAILABLE_TOPICS, explainCommand } from './commands/explain'
import { type SliceType, generateCommand } from './commands/generate'
import { initCommand } from './commands/init'
import { migrateCommand } from './commands/migrate'
import { validateCommand } from './commands/validate'
import type { Architecture } from './types/folder-tree'

const program = new Command()

program
  .name('component-forge')
  .description('Architecture-first CLI for scalable React projects')
  .version('1.2.0')

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
  .argument('<name>', 'Slice name (supports nested paths, e.g. forms/Input)')
  .option('--dry-run', 'Preview files that would be generated without writing them')
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
  .action(() => {
    checkCommand()
  })

// ---------------------------------------------------------------------------
// migrate
// ---------------------------------------------------------------------------

program
  .command('migrate')
  .description('Analyse current project structure and propose a migration plan')
  .requiredOption('--to <architecture>', 'Target architecture: fsd | modular')
  .action((options: { to: string }) => {
    if (!['fsd', 'modular'].includes(options.to)) {
      console.error(`error: --to must be "fsd" or "modular", got "${options.to}"`)
      process.exit(1)
    }
    migrateCommand(options.to as Architecture)
  })

// ---------------------------------------------------------------------------
// explain
// ---------------------------------------------------------------------------

program
  .command('explain')
  .description('Print architecture documentation in the terminal')
  .argument('<topic>', `Topic to explain: ${AVAILABLE_TOPICS.join(' | ')}`)
  .action((topic: string) => {
    explainCommand(topic)
  })

program.parse(process.argv)
