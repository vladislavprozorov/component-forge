import fs from 'node:fs'
import path from 'node:path'

import chalk from 'chalk'
import { Command } from 'commander'

import { loadProjectConfig } from '../../utils/config'
import { logger } from '../../utils/logger'
import {
  collectSourceFiles,
  loadAliasEntries,
  parseImports,
  resolveAliasedImport,
  type AliasEntry,
} from '../check/index'
import { getNodeName } from '../graph/index'

export interface MetricsData {
  ce: number
  ca: number
  instability: number | null
}

export function generateMetrics(
  srcPath: string,
  aliases: AliasEntry[],
): Record<string, MetricsData> {
  const files = collectSourceFiles(srcPath)

  // graph: Map<fromNode, Set<toNode>> -> This represents Efferent coupling (outgoing)
  const graph = new Map<string, Set<string>>()
  const nodes = new Set<string>()

  for (const relFile of files) {
    const fromNode = getNodeName(relFile)
    if (!fromNode) continue

    nodes.add(fromNode)
    if (!graph.has(fromNode)) graph.set(fromNode, new Set())

    const content = fs.readFileSync(path.join(srcPath, relFile), 'utf8')
    const imports = parseImports(content)

    for (const imp of imports) {
      let resolvedRelPath: string | null = null

      if (imp.startsWith('.')) {
        const fileDir = path.dirname(path.join(srcPath, relFile))
        const absRes = path.resolve(fileDir, imp)
        resolvedRelPath = path.relative(srcPath, absRes)
      } else {
        resolvedRelPath = resolveAliasedImport(imp, aliases)
      }

      if (!resolvedRelPath) continue

      const toNode = getNodeName(resolvedRelPath)
      if (toNode && toNode !== fromNode) {
        nodes.add(toNode)
        if (!graph.has(toNode)) graph.set(toNode, new Set())
        graph.get(fromNode)!.add(toNode)
      }
    }
  }

  const result: Record<string, MetricsData> = {}

  for (const node of nodes) {
    const ce = graph.get(node)?.size || 0
    let ca = 0

    // Calculate Afferent (Ca) - how many other nodes depend on 'node'
    for (const [, dependencies] of graph.entries()) {
      if (dependencies.has(node)) {
        ca++
      }
    }

    const total = ce + ca
    const instability = total === 0 ? null : ce / total

    result[node] = { ce, ca, instability }
  }

  return result
}

function formatInstability(i: number | null) {
  if (i === null) return chalk.gray('N/A')
  const str = i.toFixed(2)
  if (i < 0.3) return chalk.green(str)
  if (i < 0.7) return chalk.yellow(str)
  return chalk.red(str)
}

export const metricsCommand = new Command('metrics')
  .description('Calculate architectural instability metrics for all slices')
  .addHelpText(
    'after',
    `
Metrics calculated:
  Ce (Efferent Coupling): Number of other slices this slice depends on (Outgoing)
  Ca (Afferent Coupling): Number of other slices that depend on this slice (Incoming)
  I  (Instability):       Ce / (Ce + Ca). Ranges from 0 (Stable) to 1 (Unstable)

In FSD, higher layers (app, pages) should be close to 1.
Lower layers (shared, entities) should be close to 0.
  `,
  )
  .action(() => {
    const config = loadProjectConfig()
    const srcPath = path.join(process.cwd(), config.srcDir)
    const aliases = loadAliasEntries(process.cwd(), config.srcDir)

    logger.info(`Calculating metrics for ${chalk.cyan(config.srcDir)}...\n`)

    const metrics = generateMetrics(srcPath, aliases)
    const sortedKeys = Object.keys(metrics).sort((a, b) => a.localeCompare(b))

    if (sortedKeys.length === 0) {
      console.log(chalk.yellow('No slices found.'))
      process.exit(0)
    }

    // Print table header
    console.log(
      chalk.bold(
        'Slice'.padEnd(35) +
          'Ce (Out)'.padStart(10) +
          'Ca (In)'.padStart(10) +
          'I (Instability)'.padStart(20),
      ),
    )
    console.log(chalk.gray('-'.repeat(35 + 10 + 10 + 20)))

    for (const key of sortedKeys) {
      const { ce, ca, instability } = metrics[key]

      const ceStr = ce.toString().padStart(10)
      const caStr = ca.toString().padStart(10)
      const instStr = formatInstability(instability).padStart(20 + (instability === null ? 9 : 9)) // ANSI escape offset padding approximation

      console.log(
        `${chalk.cyan(key.padEnd(35))}${chalk.white(ceStr)}${chalk.white(caStr)}       ${instStr}`,
      )
    }

    console.log()
  })
