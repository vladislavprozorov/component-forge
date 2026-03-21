import path from 'node:path'

import chalk from 'chalk'

import { loadProjectConfig } from '../../utils/config'
import { logger } from '../../utils/logger'
import { collectSourceFiles, resolveLayer, resolveSlice } from '../check/index'

export interface ProjectStats {
  totalFiles: number
  layers: Record<
    string,
    {
      fileCount: number
      slices: Set<string>
    }
  >
}

export function generateStats(srcPath: string, architecture: 'fsd' | 'modular'): ProjectStats {
  const files = collectSourceFiles(srcPath)

  const stats: ProjectStats = {
    totalFiles: files.length,
    layers: {},
  }

  for (const relFile of files) {
    const layer = resolveLayer(relFile) || 'unknown'
    let slice = architecture === 'fsd' ? resolveSlice(relFile) : null

    // If the "slice" resolves to a file directly (e.g. app/index.ts), don't count it as a slice
    if (slice && slice.includes('.')) {
      slice = null
    }

    if (!stats.layers[layer]) {
      stats.layers[layer] = { fileCount: 0, slices: new Set() }
    }

    stats.layers[layer].fileCount += 1

    // In FSD, layers like 'shared' or 'app' might not have standard slices,
    // but tracking top-level folders within them as "slices" is a useful approximation for stats.
    if (slice) {
      stats.layers[layer].slices.add(slice)
    } else if (architecture === 'modular') {
      const parts = relFile.split(path.sep)
      // Only count if it's a directory (i.e., not a file in the layer root)
      if (parts.length > 2 || (parts.length === 2 && !parts[1].includes('.'))) {
        stats.layers[layer].slices.add(parts[1])
      }
    }
  }

  return stats
}

export async function statsCommand(): Promise<void> {
  const config = loadProjectConfig()
  const rootDir = process.cwd()

  const srcPath = path.resolve(rootDir, config.srcDir ?? 'src')
  const stats = generateStats(srcPath, config.architecture || 'fsd')

  logger.info(chalk.bold.cyan('\\n📊 Project Architecture Statistics\\n'))
  logger.info(`Total source files tracked: ${chalk.bold(stats.totalFiles)}`)
  logger.info(`Detected architecture: ${chalk.bold(config.architecture || 'fsd')}\\n`)

  // Sort layers logically: for FSD use canonical order if possible, else alphabetical
  const FSD_LAYER_ORDER = ['app', 'processes', 'pages', 'widgets', 'features', 'entities', 'shared']

  const layers = Object.keys(stats.layers).sort((a, b) => {
    if (config.architecture === 'fsd') {
      const idxA = FSD_LAYER_ORDER.indexOf(a)
      const idxB = FSD_LAYER_ORDER.indexOf(b)
      if (idxA !== -1 && idxB !== -1) return idxA - idxB
      if (idxA !== -1) return -1
      if (idxB !== -1) return 1
    }
    return a.localeCompare(b)
  })

  for (const layer of layers) {
    const layerData = stats.layers[layer]
    const sliceCount = layerData.slices.size

    let layerLabel = chalk.green.bold(layer)
    if (layer === 'unknown') {
      layerLabel = chalk.gray(layer)
    }

    let detailStr = chalk.dim(`(Files: ${layerData.fileCount}`)
    if (sliceCount > 0 && layer !== 'unknown') {
      detailStr += chalk.dim(`, Slices: ${sliceCount}`)
    }
    detailStr += chalk.dim(')')

    logger.info(`📁 ${layerLabel} ${detailStr}`)
  }

  logger.info('') // padding
}
