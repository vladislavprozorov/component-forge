#!/usr/bin/env node

import { Command } from 'commander'

import { checkCommand } from './commands/check'
import { type SliceType, generateCommand } from './commands/generate'
import { initCommand } from './commands/init'
import { validateCommand } from './commands/validate'
import type { Architecture } from './types/folder-tree'

const program = new Command()

program
  .name('component-forge')
  .description('Architecture-first CLI for scalable React projects')
  .version('0.1.0')

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
  .argument('<name>', 'Slice name')
  .option('--dry-run', 'Preview files that would be generated without writing them')
  .action((type: SliceType, name: string, options: { dryRun?: boolean }) => {
    generateCommand(type, name, { dryRun: options.dryRun })
  })

program
  .command('validate')
  .description('Validate project structure against the configured architecture')
  .action(() => {
    validateCommand()
  })

program
  .command('check')
  .description('Check that imports do not violate architecture layer boundaries')
  .action(() => {
    checkCommand()
  })

program.parse(process.argv)
