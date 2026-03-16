import fs from 'node:fs'
import path from 'node:path'

import chalk from 'chalk'

import { loadProjectConfig } from '../../utils/config'
import { logger } from '../../utils/logger'
import { collectSourceFiles, loadAliasEntries, parseImports, resolveAliasedImport } from '../check/index'

export interface GraphOptions {
  out?: string
  excludeShared?: boolean
}

/**
 * Derives a logical "node" name for the graph from a relative file path.
 * 
 * FSD examples:
 *   features/auth/ui/LoginForm.tsx -> features/auth
 *   entities/user/model/types.ts -> entities/user
 *   shared/ui/Button/index.ts -> shared/ui
 *   app/providers/index.ts -> app
 */
export function getNodeName(relPath: string): string | null {
  // Strip extension
  const withoutExt = relPath.replace(/\.(ts|tsx)$/, '')
  // Convert OS-specific separators to forward slashes for unified handling
  const posixPath = withoutExt.split(path.sep).join('/')
  let parts = posixPath.split('/')
  
  // If the last part is 'index', drop it for grouping purposes
  if (parts[parts.length - 1] === 'index') {
    parts = parts.slice(0, -1)
  }

  const layer = parts[0]
  if (!layer) return null

  // Special cases for layers that are typically not sliced or where segments act as slices
  if (layer === 'app' || layer === 'core') {
    return layer
  }

  if (layer === 'shared') {
    if (parts.length > 1) {
      return `shared/${parts[1]}` // e.g., shared/ui, shared/api
    }
    return 'shared'
  }

  // Normal sliced layers (features, entities, widgets, pages, modules)
  // Everything under layer/<sliceName> is grouped together.
  if (parts.length > 1) {
    return `${layer}/${parts[1]}`
  }

  return layer
}

export function buildDependencyGraph(
  srcPath: string,
  aliases: ReturnType<typeof loadAliasEntries>,
  options: GraphOptions
): string {
  const files = collectSourceFiles(srcPath)
  
  // We'll collect nodes and edges
  // nodes: Set<string>
  // edges: Map<string, Set<string>> (from -> to)
  const nodes = new Set<string>()
  const edges = new Map<string, Set<string>>()

  for (const relFile of files) {
    const fromNode = getNodeName(relFile)
    if (!fromNode) continue
    
    if (options.excludeShared && fromNode.startsWith('shared')) {
      continue
    }

    nodes.add(fromNode)

    const fullPath = path.join(srcPath, relFile)
    const source = fs.readFileSync(fullPath, 'utf8')
    const imports = parseImports(source)

    for (const imp of imports) {
      let resolvedRelPath: string | null = null

      if (imp.startsWith('.')) {
        // Relative import
        const fileDir = path.dirname(fullPath)
        const resolved = path.resolve(fileDir, imp)
        resolvedRelPath = path.relative(srcPath, resolved)
      } else {
        // Alias import
        resolvedRelPath = resolveAliasedImport(imp, aliases)
      }

      if (!resolvedRelPath) continue
      
      // Filter out absolute external imports, or node_modules resolving back
      if (resolvedRelPath.startsWith('..')) continue

      const targetNode = getNodeName(resolvedRelPath)
      if (!targetNode) continue

      if (options.excludeShared && targetNode.startsWith('shared')) {
        continue
      }

      // We only care about connections between DIFFERENT nodes
      if (fromNode !== targetNode) {
        if (!edges.has(fromNode)) {
          edges.set(fromNode, new Set())
        }
        edges.get(fromNode)!.add(targetNode)
        
        // Ensure target is in nodes list even if it has no outgoing connections
        nodes.add(targetNode)
      }
    }
  }

  // Build Mermaid graph
  let mmd = 'graph TD\n'
  
  // Optional: Group by layers using subgraphs
  const byLayer = new Map<string, string[]>()
  for (const node of nodes) {
    const layer = node.split('/')[0]
    if (!byLayer.has(layer)) byLayer.set(layer, [])
    byLayer.get(layer)!.push(node)
  }

  // Layer order to try and present them nicely Top-Down
  const layerOrder = ['app', 'core', 'processes', 'pages', 'widgets', 'features', 'modules', 'entities', 'shared']

  const sortedLayers = Array.from(byLayer.keys()).sort((a, b) => {
    const idxA = layerOrder.indexOf(a)
    const idxB = layerOrder.indexOf(b)
    const posA = idxA === -1 ? 99 : idxA
    const posB = idxB === -1 ? 99 : idxB
    return posA - posB
  })

  // Format nodes. Mermaid doesn't like slashes in node names unless enclosed in brackets or aliased.
  // We'll define aliases: e.g., features_auth["features/auth"]
  const getAlias = (name: string) => name.replace(/[^a-zA-Z0-9]/g, '_')

  for (const layer of sortedLayers) {
    const layerNodes = byLayer.get(layer)!
    mmd += `  subgraph ${getAlias(layer).toUpperCase()} [${layer}]\n`
    for (const node of layerNodes.sort()) {
      mmd += `    ${getAlias(node)}["${node}"]\n`
    }
    mmd += `  end\n`
  }

  mmd += '\n'

  // Add edges
  const sortedEdges = Array.from(edges.keys()).sort()
  for (const from of sortedEdges) {
    const targets = Array.from(edges.get(from)!).sort()
    for (const to of targets) {
      mmd += `  ${getAlias(from)} --> ${getAlias(to)}\n`
    }
  }

  return mmd
}

export function graphCommand(options: GraphOptions = {}): void {
  const config = loadProjectConfig()
  const srcPath = path.join(process.cwd(), config.srcDir)
  const aliases = loadAliasEntries(process.cwd(), config.srcDir)

  logger.info(`Analyzing architecture graph (${config.architecture})...`)

  const mmd = buildDependencyGraph(srcPath, aliases, options)
  
  if (options.out) {
    const outPath = path.resolve(process.cwd(), options.out)
    fs.mkdirSync(path.dirname(outPath), { recursive: true })
    fs.writeFileSync(outPath, mmd, 'utf8')
    logger.success(`✓ Graph written to ${path.relative(process.cwd(), outPath)}`)
  } else {
    // Print directly
    console.log('\n' + chalk.reset(mmd) + '\n')
    logger.info('Copy the above Mermaid code and paste it into a Mermaid live editor or GitHub Markdown.')
  }
}
