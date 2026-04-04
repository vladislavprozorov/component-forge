import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import chalk from 'chalk'
import { Command } from 'commander'

import { loadProjectConfig } from '../../utils/config'
import { logger } from '../../utils/logger'
import { collectSourceFiles } from '../check/index'
import { getNodeName } from '../graph/index'

export interface HotspotData {
  loc: number
  commits: number
  score: number // loc * commits (simple churn metric)
}

function getGitCommitsPerFile(srcPath: string, files: string[]): Record<string, number> {
  const commitsMap: Record<string, number> = {}

  try {
    // Run a single git log command that prints the file path for each commit
    // Uses numstat to output added/deleted lines and the filename
    const gitOutput = execSync(`git log --format=format: --name-only ${srcPath}`, {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 10, // 10MB buffer just in case
    })

    const lines = gitOutput.split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      // Only count files that exist in our tracked source files
      // git outputs paths relative to repo root.
      // We must determine if this matches our `src` files.
      // For simplicity, let's normalize both sides to check endsWith
      const posixTracked = files.map((f) => f.split(path.sep).join('/'))

      const match = posixTracked.find((f) => trimmed.endsWith(f))
      if (match) {
        commitsMap[match] = (commitsMap[match] || 0) + 1
      }
    }
  } catch {
    logger.warning(
      'Could not execute Git command to find code churn. Ensure you are in a Git repository.',
    )
  }

  return commitsMap
}

export function generateHotspots(srcPath: string): Record<string, HotspotData> {
  const files = collectSourceFiles(srcPath)
  const commitsPerFile = getGitCommitsPerFile(srcPath, files)

  const slices: Record<string, HotspotData> = {}

  for (const relFile of files) {
    const fullPath = path.join(srcPath, relFile)
    let loc = 0
    try {
      const stat = fs.statSync(fullPath)
      if (stat.isFile()) {
        const content = fs.readFileSync(fullPath, 'utf8')
        loc = content.split('\n').length
      }
    } catch {
      // Ignore unreadable files
    }

    const nodeName = getNodeName(relFile) || 'unknown'

    // We only care about slices, layer-level roots are ok too.
    if (!slices[nodeName]) {
      slices[nodeName] = { loc: 0, commits: 0, score: 0 }
    }

    const posixRel = relFile.split(path.sep).join('/')
    const fileCommits = commitsPerFile[posixRel] || 0

    slices[nodeName].loc += loc
    // Add up commits for all files in the slice as an approximation of directory churn
    slices[nodeName].commits += fileCommits
  }

  // Calculate score
  for (const key of Object.keys(slices)) {
    slices[key].score = slices[key].loc * slices[key].commits
  }

  return slices
}

export const hotspotsCommand = new Command('hotspots')
  .description('Identify architectural hotspots by analyzing code churn (Git) vs lines of code')
  .addHelpText(
    'after',
    `
Scans Git history to find slices that are frequently modified AND very large.
High score slices are your best candidates for refactoring or splitting.

Examples:
  $ component-forge hotspots
  `,
  )
  .action(() => {
    const config = loadProjectConfig()
    const srcPath = path.join(process.cwd(), config.srcDir)

    logger.info(`Analyzing architectural hotspots for ${chalk.cyan(config.srcDir)}...\n`)

    const slices = generateHotspots(srcPath)

    // Sort descending by score
    const sortedSlices = Object.keys(slices)
      .filter((k) => slices[k].score > 0)
      .sort((a, b) => slices[b].score - slices[a].score)

    if (sortedSlices.length === 0) {
      console.log(chalk.yellow('No hotspots found or Git history is not available.'))
      process.exit(0)
    }

    console.log(
      chalk.bold(
        'Slice'.padEnd(35) +
          'LOC'.padStart(10) +
          'Commits'.padStart(10) +
          'Score (Risk)'.padStart(15),
      ),
    )
    console.log(chalk.gray('-'.repeat(35 + 10 + 10 + 15)))

    for (let i = 0; i < Math.min(20, sortedSlices.length); i++) {
      const key = sortedSlices[i]
      const { loc, commits, score } = slices[key]

      const locStr = loc.toString().padStart(10)
      const comStr = commits.toString().padStart(10)
      const scoreStr = score.toString().padStart(15)

      // Color code the risk
      let renderScore = chalk.white(scoreStr)
      if (i < 3) renderScore = chalk.red(scoreStr)
      else if (i < 10) renderScore = chalk.yellow(scoreStr)

      console.log(
        `${chalk.cyan(key.padEnd(35))}${chalk.gray(locStr)}${chalk.gray(comStr)}${renderScore}`,
      )
    }

    console.log('\n' + chalk.gray('Top 20 hotspots displayed. Score = LOC * Commits.'))
  })
