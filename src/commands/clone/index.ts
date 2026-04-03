import fs from 'node:fs'
import path from 'node:path'

import chalk from 'chalk'
import { Command } from 'commander'

import { loadProjectConfig } from '../../utils/config'
import { logger } from '../../utils/logger'

function capitalize(s: string) {
  if (!s) return s
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function traverseAndProcess(
  currentPath: string,
  sourceName: string,
  targetName: string,
  sourceNameCap: string,
  targetNameCap: string,
  options: { dryRun?: boolean },
) {
  const stats = fs.statSync(currentPath)
  if (stats.isDirectory()) {
    const entries = fs.readdirSync(currentPath)

    // First, process content inside
    for (const entry of entries) {
      const entryPath = path.join(currentPath, entry)
      traverseAndProcess(entryPath, sourceName, targetName, sourceNameCap, targetNameCap, options)
    }

    // Then, rename the directory itself if needed
    const baseName = path.basename(currentPath)
    const newBaseName = baseName
      .replace(new RegExp(sourceName, 'g'), targetName)
      .replace(new RegExp(sourceNameCap, 'g'), targetNameCap)

    if (newBaseName !== baseName && !options.dryRun) {
      const newDir = path.join(path.dirname(currentPath), newBaseName)
      fs.renameSync(currentPath, newDir)
    }
  } else if (stats.isFile()) {
    // Process file content
    if (!options.dryRun) {
      const content = fs.readFileSync(currentPath, 'utf8')
      const newContent = content
        .replace(new RegExp(sourceName, 'g'), targetName)
        .replace(new RegExp(sourceNameCap, 'g'), targetNameCap)
      if (content !== newContent) {
        fs.writeFileSync(currentPath, newContent, 'utf8')
      }
    }

    // Rename the file itself if needed
    const baseName = path.basename(currentPath)
    const newBaseName = baseName
      .replace(new RegExp(sourceName, 'g'), targetName)
      .replace(new RegExp(sourceNameCap, 'g'), targetNameCap)

    if (newBaseName !== baseName && !options.dryRun) {
      const newFile = path.join(path.dirname(currentPath), newBaseName)
      fs.renameSync(currentPath, newFile)
    }
  }
}

export function cloneCommand(
  sourceSlice: string,
  targetSlice: string,
  options: { dryRun?: boolean },
) {
  const srcSlice = sourceSlice.replace(/\\/g, '/')
  const tgtSlice = targetSlice.replace(/\\/g, '/')

  const config = loadProjectConfig()
  const srcPath = path.join(process.cwd(), config.srcDir)

  const sourceFull = path.join(srcPath, ...srcSlice.split('/'))
  const targetFull = path.join(srcPath, ...tgtSlice.split('/'))

  if (!fs.existsSync(sourceFull)) {
    logger.error(`Source slice "${srcSlice}" does not exist at ${sourceFull}`)
    process.exit(1)
  }

  if (fs.existsSync(targetFull)) {
    logger.error(`Target slice "${tgtSlice}" already exists at ${targetFull}`)
    process.exit(1)
  }

  logger.info(`Cloning ${chalk.cyan(srcSlice)} -> ${chalk.green(tgtSlice)}`)

  const sourceName = path.basename(srcSlice)
  const targetName = path.basename(tgtSlice)
  const sourceNameCap = capitalize(sourceName)
  const targetNameCap = capitalize(targetName)

  if (options.dryRun) {
    logger.success(`(Dry Run) Would copy ${sourceFull} to ${targetFull}`)
    logger.success(
      `(Dry Run) Would replace "${sourceName}" with "${targetName}" inside files and filenames.`,
    )
    return
  }

  // 1. Copy entire directory recursively
  fs.cpSync(sourceFull, targetFull, { recursive: true })

  // 2. Recursively find and replace string matches in files, and rename matching files/directories
  traverseAndProcess(targetFull, sourceName, targetName, sourceNameCap, targetNameCap, options)

  logger.success(`✓ Successfully cloned slice to ${tgtSlice}`)
}

export const cliCloneCommand = new Command('clone')
  .description('Clone an exact copy of a slice, performing automatic renaming')
  .argument('<source>', 'The slice to clone (e.g. features/auth)')
  .argument('<target>', 'The new location/name for the clone (e.g. features/user)')
  .option('--dry-run', 'Preview changes without modifying files')
  .addHelpText(
    'after',
    `
Copies the directory and recursively replaces the base name of the source
with the target name inside file contents and filenames.

Examples:
  $ component-forge clone features/auth features/user
  $ component-forge clone entities/post-card entities/comment-card --dry-run
`,
  )
  .action((source: string, target: string, options: { dryRun?: boolean }) => {
    cloneCommand(source, target, { dryRun: options.dryRun })
  })
