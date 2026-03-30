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

export interface MatrixData {
  nodes: string[]
  // matrix[fromNode][toNode] = number of imports
  matrix: Record<string, Record<string, number>>
}

export function generateMatrix(srcPath: string, aliases: AliasEntry[]): MatrixData {
  const files = collectSourceFiles(srcPath)

  const nodes = new Set<string>()
  const matrix: Record<string, Record<string, number>> = {}

  for (const relFile of files) {
    const fromNode = getNodeName(relFile)
    if (!fromNode) continue

    nodes.add(fromNode)
    if (!matrix[fromNode]) matrix[fromNode] = {}

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
        if (!matrix[fromNode]) matrix[fromNode] = {}
        matrix[fromNode][toNode] = (matrix[fromNode][toNode] || 0) + 1
      }
    }
  }

  const sortedNodes = Array.from(nodes).sort()

  // Ensure all nodes have all other nodes initialized to 0
  for (const from of sortedNodes) {
    if (!matrix[from]) matrix[from] = {}
    for (const to of sortedNodes) {
      if (matrix[from][to] === undefined) {
        matrix[from][to] = 0
      }
    }
  }

  return { nodes: sortedNodes, matrix }
}

export const matrixCommand = new Command('matrix')
  .description('Generate a Dependency Structure Matrix (DSM) of slices')
  .addHelpText(
    'after',
    `
Displays a 2D matrix representing the dependencies between architectural slices.
Rows represent the source (importer), and columns represent the target (imported).
A number indicates how many times the source slice imports the target slice.

Examples:
  $ component-forge matrix
  `,
  )
  .action(() => {
    const config = loadProjectConfig()
    const srcPath = path.join(process.cwd(), config.srcDir)
    const aliases = loadAliasEntries(process.cwd(), config.srcDir)

    logger.info(`Analyzing Dependency Matrix for ${chalk.cyan(config.srcDir)}...\n`)

    const { nodes, matrix } = generateMatrix(srcPath, aliases)

    if (nodes.length === 0) {
      console.log(chalk.yellow('No slices found.'))
      process.exit(0)
    }

    // Heuristic layer order to make the matrix diagonal look clean for FSD
    const layerOrder = ['app', 'processes', 'pages', 'widgets', 'features', 'entities', 'shared']

    const getLayerScore = (node: string) => {
      const layer = node.split('/')[0]
      const idx = layerOrder.indexOf(layer)
      return idx === -1 ? 99 : idx
    }

    const sortedNodes = [...nodes].sort((a, b) => {
      const scoreA = getLayerScore(a)
      const scoreB = getLayerScore(b)
      if (scoreA !== scoreB) return scoreA - scoreB
      return a.localeCompare(b)
    })

    // Prepare table columns. We can use numeric indices to save space on terminal
    // and print a legend.

    console.log(chalk.bold('Legend:'))
    sortedNodes.forEach((node, idx) => {
      console.log(`  ${chalk.cyan((idx + 1).toString().padStart(2))} : ${node}`)
    })
    console.log('\n' + chalk.bold('Dependency Matrix (Row imports Column):'))

    const cellWidth = 3
    const headerRow =
      '    ' +
      sortedNodes.map((_, idx) => chalk.cyan((idx + 1).toString().padStart(cellWidth))).join('')
    console.log(headerRow)

    sortedNodes.forEach((rowNode, rowIdx) => {
      let rowStr = chalk.cyan((rowIdx + 1).toString().padStart(2)) + ' |'

      sortedNodes.forEach((colNode, colIdx) => {
        if (rowIdx === colIdx) {
          rowStr += chalk.gray('-'.padStart(cellWidth))
          return
        }
        const count = matrix[rowNode][colNode] || 0
        if (count > 0) {
          // Check if architectural rules are violated (e.g., lower layer importing higher layer)
          const scoreRow = getLayerScore(rowNode)
          const scoreCol = getLayerScore(colNode)
          const isViolation = scoreRow > scoreCol && scoreRow !== 99 && scoreCol !== 99

          const val = count.toString().padStart(cellWidth)
          rowStr += isViolation ? chalk.red(val) : chalk.green(val)
        } else {
          rowStr += chalk.gray(' '.padStart(cellWidth))
        }
      })
      console.log(rowStr)
    })

    console.log('\n(Green: allowed dependency | Red: possible layer violation)')
  })
