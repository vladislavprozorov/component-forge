import fs from 'node:fs'
import path from 'node:path'

import chalk from 'chalk'
import { Command } from 'commander'

import { loadProjectConfig } from '../../utils/config'
import { logger } from '../../utils/logger'
import { collectSourceFiles } from '../check/index'
import { getNodeName } from '../graph/index'

export interface SizeData {
  loc: number
  bytes: number
  files: number
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function generateSizeData(srcPath: string): {
  total: SizeData
  layers: Record<string, SizeData>
  slices: Record<string, SizeData>
} {
  const files = collectSourceFiles(srcPath)

  const total: SizeData = { loc: 0, bytes: 0, files: 0 }
  const layers: Record<string, SizeData> = {}
  const slices: Record<string, SizeData> = {}

  for (const relFile of files) {
    const fullPath = path.join(srcPath, relFile)
    const stat = fs.statSync(fullPath)
    if (!stat.isFile()) continue

    const content = fs.readFileSync(fullPath, 'utf8')
    const loc = content.split('\n').length
    const bytes = stat.size

    total.files++
    total.loc += loc
    total.bytes += bytes

    const nodeName = getNodeName(relFile) || 'unknown'
    const layer = nodeName.split('/')[0]

    if (!layers[layer]) layers[layer] = { loc: 0, bytes: 0, files: 0 }
    layers[layer].files++
    layers[layer].loc += loc
    layers[layer].bytes += bytes

    // If it's a slice (has a slash or is a root-level concept)
    if (!slices[nodeName]) slices[nodeName] = { loc: 0, bytes: 0, files: 0 }
    slices[nodeName].files++
    slices[nodeName].loc += loc
    slices[nodeName].bytes += bytes
  }

  return { total, layers, slices }
}

export const sizeCommand = new Command('size')
  .description('Calculate Lines of Code (LOC) and physical sizes of layers and slices')
  .addHelpText(
    'after',
    `
Analyzes your architecture and prints a size breakdown.
Helps identify oversized slices or layers that might need refactoring.

Examples:
  $ component-forge size
  `,
  )
  .action(() => {
    const config = loadProjectConfig()
    const srcPath = path.join(process.cwd(), config.srcDir)

    logger.info(`Analyzing file sizes in ${chalk.cyan(config.srcDir)}...\n`)

    const { total, layers, slices } = generateSizeData(srcPath)

    if (total.files === 0) {
      console.log(chalk.yellow('No readable files found in the source directory.'))
      process.exit(0)
    }

    console.log(
      chalk.bold.cyan(`📦 Total Project Size: `) +
        chalk.white(`${total.loc.toLocaleString()} LOC `) +
        chalk.gray(`(${formatBytes(total.bytes)} in ${total.files} files)\n`),
    )

    // Sort layers by LOC descending
    const sortedLayers = Object.keys(layers).sort((a, b) => layers[b].loc - layers[a].loc)

    console.log(chalk.bold('Layers by size:'))
    sortedLayers.forEach((layer) => {
      const { loc, bytes, files } = layers[layer]
      const locStr = loc.toLocaleString().padStart(8)
      console.log(
        `  ${chalk.green(layer.padEnd(20))} ${chalk.white(locStr + ' LOC')}  ${chalk.gray(`(${formatBytes(bytes).padEnd(8)} | ${files} files)`)}`,
      )
    })

    console.log('\n' + chalk.bold('Top 15 Heaviest Slices:'))

    // Filter out slices that are just the layer name (like 'app' or 'shared' without sub-slice)
    // unless they truly act as slices. Actually, let's include all nodes, but sort by LOC.
    const sortedSlices = Object.keys(slices)
      .sort((a, b) => slices[b].loc - slices[a].loc)
      .slice(0, 15)

    sortedSlices.forEach((slice, idx) => {
      const { loc, bytes, files } = slices[slice]
      const locStr = loc.toLocaleString().padStart(8)
      const rank = (idx + 1).toString().padStart(2) + '.'
      console.log(
        `  ${chalk.gray(rank)} ${chalk.cyan(slice.padEnd(30))} ${chalk.white(locStr + ' LOC')}  ${chalk.gray(`(${formatBytes(bytes).padEnd(8)} | ${files} files)`)}`,
      )
    })

    console.log()
  })
