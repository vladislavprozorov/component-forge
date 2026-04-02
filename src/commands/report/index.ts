import fs from 'node:fs'
import path from 'node:path'

import chalk from 'chalk'
import { Command } from 'commander'

import { loadProjectConfig } from '../../utils/config'
import { logger } from '../../utils/logger'
import { generateStats } from '../stats/index'
import { generateMetrics } from '../metrics/index'
import { loadAliasEntries } from '../check/index'

export function generateReport(srcPath: string, architecture: 'fsd' | 'modular', aliases: any) {
  const stats = generateStats(srcPath, architecture)
  const metrics = generateMetrics(srcPath, aliases)

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      srcPath,
      architecture,
    },
    stats,
    metrics,
  }
}

export const reportCommand = new Command('report')
  .description('Generate a combined JSON report with stats and metrics')
  .option('--out <path>', 'Write the JSON report to the specified path (default: report.json)')
  .action((options: { out?: string }) => {
    const config = loadProjectConfig()
    const root = process.cwd()
    const srcPath = path.join(root, config.srcDir)
  const aliases = loadAliasEntries(process.cwd(), config.srcDir)

    logger.info(`Generating report for ${chalk.cyan(config.srcDir)}...`)

    const report = generateReport(srcPath, config.architecture || 'fsd', aliases)

    const out = options.out ? path.resolve(process.cwd(), options.out) : path.resolve(process.cwd(), 'report.json')
    fs.mkdirSync(path.dirname(out), { recursive: true })
    fs.writeFileSync(out, JSON.stringify(report, null, 2), 'utf8')

    logger.success(`✓ Report written to ${path.relative(process.cwd(), out)}`)
  })
