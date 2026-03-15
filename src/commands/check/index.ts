import fs from 'node:fs'
import path from 'node:path'

import chalk from 'chalk'
import picomatch from 'picomatch'

import type { Architecture } from '../../types/folder-tree'
import { loadProjectConfig } from '../../utils/config'
import { logger } from '../../utils/logger'

import { fixAll } from './fixer'
import { watchCheck } from './watcher'

// ---------------------------------------------------------------------------
// Path-alias resolution
// ---------------------------------------------------------------------------

/**
 * A resolved alias entry: given an import that starts with `prefix`,
 * strip it and prepend `target` (relative path from srcDir root).
 *
 * e.g. { prefix: '@/', target: '' } maps  @/features/auth → features/auth
 *      { prefix: '~/src/', target: '' } maps  ~/src/shared/ui → shared/ui
 *      { prefix: '@shared/', target: 'shared/' } maps @shared/ui → shared/ui
 */
export interface AliasEntry {
  prefix: string
  /** Replacement for the prefix. Empty string means "drop the prefix". */
  target: string
}

/**
 * Reads `tsconfig.json` (or `tsconfig.*.json`) from `projectRoot` and extracts
 * path aliases as a flat list of AliasEntry objects.
 *
 * Also adds two common hard-coded conventions (@/ → srcDir, ~/src/ → srcDir)
 * that are widely used even without explicit tsconfig paths.
 *
 * @param projectRoot  absolute path to the project root
 * @param srcDir       value from forge.config (e.g. "src")
 */
export function loadAliasEntries(projectRoot: string, srcDir: string): AliasEntry[] {
  const entries: AliasEntry[] = []

  // --- Parse tsconfig.json paths / baseUrl ---
  const tsconfigPath = path.join(projectRoot, 'tsconfig.json')
  if (fs.existsSync(tsconfigPath)) {
    try {
      const raw = fs.readFileSync(tsconfigPath, 'utf8')
      // Strip single-line // comments before parsing (tsconfig is JSONC)
      const cleaned = raw.replace(/\/\/[^\n]*/g, '')
      const tsconfig = JSON.parse(cleaned) as {
        compilerOptions?: {
          baseUrl?: string
          paths?: Record<string, string[]>
        }
      }
      const opts = tsconfig.compilerOptions ?? {}
      const pathsMap = opts.paths ?? {}

      for (const [alias, targets] of Object.entries(pathsMap)) {
        if (targets.length === 0) continue
        // targets[0] is e.g. "src/*" or "./src/*"
        const rawTarget = targets[0].replace(/\*$/, '').replace(/^\.\//, '')
        // Strip the leading srcDir prefix so target is relative to srcDir root
        const targetRel = rawTarget.startsWith(srcDir + '/')
          ? rawTarget.slice(srcDir.length + 1)
          : rawTarget

        // alias is e.g. "@/*" or "@features/*"
        const prefix = alias.replace(/\*$/, '')
        entries.push({ prefix, target: targetRel })
      }
    } catch {
      // Malformed tsconfig — skip alias resolution from tsconfig
    }
  }

  // --- Hard-coded widely-used conventions ---
  // Only add if not already covered by tsconfig entries
  const covered = new Set(entries.map((e) => e.prefix))

  const conventions: AliasEntry[] = [
    { prefix: `@/`, target: '' },
    { prefix: `~/src/`, target: '' },
    { prefix: `~src/`, target: '' },
    { prefix: `~/${srcDir}/`, target: '' },
  ]

  for (const c of conventions) {
    if (!covered.has(c.prefix)) {
      entries.push(c)
    }
  }

  return entries
}

/**
 * If `importPath` matches a known alias, returns the equivalent path
 * relative to srcDir (e.g. "features/auth/index"). Otherwise returns null.
 */
export function resolveAliasedImport(
  importPath: string,
  aliases: AliasEntry[],
): string | null {
  for (const { prefix, target } of aliases) {
    if (importPath.startsWith(prefix)) {
      return target + importPath.slice(prefix.length)
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// FSD layer hierarchy — higher index = higher layer
// A layer may only import from layers with a LOWER index.
// ---------------------------------------------------------------------------

const FSD_LAYER_ORDER: string[] = [
  'shared',
  'entities',
  'features',
  'widgets',
  'pages',
  'processes',
  'app',
]

// For modular architecture — no strict hierarchy between modules,
// but modules must not import from app-level dirs and shared cannot
// import from modules.
const MODULAR_FORBIDDEN: Record<string, string[]> = {
  shared: ['modules', 'core'],
  core: ['modules'],
}

// ---------------------------------------------------------------------------
// Hint engine
// ---------------------------------------------------------------------------

/**
 * Classifies a FSD violation into one of three kinds:
 *   - "same-layer"   — both files live in the same FSD layer
 *   - "higher-layer" — file imports from a layer that sits ABOVE it
 *   - "modular"      — modular-arch forbidden dependency
 */
export type ViolationKind = 'fsd-same-layer' | 'fsd-higher-layer' | 'modular-forbidden'

/**
 * Per-pair advice table for FSD violations.
 *
 * Key format: "<fromLayer>-><toLayer>"
 * Falls back to generic advice when a specific pair is not listed.
 */
const FSD_PAIR_HINTS: Record<string, string> = {
  // Same-layer cross-imports
  'features->features':
    'Extract the shared logic into shared/ (e.g. shared/lib or shared/api) ' +
    'or lift it into a widget that composes both features.',
  'entities->entities':
    'Move the shared data type or helper to shared/. ' +
    'Entities must remain independent of each other.',
  'widgets->widgets':
    'Extract the common UI piece into shared/ui or compose them inside a page instead.',
  'pages->pages':
    'Pages should not depend on each other. ' +
    'Move the shared UI to widgets/ or shared/ui.',

  // Higher-layer imports (lower importing from higher)
  'shared->entities':
    'shared/ is the foundation — it must not know about entities. ' +
    'Move the type/helper to shared/ itself, or invert the dependency.',
  'shared->features':
    'shared/ must not import from features/. ' +
    'Extract only the primitive/generic part into shared/.',
  'shared->widgets':
    'shared/ must not import from widgets/. ' +
    'The component should live in shared/ui or be passed as a prop.',
  'shared->pages':
    'shared/ must not import from pages/. ' +
    'Anything shared across pages belongs in shared/ or widgets/.',
  'entities->features':
    'Entities must not depend on features. ' +
    'If you need a callback/handler, pass it as a prop or use an event bus.',
  'entities->widgets':
    'Entities must not depend on widgets. ' +
    'Lift the dependency inversion: pass the widget as a ReactNode prop.',
  'entities->pages':
    'Entities must not depend on pages. ' +
    'Pages are composed at the top — entities should never reference them.',
  'features->widgets':
    'Features must not import from widgets. ' +
    'A widget composes features, not the other way around.',
  'features->pages':
    'Features must not import from pages. ' +
    'Consider moving the shared piece down to shared/ or entities/.',
  'widgets->pages':
    'Widgets must not import from pages. ' +
    'Pages are the top-level composers — extract the shared part into widgets/ itself.',
}

/**
 * Returns a concise, actionable hint for a given violation.
 * Exported for unit testing.
 */
export function buildHint(
  kind: ViolationKind,
  fromLayer: string,
  toLayer: string,
): string {
  if (kind === 'modular-forbidden') {
    if (fromLayer === 'shared') {
      return (
        'shared/ is infrastructure — it must not import from modules/. ' +
        'Move the dependency into the module itself or create a shared abstraction.'
      )
    }
    if (fromLayer === 'core') {
      return (
        'core/ sets up the application shell and must not depend on feature modules. ' +
        'Use dependency injection or an event bus to decouple them.'
      )
    }
    return (
      `"${fromLayer}" must not import from "${toLayer}" in modular architecture. ` +
      'Consider inverting the dependency or extracting shared logic into shared/.'
    )
  }

  const key = `${fromLayer}->${toLayer}`
  if (FSD_PAIR_HINTS[key]) return FSD_PAIR_HINTS[key]

  // Generic fallback
  if (kind === 'fsd-same-layer') {
    return (
      `Two slices inside "${fromLayer}" must not import from each other. ` +
      'Extract shared logic to shared/ or compose them in a higher layer.'
    )
  }

  // fsd-higher-layer fallback
  return (
    `"${fromLayer}" sits below "${toLayer}" in the FSD hierarchy and must not import from it. ` +
    'Move the shared code down to a layer that both can depend on (e.g. shared/ or entities/).'
  )
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CheckViolation {
  file: string
  importPath: string
  /** Human-readable description of what rule was broken. */
  message: string
  /** Concrete suggestion on how to fix the violation. */
  hint: string
}

export interface CheckResult {
  violations: CheckViolation[]
  checkedFiles: number
}

// ---------------------------------------------------------------------------
// Import parsing — extracts all static import paths from a TS/TSX file
// ---------------------------------------------------------------------------

const IMPORT_RE = /^\s*(?:import|export)\s+(?:[^'"]*\s+from\s+)?['"]([^'"]+)['"]/gm

export function parseImports(source: string): string[] {
  const imports: string[] = []
  let match: RegExpExecArray | null
  const re = new RegExp(IMPORT_RE.source, IMPORT_RE.flags)
  while ((match = re.exec(source)) !== null) {
    imports.push(match[1])
  }
  return imports
}

// ---------------------------------------------------------------------------
// Layer resolution — given a file path relative to srcDir, returns its layer
// ---------------------------------------------------------------------------

export function resolveLayer(relPath: string): string | null {
  // relPath looks like "features/auth/index.ts" or "shared/ui/Button.ts"
  const parts = relPath.split(path.sep)
  return parts[0] ?? null
}

// ---------------------------------------------------------------------------
// FSD violation check
// ---------------------------------------------------------------------------

function checkFsdViolations(
  srcPath: string,
  relFilePath: string,
  imports: string[],
  aliases: AliasEntry[],
): CheckViolation[] {
  const violations: CheckViolation[] = []
  const fileLayer = resolveLayer(relFilePath)
  if (!fileLayer) return violations

  const fileLayerIdx = FSD_LAYER_ORDER.indexOf(fileLayer)
  if (fileLayerIdx === -1) return violations // unknown layer — skip

  for (const imp of imports) {
    let targetLayer: string | null = null

    if (imp.startsWith('.')) {
      // Relative import — resolve via filesystem
      const fileDir = path.dirname(path.join(srcPath, relFilePath))
      const resolved = path.resolve(fileDir, imp)
      const relResolved = path.relative(srcPath, resolved)
      targetLayer = resolveLayer(relResolved)
    } else {
      // Non-relative import — try alias resolution
      const aliasResolved = resolveAliasedImport(imp, aliases)
      if (aliasResolved !== null) {
        targetLayer = resolveLayer(aliasResolved)
      }
    }

    if (!targetLayer) continue

    const targetLayerIdx = FSD_LAYER_ORDER.indexOf(targetLayer)
    if (targetLayerIdx === -1) continue // unknown target layer

    // Violation: importing from the same layer OR a higher layer
    if (targetLayerIdx >= fileLayerIdx) {
      const kind: ViolationKind =
        targetLayerIdx === fileLayerIdx ? 'fsd-same-layer' : 'fsd-higher-layer'
      violations.push({
        file: relFilePath,
        importPath: imp,
        message:
          `Layer "${fileLayer}" must not import from "${targetLayer}" ` +
          `(${targetLayer} is at the same level or higher in FSD hierarchy)`,
        hint: buildHint(kind, fileLayer, targetLayer),
      })
    }
  }

  return violations
}

// ---------------------------------------------------------------------------
// Modular violation check
// ---------------------------------------------------------------------------

function checkModularViolations(
  srcPath: string,
  relFilePath: string,
  imports: string[],
  aliases: AliasEntry[],
): CheckViolation[] {
  const violations: CheckViolation[] = []
  const fileLayer = resolveLayer(relFilePath)
  if (!fileLayer) return violations

  const forbidden = MODULAR_FORBIDDEN[fileLayer]
  if (!forbidden) return violations

  for (const imp of imports) {
    let targetLayer: string | null = null

    if (imp.startsWith('.')) {
      // Relative import
      const fileDir = path.dirname(path.join(srcPath, relFilePath))
      const resolved = path.resolve(fileDir, imp)
      const relResolved = path.relative(srcPath, resolved)
      targetLayer = resolveLayer(relResolved)
    } else {
      // Non-relative import — try alias resolution
      const aliasResolved = resolveAliasedImport(imp, aliases)
      if (aliasResolved !== null) {
        targetLayer = resolveLayer(aliasResolved)
      }
    }

    if (!targetLayer) continue

    if (forbidden.includes(targetLayer)) {
      violations.push({
        file: relFilePath,
        importPath: imp,
        message: `Layer "${fileLayer}" must not import from "${targetLayer}" in modular architecture`,
        hint: buildHint('modular-forbidden', fileLayer, targetLayer),
      })
    }
  }

  return violations
}

// ---------------------------------------------------------------------------
// File collector — recursively finds .ts / .tsx files under srcPath
// ---------------------------------------------------------------------------

export function collectSourceFiles(
  dir: string,
  base: string = dir,
  ignoreMatcher?: (path: string) => boolean,
): string[] {
  const results: string[] = []
  if (!fs.existsSync(dir)) return results

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    const relPath = path.relative(base, full)
    
    // Convert to forward slashes for cross-platform matching
    const posixPath = relPath.split(path.sep).join('/')
    
    if (ignoreMatcher && ignoreMatcher(posixPath)) {
      continue
    }

    if (entry.isDirectory()) {
      results.push(...collectSourceFiles(full, base, ignoreMatcher))
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.test.ts')) {
      results.push(relPath)
    }
  }
  return results
}

// ---------------------------------------------------------------------------
// Core check logic — exported for testing
// ---------------------------------------------------------------------------

export function runCheck(
  srcPath: string,
  architecture: Architecture,
  aliases: AliasEntry[] = [],
  ignorePatterns: string[] = [],
): CheckResult {
  const isIgnored = ignorePatterns.length > 0 ? picomatch(ignorePatterns) : undefined
  const files = collectSourceFiles(srcPath, srcPath, isIgnored)
  const violations: CheckViolation[] = []

  for (const relFile of files) {
    const fullPath = path.join(srcPath, relFile)
    const source = fs.readFileSync(fullPath, 'utf8')
    const imports = parseImports(source)

    if (architecture === 'fsd') {
      violations.push(...checkFsdViolations(srcPath, relFile, imports, aliases))
    } else {
      violations.push(...checkModularViolations(srcPath, relFile, imports, aliases))
    }
  }

  return { violations, checkedFiles: files.length }
}

// ---------------------------------------------------------------------------
// Command entry point
// ---------------------------------------------------------------------------

export interface CheckOptions {
  watch?: boolean
  fix?: boolean
  /** If provided, write a JSON report to this file path instead of (or alongside) console output. */
  report?: string
  /** If provided, write a JUnit XML report to this file path. */
  junit?: string
  /** Patterns to ignore during checking (e.g. glob patterns) */
  ignore?: string[]
  /**
   * When true, emit GitHub Actions workflow commands instead of styled console output.
   * Each violation becomes an `::error` annotation visible in the PR diff.
   *
   * Safe to use outside GitHub Actions — the commands are just plain-text lines.
   */
  ci?: boolean
}

// ---------------------------------------------------------------------------
// CI annotations (GitHub Actions workflow commands)
// ---------------------------------------------------------------------------

/**
 * Escapes special characters in a GitHub Actions workflow command value.
 * GitHub requires %, \r, and \n to be percent-encoded.
 *
 * @see https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions
 */
export function escapeCiValue(value: string): string {
  return value
    .replace(/%/g, '%25')
    .replace(/\r/g, '%0D')
    .replace(/\n/g, '%0A')
    .replace(/:/g, '%3A')
    .replace(/,/g, '%2C')
}

/**
 * Converts a list of CheckViolations into GitHub Actions `::error` annotation
 * strings. Each line is ready to be written directly to stdout inside a
 * GitHub Actions runner.
 *
 * Format:
 *   ::error file=<file>,line=1,title=<title>::<message> — <hint>
 */
export function formatCiAnnotations(violations: CheckViolation[]): string[] {
  return violations.map((v) => {
    const file = escapeCiValue(v.file)
    const title = escapeCiValue('Architecture violation')
    const body = escapeCiValue(`${v.message} — ${v.hint}`)
    return `::error file=${file},line=1,title=${title}::${body}`
  })
}

/**
 * Prints CI annotations to stdout and writes a summary line to stderr
 * (GitHub Actions renders stderr as plain log text, annotations come from stdout).
 */
export function printCiAnnotations(violations: CheckViolation[], checkedFiles: number): void {
  for (const line of formatCiAnnotations(violations)) {
    console.log(line)
  }

  if (violations.length > 0) {
    console.error(
      `\ncomponent-forge: ${violations.length} architecture violation(s) in ${checkedFiles} file(s).`,
    )
  }
}

// ---------------------------------------------------------------------------
// JSON report
// ---------------------------------------------------------------------------

export interface JsonViolation {
  file: string
  importPath: string
  message: string
  hint: string
}

export interface JsonReport {
  /** ISO-8601 timestamp of when the check was run */
  timestamp: string
  architecture: Architecture
  checkedFiles: number
  violations: JsonViolation[]
  summary: {
    total: number
    byFile: Record<string, number>
  }
}

/**
 * Serialises a CheckResult to a structured JSON file.
 *
 * The report can be consumed by CI tools, dashboards, or custom scripts.
 * Path is resolved relative to process.cwd() when not absolute.
 */
export function writeJsonReport(
  result: CheckResult,
  outputPath: string,
  architecture: Architecture,
): void {
  const byFile: Record<string, number> = {}
  for (const v of result.violations) {
    byFile[v.file] = (byFile[v.file] ?? 0) + 1
  }

  const report: JsonReport = {
    timestamp: new Date().toISOString(),
    architecture,
    checkedFiles: result.checkedFiles,
    violations: result.violations.map((v) => ({
      file: v.file,
      importPath: v.importPath,
      message: v.message,
      hint: v.hint,
    })),
    summary: {
      total: result.violations.length,
      byFile,
    },
  }

  const resolved = path.isAbsolute(outputPath)
    ? outputPath
    : path.resolve(process.cwd(), outputPath)

  fs.mkdirSync(path.dirname(resolved), { recursive: true })
  fs.writeFileSync(resolved, JSON.stringify(report, null, 2) + '\n', 'utf8')
}

// ---------------------------------------------------------------------------
// JUnit XML report
// ---------------------------------------------------------------------------

/**
 * Serialises a CheckResult to a JUnit XML file.
 * Path is resolved relative to process.cwd() when not absolute.
 */
export function writeJunitReport(
  result: CheckResult,
  outputPath: string,
  architecture: Architecture,
): void {
  const byFile: Record<string, CheckViolation[]> = {}
  for (const v of result.violations) {
    if (!byFile[v.file]) byFile[v.file] = []
    byFile[v.file].push(v)
  }

  const failuresCount = result.violations.length
  const testsCount = result.checkedFiles || 1 // Avoid 0 tests in report
  const time = new Date().toISOString()
  const escapeXml = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`
  xml += `<testsuites name="component-forge validation" tests="${testsCount}" failures="${failuresCount}" errors="0" time="0.000">\n`
  xml += `  <testsuite name="Architecture Check (${architecture})" tests="${testsCount}" failures="${failuresCount}" errors="0" timestamp="${time}">\n`

  if (failuresCount === 0) {
    // If no violations, add a dummy passing testcase so the report doesn't look empty
    xml += `    <testcase name="All architecture boundaries are valid" time="0.000" />\n`
  } else {
    for (const [file, fileViolations] of Object.entries(byFile)) {
      for (const v of fileViolations) {
        xml += `    <testcase name="${escapeXml(file)}: import ${escapeXml(
          v.importPath,
        )}" classname="${escapeXml(file)}" time="0.000">\n`
        xml += `      <failure message="${escapeXml(v.message)}">\n`
        xml += `        Import: ${escapeXml(v.importPath)}\n`
        xml += `        Rule broken: ${escapeXml(v.message)}\n`
        xml += `        Hint: ${escapeXml(v.hint)}\n`
        xml += `      </failure>\n`
        xml += `    </testcase>\n`
      }
    }
  }

  xml += `  </testsuite>\n`
  xml += `</testsuites>\n`

  const resolved = path.isAbsolute(outputPath)
    ? outputPath
    : path.resolve(process.cwd(), outputPath)

  fs.mkdirSync(path.dirname(resolved), { recursive: true })
  fs.writeFileSync(resolved, xml, 'utf8')
}

export function checkCommand(options: CheckOptions = {}): void {
  const config = loadProjectConfig()
  const srcPath = path.join(process.cwd(), config.srcDir)
  const aliases = loadAliasEntries(process.cwd(), config.srcDir)
  const ignorePatterns = options.ignore || []

  if (options.watch) {
    watchCheck(srcPath, config.architecture, aliases, ignorePatterns)
    return
  }

  logger.info(`Checking architecture boundaries (${config.architecture})…\n`)

  const checkResult = runCheck(srcPath, config.architecture, aliases, ignorePatterns)
  const { violations, checkedFiles } = checkResult

  // --report: always write JSON regardless of whether violations exist
  if (options.report) {
    writeJsonReport(checkResult, options.report, config.architecture)
    logger.info(`Report written to ${options.report}`)
  }

  // --junit: write JUnit XML
  if (options.junit) {
    writeJunitReport(checkResult, options.junit, config.architecture)
    logger.info(`JUnit XML report written to ${options.junit}`)
  }

  if (violations.length === 0) {
    logger.success(`✓ No violations found in ${checkedFiles} file(s). Architecture looks clean!`)
    return
  }

  // --ci: emit GitHub Actions annotations instead of styled output
  if (options.ci) {
    printCiAnnotations(violations, checkedFiles)
    process.exit(1)
  }

  if (options.fix) {
    console.log(chalk.yellow(`⚙  Auto-fixing ${violations.length} violation(s) in ${checkedFiles} file(s)…\n`))

    const { fixedFiles, totalFixed } = fixAll(checkResult, srcPath, aliases)

    if (totalFixed === 0) {
      console.log(chalk.red('  No violations could be fixed automatically.\n'))
      console.log(chalk.gray('  Some violations require manual intervention (e.g. moving code to shared/).'))
    } else {
      for (const r of fixedFiles) {
        console.log(chalk.green(`  ✓ Fixed ${r.fixedCount} import(s) in ${r.file}`))
        for (const v of r.fixed) {
          console.log(chalk.gray(`    ${v.importPath} → shared/${v.importPath.split('/').pop() ?? ''}`))
        }
      }
      console.log()
      logger.success(`✓ Fixed ${totalFixed} import(s) across ${fixedFiles.length} file(s). Re-run check to verify.`)
    }

    // Remaining unfixed violations
    const fixedKeys = new Set(
      fixedFiles.flatMap((r) => r.fixed.map((v) => `${v.file}||${v.importPath}`)),
    )
    const remaining = violations.filter((v) => !fixedKeys.has(`${v.file}||${v.importPath}`))
    if (remaining.length > 0) {
      console.log(chalk.red(`\n  ${remaining.length} violation(s) still require manual fixes:\n`))
      for (const v of remaining) {
        console.log(chalk.bold(chalk.white(`  ${v.file}`)))
        console.log(chalk.gray(`    import "${v.importPath}"`))
        console.log(chalk.red(`    ✗ ${v.message}`))
        console.log(chalk.yellow(`    → Fix: ${v.hint}\n`))
      }
      process.exit(1)
    }
    return
  }

  console.log(chalk.red(`✖ Found ${violations.length} violation(s) in ${checkedFiles} file(s):\n`))

  for (const v of violations) {
    console.log(chalk.bold(chalk.white(`  ${v.file}`)))
    console.log(chalk.gray(`    import "${v.importPath}"`))
    console.log(chalk.red(`    ✗ ${v.message}`))
    console.log(chalk.yellow(`    → Fix: ${v.hint}\n`))
  }

  if (config.architecture === 'fsd') {
    console.log(
      chalk.gray(
        '  FSD order (low → high): shared → entities → features → widgets → pages → app\n',
      ),
    )
  }

  process.exit(1)
}
