#!/usr/bin/env node

import { Command } from 'commander'
import { initCommand } from './commands/init'

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

program.parse(process.argv)
