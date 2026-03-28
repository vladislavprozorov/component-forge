#!/usr/bin/env node

import { Command } from 'commander'

import { analyzeCommand } from './commands/analyze'
import { checkCommand } from './commands/check'
import { cyclesCommand } from './commands/cycles'
import { docsCommand } from './commands/docs'
import { explainCommand, AVAILABLE_TOPICS } from './commands/explain'
import { listCommand, generateCommand, type SliceType } from './commands/generate'
import { graphCommand } from './commands/graph'
import { infoCommand } from './commands/info'
import { initCommand } from './commands/init'
import { migrateCommand } from './commands/migrate'
import { moveCommand } from './commands/move'
import { orphansCommand } from './commands/orphans'
import { readmeCommand } from './commands/readme'
import { removeCommand } from './commands/remove'
import { statsCommand } from './commands/stats'
import { validateCommand } from './commands/validate'
import type { Architecture } from './types/folder-tree'

// Read version from package.json at runtime — stays in sync automatically.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { version } = require('../package.json') as { version: string }

const program = new Command()

program
  .name('component-forge')
  .description('Architecture-first CLI for scalable React projects')
  .version(version)

// ---------------------------------------------------------------------------
// init
// ---------------------------------------------------------------------------

program
  .command('init')
  .description('Initialize project structure (interactive if no architecture provided)')
  .argument('[architecture]', 'Architecture type: fsd | modular (optional — prompts if omitted)')
  .action((architecture?: string) => {
    if (architecture !== undefined && !['fsd', 'modular'].includes(architecture)) {
      console.error(`error: architecture must be "fsd" or "modular", got "${architecture}"`)
      process.exit(1)
    }
    initCommand(architecture as Architecture | undefined)
  })

// ---------------------------------------------------------------------------
// generate
// ---------------------------------------------------------------------------

const SLICE_TYPES: SliceType[] = ['feature', 'entity', 'widget', 'page', 'component', 'module']

program
  .command('generate')
  .alias('g')
  .description('Generate a slice or component')
  .argument('<type>', `Slice type (${SLICE_TYPES.join(' | ')})`, (value) => {
    if (!SLICE_TYPES.includes(value as SliceType)) {
      throw new Error(`Type must be one of: ${SLICE_TYPES.join(', ')}`)
    }
    return value as SliceType
  })
  .argument(
    '<name>',
    'Slice name — supports nested paths (e.g. auth/LoginForm) to place the slice inside a subfolder',
  )
  .option('--dry-run', 'Preview files that would be generated without writing them')
  .addHelpText(
    'after',
    `
Slice types and their generated structure:
  feature    Full vertical slice → ui/<Name>.tsx  model/index.ts  api/index.ts  index.ts
  entity     Data-layer slice    → model/index.ts  api/index.ts  index.ts
  widget     Composite UI block  → ui/<Name>.tsx  model/index.ts  index.ts
  page       Route-level shell   → ui/<Name>Page.tsx  index.ts
  component  Pure UI atom        → <Name>.tsx  index.ts
  module     Vertical module     → ui/<Name>.tsx  model/index.ts  api/index.ts  index.ts

Nested paths:
  The <name> argument supports "/" separators to nest the slice inside a subdirectory.
  The basename is used for the component name in generated files.

Examples:
  $ component-forge g feature auth
      Creates: src/features/auth/

  $ component-forge g feature auth/LoginForm
      Creates: src/features/auth/LoginForm/   (component name: LoginForm)

  $ component-forge g entity user/profile/Address
      Creates: src/entities/user/profile/Address/   (component name: Address)

  $ component-forge g component Button --dry-run
      Preview: src/shared/ui/Button/
`,
  )
  .action((type: SliceType, name: string, options: { dryRun?: boolean }) => {
    generateCommand(type, name, { dryRun: options.dryRun })
  })

// ---------------------------------------------------------------------------
// list
// ---------------------------------------------------------------------------

program
  .command('list')
  .alias('ls')
  .description('List all existing slices in the project, grouped by layer')
  .addHelpText(
    'after',
    `
  Scans srcDir and prints every slice for each architectural layer.
  A green checkmark means index.ts is present (public API exists).
  A yellow ! means the slice is missing its public API index.ts.

  Examples:
    $ component-forge list
    $ component-forge ls
`,
  )
  .action(() => {
    listCommand()
  })

// ---------------------------------------------------------------------------
// graph
// ---------------------------------------------------------------------------

program
  .command('graph')
  .description('Generate a dependency graph of your architecture slices')
  .option('--exclude-shared', 'Exclude the "shared" layer from the graph')
  .option('--out <path>', 'Write the Mermaid diagram to a file (e.g. graph.mmd)')
  .addHelpText(
    'after',
    `
  Automatically parses all imports in your application and builds a Mermaid.js
  dependency graph showing how your slices interact with each other.

  Examples:
    $ component-forge graph
    $ component-forge graph --exclude-shared
    $ component-forge graph --out architecture.mmd
`,
  )
  .action((options: { excludeShared?: boolean; out?: string }) => {
    graphCommand({ excludeShared: options.excludeShared, out: options.out })
  })

// ---------------------------------------------------------------------------
// stats
// ---------------------------------------------------------------------------

program
  .command('stats')
  .description('Analyze project and show statistics about layers, slices, and files')
  .addHelpText(
    'after',
    `
  Scans your source directory and prints metrics detailing the size and distribution
  of your architecture.

  Examples:
    $ component-forge stats
`,
  )
  .action(() => {
    statsCommand()
  })

// ---------------------------------------------------------------------------
// docs
// ---------------------------------------------------------------------------

program
  .command('docs')
  .description('Generate an ARCHITECTURE.md file describing the project structure and graph')
  .option('--out <path>', 'Write the markdown to a specific file path (default: ARCHITECTURE.md)')
  .addHelpText(
    'after',
    `
  Scans your project and generates a comprehensive Markdown documentation file.
  Includes statistics, a list of all your layers/slices, and a Mermaid.js
  dependency graph.

  Examples:
    $ component-forge docs
    $ component-forge docs --out docs/ARCHITECTURE.md
`,
  )
  .action((options: { out?: string }) => {
    docsCommand({ out: options.out })
  })

// ---------------------------------------------------------------------------
// orphans
// ---------------------------------------------------------------------------

program
  .command('orphans')
  .description('Find slices that are never imported anywhere (dead code)')
  .addHelpText(
    'after',
    `
  Scans all files and finds slices (features, entities, widgets, etc.) that
  are never imported by any other slice or the app/core layers.

  Useful for identifying abandoned code or forgotten slices during refactoring.

  Examples:
    $ component-forge orphans
`,
  )
  .action(() => {
    orphansCommand()
  })

// ---------------------------------------------------------------------------
// validate
// ---------------------------------------------------------------------------

program
  .command('validate')
  .description('Validate project structure against the configured architecture')
  .option('--fix', 'Automatically create missing public API index.ts barrel files')
  .addHelpText(
    'after',
    `
  Checks required layers, unknown layers, public API files, empty barrels,
  and unknown shared/ segments.

  Options:
    --fix   Create a minimal index.ts stub for every slice that is missing one

  Examples:
    $ component-forge validate
    $ component-forge validate --fix
`,
  )
  .action((options: { fix?: boolean }) => {
    validateCommand({ fix: options.fix })
  })

// ---------------------------------------------------------------------------
// check
// ---------------------------------------------------------------------------

program
  .command('check')
  .description('Check that imports do not violate architecture layer boundaries')
  .option('-w, --watch', 'watch for file changes and re-run checks')
  .option('-f, --fix', 'attempt to automatically fix architecture violations')
  .option('--report <path>', 'write a JSON report to the specified file path')
  .option('--junit <path>', 'write a JUnit XML report to the specified file path')
  .option(
    '--ignore <patterns...>',
    'glob patterns of files or directories to ignore (e.g. "**/*.test.ts")',
  )
  .option('--ci', 'emit GitHub Actions ::error annotations instead of styled output')
  .addHelpText(
    'after',
    `
  Each violation is printed with a targeted "→ Fix:" hint.
  Exits with code 1 when violations are found (useful in CI pipelines).

  Options:
    --watch         Watch source files and re-run on every change (great during development)
    --fix           Rewrite violating imports automatically (redirects them to shared/<slice>)
    --report <path> Write a machine-readable JSON report to the given path (e.g. report.json)
    --junit <path>  Write a JUnit XML report to the specified file path
    --ignore <glob> Ignore files matching the glob pattern (can be used multiple times)
    --ci            Emit GitHub Actions ::error annotations (use in .github/workflows/)

  Examples:
    $ component-forge check
    $ component-forge check --watch
    $ component-forge check --ignore "**/*.test.ts" --ignore "legacy/**"
    $ component-forge check --report report.json --junit junit.xml
`,
  )
  .action(
    (options: {
      watch?: boolean
      fix?: boolean
      report?: string
      junit?: string
      ignore?: string[]
      ci?: boolean
    }) => {
      checkCommand({
        watch: options.watch,
        fix: options.fix,
        report: options.report,
        junit: options.junit,
        ignore: options.ignore,
        ci: options.ci,
      })
    },
  )

// ---------------------------------------------------------------------------
// cycles
// ---------------------------------------------------------------------------

program
  .command('cycles')
  .description('Find circular dependencies between slices')
  .addHelpText(
    'after',
    `
  Scans your project and detects circular imports on the scale of entire slices.
  e.g. A circular dependency like:
    features/auth -> entities/user -> features/auth
    
  Returns a non-zero exit code if any circular dependencies are found.
  Perfect for strictly checking architecture graphs in CI pipelines.

  Examples:
    $ component-forge cycles
`,
  )
  .action(() => {
    cyclesCommand()
  })

// ---------------------------------------------------------------------------
// analyze
// ---------------------------------------------------------------------------

program
  .command('analyze')
  .description('Run a complete architectural health analysis')
  .addHelpText(
    'after',
    `
  Runs all major diagnostic tools (check, validate, cycles, orphans, stats)
  in one single omnibus command and prints a summary dashboard.

  Examples:
    $ component-forge analyze
`,
  )
  .action(() => {
    analyzeCommand()
  })

program.addCommand(readmeCommand)

// ---------------------------------------------------------------------------
// migrate
// ---------------------------------------------------------------------------

program
  .command('migrate')
  .description('Analyse current project structure and propose a migration plan')
  .requiredOption('--to <architecture>', 'Target architecture: fsd | modular')
  .addHelpText(
    'after',
    `
  Scans your source directory and prints a step-by-step migration plan.
  No files are moved — this is a dry-run analysis only.

  Examples:
    $ component-forge migrate --to fsd
    $ component-forge migrate --to modular
`,
  )
  .option('--execute', 'Apply the migration — actually move the files', false)
  .option('--backup', 'Create a backup before moving (requires --execute)', false)
  .action((options: { to: string; execute: boolean; backup: boolean }) => {
    if (!['fsd', 'modular'].includes(options.to)) {
      console.error(`error: --to must be "fsd" or "modular", got "${options.to}"`)
      process.exit(1)
    }
    migrateCommand(options.to as Architecture, {
      execute: options.execute,
      backup: options.backup,
    })
  })

// ---------------------------------------------------------------------------
// explain
// ---------------------------------------------------------------------------

program
  .command('explain')
  .description('Print architecture documentation in the terminal')
  .argument('<topic>', `Topic to explain: ${AVAILABLE_TOPICS.join(' | ')}`)
  .addHelpText(
    'after',
    `
  Available topics: fsd, modular, layers, slices, segments

  Examples:
    $ component-forge explain fsd
    $ component-forge explain layers
    $ component-forge explain slices
`,
  )
  .action((topic: string) => {
    explainCommand(topic)
  })

// ---------------------------------------------------------------------------
// info
// ---------------------------------------------------------------------------

program
  .command('info')
  .description('Analyze a specific slice and list its dependencies and dependents')
  .argument('<target>', 'The target slice to analyze (e.g. features/auth or shared)')
  .addHelpText(
    'after',
    `
  Scans your project to find every file that imports the target slice (dependents)
  and every slice that the target slice imports (dependencies).

  Examples:
    $ component-forge info features/auth
    $ component-forge info shared
    $ component-forge info entities/user
`,
  )
  .action((target: string) => {
    infoCommand(target)
  })

// ---------------------------------------------------------------------------
// move
// ---------------------------------------------------------------------------

program
  .command('move')
  .description('Move a slice to a new location and update all references to it')
  .argument('<source>', 'The slice to move (e.g. features/auth)')
  .argument('<target>', 'The new location for the slice (e.g. widgets/auth-form)')
  .option('--dry-run', 'Preview changes without modifying files')
  .addHelpText(
    'after',
    `
  Moves the directory and automatically rewrites all absolute and relative imports
  across your entire project pointing to this slice.

  Examples:
    $ component-forge move features/auth widgets/auth-form
    $ component-forge move entities/post features/post --dry-run
`,
  )
  .action((source: string, target: string, options: { dryRun?: boolean }) => {
    moveCommand(source, target, { dryRun: options.dryRun })
  })

// ---------------------------------------------------------------------------
// remove
// ---------------------------------------------------------------------------

program
  .command('remove')
  .alias('rm')
  .description('Safely remove a slice if it has no dependents')
  .argument('<target>', 'The slice to remove (e.g. features/auth)')
  .option('-f, --force', 'Force removal even if the slice is imported elsewhere')
  .addHelpText(
    'after',
    `
  Safely deletes a slice (folder) from your project. It will first analyze the
  architecture graph to ensure no other slices depend on it. If there are dependents,
  it will list them and abort to prevent broken imports.

  Examples:
    $ component-forge rm features/auth
    $ component-forge rm entities/user --force
`,
  )
  .action((target: string, options: { force?: boolean }) => {
    removeCommand(target, { force: options.force })
  })

program.parse(process.argv)
