import fs from 'node:fs'
import path from 'node:path'

import chalk from 'chalk'

import { loadProjectConfig } from '../../utils/config'
import { logger } from '../../utils/logger'
import {
  collectSourceFiles,
  loadAliasEntries,
  parseImports,
  resolveAliasedImport,
  resolveLayer,
  resolveSlice,
} from '../check/index'

export interface InfoResult {
  targetLayer: string
  targetSlice: string | null
  fileCount: number
  // Slices that the target depends on
  dependencies: Record<string, string[]> // Map group (e.g. 'entities') to slices/segments (e.g. ['user', 'post'])
  // Slices that depend on the target
  dependents: Record<string, string[]>
}

/**
 * Normalizes a slice string. For layer-only targets (like shared or app), the "slice" might just be the segment.
 */

export function generateInfo(
  srcPath: string,
  target: string, // e.g. "features/auth" or "shared"
  architecture: 'fsd' | 'modular',
): InfoResult {
  const parts = target.split(/[/\\]/)
  const targetLayer = parts[0]
  let targetSlice = parts.length > 1 ? parts[1] : null

  // Clean empty slices (e.g. trailing slash "features/" -> "features")
  if (targetSlice === '') targetSlice = null

  const isFsd = architecture === 'fsd'

  const files = collectSourceFiles(srcPath)
  // We can pass process.cwd() or just infer from srcPath.
  // Actually loadAliasEntries needs projectRoot and srcDir.
  const rootDir = process.cwd()
  const srcDir = path.basename(srcPath)
  const aliases = loadAliasEntries(rootDir, srcDir)

  const result: InfoResult = {
    targetLayer,
    targetSlice,
    fileCount: 0,
    dependencies: {},
    dependents: {},
  }

  const addDependency = (layer: string, slice: string | null) => {
    const key = layer
    const val = slice ?? '<root>'
    if (!result.dependencies[key]) result.dependencies[key] = []
    if (!result.dependencies[key].includes(val)) {
      result.dependencies[key].push(val)
    }
  }

  const addDependent = (layer: string, slice: string | null) => {
    const key = layer
    const val = slice ?? '<root>'
    if (!result.dependents[key]) result.dependents[key] = []
    if (!result.dependents[key].includes(val)) {
      result.dependents[key].push(val)
    }
  }

  // Iterate over all files to trace imports
  for (const relFile of files) {
    const fileContent = fs.readFileSync(path.join(srcPath, relFile), 'utf8')
    const imports = parseImports(fileContent)

    const currentLayer = resolveLayer(relFile) || 'unknown'
    let currentSlice = isFsd ? resolveSlice(relFile) : null

    // Fallback logic for non-FSD architectures or shared/app layers
    if (!isFsd || (isFsd && ['shared', 'app'].includes(currentLayer))) {
      const relParts = relFile.split(path.sep)
      currentSlice =
        relParts.length > 2 || (relParts.length === 2 && !relParts[1].includes('.'))
          ? relParts[1]
          : null
    }

    const isCurrentTarget =
      currentLayer === targetLayer && (targetSlice === null || currentSlice === targetSlice)

    if (isCurrentTarget) {
      result.fileCount++
    }

    for (const imp of imports) {
      let importedLayer: string | null = null
      let importedSlice: string | null = null

      if (imp.startsWith('.')) {
        const fileDir = path.dirname(path.join(srcPath, relFile))
        const resolved = path.resolve(fileDir, imp)
        const relResolved = path.relative(srcPath, resolved)
        importedLayer = resolveLayer(relResolved)

        const relResolvedParts = relResolved.split(path.sep)
        importedSlice = isFsd ? resolveSlice(relResolved) : null
        if (!isFsd || (isFsd && importedLayer && ['shared', 'app'].includes(importedLayer))) {
          importedSlice =
            relResolvedParts.length > 2 ||
            (relResolvedParts.length === 2 && !relResolvedParts[1].includes('.'))
              ? relResolvedParts[1]
              : null
        }
      } else {
        const aliasResolved = resolveAliasedImport(imp, aliases)
        if (aliasResolved !== null) {
          importedLayer = resolveLayer(aliasResolved)
          const aliasResolvedParts = aliasResolved.split(path.sep)
          importedSlice = isFsd ? resolveSlice(aliasResolved) : null
          if (!isFsd || (isFsd && importedLayer && ['shared', 'app'].includes(importedLayer))) {
            importedSlice =
              aliasResolvedParts.length > 2 ||
              (aliasResolvedParts.length === 2 && !aliasResolvedParts[1].includes('.'))
                ? aliasResolvedParts[1]
                : null
          }
        }
      }

      if (!importedLayer) continue

      const isImportedTarget =
        importedLayer === targetLayer && (targetSlice === null || importedSlice === targetSlice)

      // Self-imports inside the same target are ignored for dependencies/dependents
      if (isCurrentTarget && isImportedTarget) continue

      // If the current file represents the target, anything it imports is a dependency
      if (isCurrentTarget) {
        addDependency(importedLayer, importedSlice)
      }

      // If the imported file represents the target, the current file is a dependent
      if (isImportedTarget) {
        addDependent(currentLayer, currentSlice)
      }
    }
  }

  return result
}

export async function infoCommand(target: string): Promise<void> {
  if (!target) {
    logger.error('No target specified. Example: component-forge info features/auth')
    process.exit(1)
  }

  const config = loadProjectConfig()
  const rootDir = process.cwd()
  const srcPath = path.resolve(rootDir, config.srcDir ?? 'src')
  const architecture = config.architecture || 'fsd'

  logger.info(chalk.cyan(`Analyzing target: ${chalk.bold(target)}`))

  const result = generateInfo(srcPath, target, architecture)

  if (result.fileCount === 0) {
    logger.warning(
      chalk.yellow(`No files found for target "${target}". Check if spelling is correct.`),
    )
    process.exit(0)
  }

  logger.info(`\\n📦 ${chalk.bold('Overview')}`)
  logger.info(`Layer: ${chalk.green(result.targetLayer)}`)
  if (result.targetSlice) {
    logger.info(`Slice/Segment: ${chalk.green(result.targetSlice)}`)
  }
  logger.info(`Files tracked: ${chalk.bold(result.fileCount)}`)

  const printGroupedRelations = (
    relations: Record<string, string[]>,
    title: string,
    icon: string,
  ) => {
    const keys = Object.keys(relations).sort()
    if (keys.length === 0) {
      logger.info(`\\n${icon} ${chalk.bold(title)}: ${chalk.gray('None')}`)
      return
    }

    logger.info(`\\n${icon} ${chalk.bold(title)}:`)
    for (const key of keys) {
      const slices = relations[key].sort()
      logger.info(`  ${chalk.cyan(key)}`)
      for (const s of slices) {
        logger.info(`    ├─ ${s}`)
      }
    }
  }

  printGroupedRelations(result.dependencies, 'Dependencies (Imports)', '📥')
  printGroupedRelations(result.dependents, 'Dependents (Used By)', '📤')

  logger.info('') // Padding
}
