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
  type AliasEntry,
} from '../check/index'
import { getNodeName } from '../graph/index'

export function findCycles(srcPath: string, aliases: AliasEntry[]): string[][] {
  const files = collectSourceFiles(srcPath)

  // Adjacency list: node -> Set of nodes it depends on
  const graph = new Map<string, Set<string>>()

  for (const relFile of files) {
    const fromNode = getNodeName(relFile)
    if (!fromNode) continue

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
        if (!graph.has(toNode)) graph.set(toNode, new Set())
        graph.get(fromNode)!.add(toNode)
      }
    }
  }

  return detectCycles(graph)
}

function detectCycles(graph: Map<string, Set<string>>): string[][] {
  const cycles: string[][] = []
  const foundCycles = new Set<string>()

  for (const startNode of graph.keys()) {
    const localPath: string[] = []
    const localPathSet = new Set<string>()

    function explore(curr: string) {
      localPath.push(curr)
      localPathSet.add(curr)

      const nexts = graph.get(curr) || new Set()
      for (const n of nexts) {
        if (n === startNode) {
          // cycle closed back to startNode
          const cycle = [...localPath]
          let minIdx = 0
          for (let i = 1; i < cycle.length; i++) {
            if (cycle[i] < cycle[minIdx]) minIdx = i
          }
          const norm = [...cycle.slice(minIdx), ...cycle.slice(0, minIdx)]
          const sig = norm.join('->')
          if (!foundCycles.has(sig)) {
            foundCycles.add(sig)
            cycles.push(norm)
          }
        } else if (!localPathSet.has(n)) {
          // Only explore further if we haven't seen this node in the current path.
          // To be safe against blowups in massive graphs, we cap path length.
          if (localPath.length < 15) {
            explore(n)
          }
        }
      }

      localPathSet.delete(curr)
      localPath.pop()
    }

    explore(startNode)
  }

  // Sort cycles by length, then alphabetically
  return cycles.sort((a, b) => {
    if (a.length !== b.length) return a.length - b.length
    return a.join('->').localeCompare(b.join('->'))
  })
}

export async function cyclesCommand(): Promise<void> {
  const config = loadProjectConfig()
  const rootDir = process.cwd()
  const srcPath = path.resolve(rootDir, config.srcDir ?? 'src')

  logger.info(chalk.cyan('Scanning for circular dependencies between slices...\n'))

  const aliases = loadAliasEntries(rootDir, config.srcDir ?? 'src')

  const cycles = findCycles(srcPath, aliases)

  if (cycles.length === 0) {
    logger.success(chalk.green('✅ No circular dependencies found between slices. Excellent!'))
    return
  }

  logger.error(
    chalk.red(
      `❌ Found ${chalk.bold(cycles.length)} circular dependenc${cycles.length === 1 ? 'y' : 'ies'}:`,
    ),
  )

  cycles.forEach((cycle, index) => {
    // A -> B -> C -> A
    const displayCycle = [...cycle, cycle[0]]
      .map((node) => chalk.yellow(node))
      .join(chalk.gray(' ➔ '))
    console.log(`\n  ${chalk.bold(String(index + 1))}. ${displayCycle}`)
  })

  console.log('\n')
  process.exit(1) // Fail if circles are found
}
