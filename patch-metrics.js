const fs = require('fs')
let content = fs.readFileSync('src/index.ts', 'utf8')

content = content.replace(
  "import { treeCommand } from './commands/tree'",
  "import { treeCommand } from './commands/tree'\nimport { metricsCommand } from './commands/metrics'",
)

content = content.replace(
  'program.addCommand(treeCommand)',
  'program.addCommand(treeCommand)\nprogram.addCommand(metricsCommand)',
)

fs.writeFileSync('src/index.ts', content)
