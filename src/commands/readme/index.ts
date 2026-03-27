import fs from 'node:fs'
import path from 'node:path'

import chalk from 'chalk'
import { Command } from 'commander'

import { loadProjectConfig } from '../../utils/config'
import { generateInfo } from '../info/index'

function extractPublicApi(dirPath: string): string[] {
  const indexPath = path.join(dirPath, 'index.ts')
  if (!fs.existsSync(indexPath)) return []
  const content = fs.readFileSync(indexPath, 'utf8')
  return content.split('\n').filter((line) => line.trim().startsWith('export '))
}

export function generateReadme(target: string) {
  const config = loadProjectConfig()
  const p = path.join(process.cwd(), config.srcDir, target)

  if (!fs.existsSync(p)) {
    console.error(chalk.red(`❌ Target slice '${target}' does not exist in '${config.srcDir}'.`))
    process.exit(1)
  }

  const { targetSlice, targetLayer, dependencies, dependents } = generateInfo(
    path.join(process.cwd(), config.srcDir),
    target,
    config.architecture || 'fsd',
  )
  const title = targetSlice || targetLayer
  const layer = targetLayer
  const publicApi = extractPublicApi(p)

  let md = `# 🧩 Slice: \`${title}\`\n\n`
  md += `**Layer:** \`${layer}\`\n\n`

  md += `## 📢 Public API\n\n`
  if (publicApi.length === 0) {
    md += `*No public exports found.*\n\n`
  } else {
    md += `\`\`\`typescript\n`
    md += publicApi.join('\\n') + '\\n'
    md += `\`\`\`\n\n`
  }

  md += `## 📥 Dependencies (Imports)\n\n`
  if (Object.keys(dependencies).length === 0) {
    md += `*No registered dependencies.*\n\n`
  } else {
    for (const [depLayer, slices] of Object.entries(dependencies)) {
      md += `- **${depLayer}**\n`
      for (const slice of slices) {
        md += `  - \`${slice}\`\n`
      }
    }
    md += '\\n'
  }

  md += `## 📤 Dependents (Imported by)\n\n`
  if (Object.keys(dependents).length === 0) {
    md += `*No incoming registered dependents.*\n\n`
  } else {
    for (const [depLayer, slices] of Object.entries(dependents)) {
      md += `- **${depLayer}**\n`
      for (const slice of slices) {
        md += `  - \`${slice}\`\n`
      }
    }
    md += '\\n'
  }

  const outPath = path.join(p, 'README.md')
  fs.writeFileSync(outPath, md, 'utf8')
  console.log(chalk.green(`✅ Generated README.md at ${outPath}`))
}

export const readmeCommand = new Command('readme')
  .description(
    'Generate a README.md for a specific slice detailing its public API and dependencies',
  )
  .argument('<slice>', 'Path to slice. E.g. features/auth')
  .action((slice) => {
    generateReadme(slice)
  })
