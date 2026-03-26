import path from 'node:path'

import chalk from 'chalk'

import { loadProjectConfig } from '../../utils/config'
import { logger } from '../../utils/logger'
import { runCheck, loadAliasEntries } from '../check/index'
import { findCycles } from '../cycles/index'
import { findOrphans } from '../orphans/index'
import { generateStats } from '../stats/index'
import {
  checkRequiredLayers,
  checkUnknownLayers,
  checkPublicApiFiles,
  checkBarrelContent,
  checkSharedSegments,
  layerRulesByArchitecture,
} from '../validate/index'

export interface AnalyzeResult {
  stats: { totalFiles: number; layerCount: number; sliceCount: number }
  violations: number
  cycles: number
  orphans: number
  warnings: number
}

export function runAnalyze(srcPath: string, rootDir: string): AnalyzeResult {
  const config = loadProjectConfig()
  const architecture = config.architecture || 'fsd'
  const srcDir = config.srcDir || 'src'

  const aliases = loadAliasEntries(rootDir, srcDir)
  const rule = layerRulesByArchitecture[architecture]

  // 1. Validate
  const validationIssues = [
    ...checkRequiredLayers(srcPath, rule, srcDir),
    ...checkUnknownLayers(srcPath, rule, architecture, srcDir),
    ...checkPublicApiFiles(srcPath, rule, srcDir),
    ...checkBarrelContent(srcPath, rule, srcDir),
    ...checkSharedSegments(srcPath, srcDir),
  ]

  // 2. Stats
  const statsResult = generateStats(srcPath, architecture)
  const totalSlices = Object.values(statsResult.layers).reduce((acc, l) => acc + l.slices.size, 0)
  const layerCount = Object.keys(statsResult.layers).filter((l) => l !== 'unknown').length

  // 3. Orphans
  const { orphanedNodes } = findOrphans(srcPath, aliases)

  // 4. Cycles
  const cycles = findCycles(srcPath, aliases)

  // 5. Violations
  const checkResult = runCheck(srcPath, architecture, aliases, [])

  return {
    stats: {
      totalFiles: statsResult.totalFiles,
      layerCount,
      sliceCount: totalSlices,
    },
    violations: checkResult.violations.length,
    cycles: cycles.length,
    orphans: orphanedNodes.length,
    warnings: validationIssues.length,
  }
}

export function analyzeCommand(): void {
  const config = loadProjectConfig()
  const rootDir = process.cwd()
  const srcPath = path.resolve(rootDir, config.srcDir ?? 'src')

  logger.info(`Analyzing project architecture (${config.architecture})...`)

  const result = runAnalyze(srcPath, rootDir)

  console.log(chalk.bold.magenta('\n🔍 ARCHITECTURE OMNIBUS REPORT'))
  console.log(chalk.gray('----------------------------------------'))

  console.log(`\n📊 ${chalk.bold('Scale & Structure')}`)
  console.log(`  Files Tracked: ${chalk.white(result.stats.totalFiles)}`)
  console.log(`  Layers:        ${chalk.white(result.stats.layerCount)}`)
  console.log(`  Slices:        ${chalk.white(result.stats.sliceCount)}`)

  console.log(`\n🩺 ${chalk.bold('Health Checks')}`)

  if (result.violations === 0) {
    console.log(`  Boundary Violations: ${chalk.green('0 (Perfect)')}`)
  } else {
    console.log(
      `  Boundary Violations: ${chalk.red(result.violations)} ${chalk.gray('(Run `component-forge check` for details)')}`,
    )
  }

  if (result.cycles === 0) {
    console.log(`  Circular Dependencies: ${chalk.green('0 (Clean Graph)')}`)
  } else {
    console.log(
      `  Circular Dependencies: ${chalk.red(result.cycles)} ${chalk.gray('(Run `component-forge cycles` for details)')}`,
    )
  }

  if (result.orphans === 0) {
    console.log(`  Orphaned Slices: ${chalk.green('0 (All code used)')}`)
  } else {
    console.log(
      `  Orphaned Slices: ${chalk.yellow(result.orphans)} ${chalk.gray('(Run `component-forge orphans` for details)')}`,
    )
  }

  if (result.warnings === 0) {
    console.log(`  Validation Warnings: ${chalk.green('0 (Fully compliant)')}`)
  } else {
    console.log(
      `  Validation Warnings: ${chalk.yellow(result.warnings)} ${chalk.gray('(Run `component-forge validate` for details)')}`,
    )
  }

  console.log()

  // Exit with generic error code if serious flaws exist
  if (result.violations > 0 || result.cycles > 0) {
    process.exit(1)
  }
}
