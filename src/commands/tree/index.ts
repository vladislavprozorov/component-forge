import fs from 'node:fs'
import path from 'node:path'

import chalk from 'chalk'
import { Command } from 'commander'

import { loadProjectConfig } from '../../utils/config'

interface TreeBranch {
  name: string
  children: TreeBranch[]
}

export function buildTree(dir: string, depth: number, currentDepth = 0): TreeBranch[] {
  if (currentDepth >= depth) return []
  if (!fs.existsSync(dir)) return []

  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const branches: TreeBranch[] = []

  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
    if (entry.isDirectory()) {
      const fullPath = path.join(dir, entry.name)
      branches.push({
        name: entry.name,
        children: buildTree(fullPath, depth, currentDepth + 1),
      })
    }
  }

  const fsdOrder = ['app', 'processes', 'pages', 'widgets', 'features', 'entities', 'shared']
  if (currentDepth === 0) {
    branches.sort((a, b) => {
      const aIdx = fsdOrder.indexOf(a.name)
      const bIdx = fsdOrder.indexOf(b.name)
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx
      if (aIdx !== -1) return -1
      if (bIdx !== -1) return 1
      return a.name.localeCompare(b.name)
    })
  } else {
    branches.sort((a, b) => a.name.localeCompare(b.name))
  }

  return branches.filter(
    (b) => b.children.length > 0 || fs.readdirSync(path.join(dir, b.name)).length > 0,
  )
}

function printTree(branches: TreeBranch[], prefix = ''): string {
  let output = ''
  for (let i = 0; i < branches.length; i++) {
    const isLast = i === branches.length - 1
    const branchPattern = isLast ? '└── ' : '├── '
    const nextPrefix = prefix + (isLast ? '    ' : '│   ')

    // Choose color
    const color = branches[i].children.length > 0 ? chalk.cyan : chalk.green

    output += `${prefix}${branchPattern}${color(branches[i].name)}\n`
    output += printTree(branches[i].children, nextPrefix)
  }
  return output
}

export function generateTree(targetDir: string, maxDepth: number, dryRun = false): string {
  const t = buildTree(targetDir, maxDepth)
  let result = chalk.bold.cyan(`\n📁 ${path.basename(targetDir)}/\n`)
  result += printTree(t)
  if (!dryRun) {
    console.log(result)
  }
  return result
}

export const treeCommand = new Command('tree')
  .description('Print a visual structured tree of your layers and slices')
  .option('-d, --depth <number>', 'Maximum depth to print', '3')
  .action((options) => {
    const config = loadProjectConfig()
    const targetDir = path.join(process.cwd(), config.srcDir)
    if (!fs.existsSync(targetDir)) {
      console.error(chalk.red(`❌ Source directory '${config.srcDir}' does not exist.`))
      process.exit(1)
    }
    const depth = parseInt(options.depth, 10)
    if (isNaN(depth) || depth < 1) {
      console.error(chalk.red(`❌ Depth must be a strictly positive integer.`))
      process.exit(1)
    }
    generateTree(targetDir, depth)
  })
