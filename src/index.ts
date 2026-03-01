#!/usr/bin/env node

import { Command } from 'commander'

import { initCommand } from './commands/init'
import { generateCommand, SliceType } from './commands/generate'
import { validateCommand } from './commands/validate'

const program = new Command()

program
  .name('component-forge')
  .description('Architecture-first CLI for scalable React projects')
  .version('0.1.0')

program
  .command('init')
  .description('Initialize project structure')
  .argument('<architecture>', 'Architecture type (fsd | modular)', (value) => {
    if (!['fsd', 'modular'].includes(value)) {
      throw new Error('Architecture must be fsd or modular')
    }
    return value
  })
  .action((architecture: 'fsd' | 'modular') => {
    initCommand(architecture)
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

program.parse(process.argv)
