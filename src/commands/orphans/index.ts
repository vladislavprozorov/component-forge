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

export function findOrphans(
  srcPath: string,
  aliases: AliasEntry[],
): { orphanedNodes: string[]; allNodesCount: number } {
  const files = collectSourceFiles(srcPath)

  const nodes = new Set<string>()
  const incomingEdgesCount = new Map<string, number>()

  for (const relFile of files) {
    const fromNode = getNodeName(relFile)
    if (!fromNode) continue

    nodes.add(fromNode)
    if (!incomingEdgesCount.has(fromNode)) {
      incomingEdgesCount.set(fromNode, 0)
    }

    const fullPath = path.join(srcPath, relFile)
    const source = fs.readFileSync(fullPath, 'utf8')
    const imports = parseImports(source)

    for (const imp of imports) {
      let resolvedRelPath: string | null = null

      if (imp.startsWith('.')) {
        const fileDir = path.dirname(fullPath)
        const resolved = path.resolve(fileDir, imp)
        resolvedRelPath = path.relative(srcPath, resolved)
      } else {
        resolvedRelPath = resolveAliasedImport(imp, aliases)
      }

      if (!resolvedRelPath || resolvedRelPath.startsWith('..')) continue

      const targetNode = getNodeName(resolvedRelPath)
      if (!targetNode) continue

      if (fromNode !== targetNode) {
        // We found an edge fromNode -> targetNode
        const count = incomingEdgesCount.get(targetNode) || 0
        incomingEdgesCount.set(targetNode, count + 1)
      }
    }
  }

  const orphanedNodes: string[] = []
  for (const node of nodes) {
    // Some layers are entry points and should never be considered orphaned
    const layer = node.split('/')[0]
    if (['app', 'core', 'root'].includes(layer)) {
      continue
    }

    if (incomingEdgesCount.get(node) === 0) {
      orphanedNodes.push(node)
    }
  }

  return {
    orphanedNodes: orphanedNodes.sort(),
    allNodesCount: nodes.size,
  }
}

export function orphansCommand(): void {
  const config = loadProjectConfig()
  const srcPath = path.join(process.cwd(), config.srcDir)
  const aliases = loadAliasEntries(process.cwd(), config.srcDir)

  logger.info(`Scanning for orphaned slices (${config.architecture})...`)

  const { orphanedNodes, allNodesCount } = findOrphans(srcPath, aliases)

  if (orphanedNodes.length === 0) {
    logger.success(
      `✓ Codebase is clean. No orphaned slices found across ${allNodesCount} total slices.`,
    )
    return
  }

  console.log(chalk.red(`\n✖ Found ${orphanedNodes.length} orphaned slice(s):\n`))

  // Group by layer for better display
  const byLayer = new Map<string, string[]>()
  for (const node of orphanedNodes) {
    const layer = node.split('/')[0]
    if (!byLayer.has(layer)) byLayer.set(layer, [])
    byLayer.get(layer)!.push(node)
  }

  // Fallback map iteration if custom sorting is missing some items
  const layerOrder = ['processes', 'pages', 'widgets', 'features', 'modules', 'entities', 'shared']
  const sortedLayers = Array.from(byLayer.keys()).sort(
    (a, b) => layerOrder.indexOf(a) - layerOrder.indexOf(b),
  )

  for (const layer of sortedLayers) {
    console.log(chalk.bold.white(`  ${layer}/`))
    for (const node of byLayer.get(layer)!) {
      const sliceName = node.split('/').slice(1).join('/') || '(root)'
      console.log(chalk.yellow(`    • ${sliceName} `) + chalk.gray(`(not imported anywhere)`))
    }
    console.log()
  }

  console.log(
    chalk.gray(`  These slices are never imported by any other slice or the app/core layer.`),
  )
  console.log(
    chalk.gray(
      `  If they are not dynamically imported (e.g. Next.js pages), consider removing them.`,
    ),
  )
  console.log()

  process.exit(1)
}
