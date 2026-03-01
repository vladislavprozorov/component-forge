import fs from 'node:fs'
import path from 'node:path'

import chalk from 'chalk'

import type { Architecture } from '../../types/folder-tree'
import { loadProjectConfig } from '../../utils/config'
import { logger } from '../../utils/logger'

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
// Types
// ---------------------------------------------------------------------------

export interface CheckViolation {
  file: string
  importPath: string
  message: string
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
): CheckViolation[] {
  const violations: CheckViolation[] = []
  const fileLayer = resolveLayer(relFilePath)
  if (!fileLayer) return violations

  const fileLayerIdx = FSD_LAYER_ORDER.indexOf(fileLayer)
  if (fileLayerIdx === -1) return violations // unknown layer — skip

  for (const imp of imports) {
    // Only check relative imports that could cross layer boundaries
    // e.g. "../../features/auth" — resolve to get the target layer
    if (!imp.startsWith('.')) continue

    const fileDir = path.dirname(path.join(srcPath, relFilePath))
    const resolved = path.resolve(fileDir, imp)
    const relResolved = path.relative(srcPath, resolved)

    const targetLayer = resolveLayer(relResolved)
    if (!targetLayer) continue

    const targetLayerIdx = FSD_LAYER_ORDER.indexOf(targetLayer)
    if (targetLayerIdx === -1) continue // unknown target layer

    // Violation: importing from the same layer OR a higher layer
    if (targetLayerIdx >= fileLayerIdx) {
      violations.push({
        file: relFilePath,
        importPath: imp,
        message:
          `Layer "${fileLayer}" must not import from "${targetLayer}" ` +
          `(${targetLayer} is at the same level or higher in FSD hierarchy)`,
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
): CheckViolation[] {
  const violations: CheckViolation[] = []
  const fileLayer = resolveLayer(relFilePath)
  if (!fileLayer) return violations

  const forbidden = MODULAR_FORBIDDEN[fileLayer]
  if (!forbidden) return violations

  for (const imp of imports) {
    if (!imp.startsWith('.')) continue

    const fileDir = path.dirname(path.join(srcPath, relFilePath))
    const resolved = path.resolve(fileDir, imp)
    const relResolved = path.relative(srcPath, resolved)

    const targetLayer = resolveLayer(relResolved)
    if (!targetLayer) continue

    if (forbidden.includes(targetLayer)) {
      violations.push({
        file: relFilePath,
        importPath: imp,
        message: `Layer "${fileLayer}" must not import from "${targetLayer}" in modular architecture`,
      })
    }
  }

  return violations
}

// ---------------------------------------------------------------------------
// File collector — recursively finds .ts / .tsx files under srcPath
// ---------------------------------------------------------------------------

export function collectSourceFiles(dir: string, base: string = dir): string[] {
  const results: string[] = []
  if (!fs.existsSync(dir)) return results

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...collectSourceFiles(full, base))
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.test.ts')) {
      results.push(path.relative(base, full))
    }
  }
  return results
}

// ---------------------------------------------------------------------------
// Core check logic — exported for testing
// ---------------------------------------------------------------------------

export function runCheck(srcPath: string, architecture: Architecture): CheckResult {
  const files = collectSourceFiles(srcPath)
  const violations: CheckViolation[] = []

  for (const relFile of files) {
    const fullPath = path.join(srcPath, relFile)
    const source = fs.readFileSync(fullPath, 'utf8')
    const imports = parseImports(source)

    if (architecture === 'fsd') {
      violations.push(...checkFsdViolations(srcPath, relFile, imports))
    } else {
      violations.push(...checkModularViolations(srcPath, relFile, imports))
    }
  }

  return { violations, checkedFiles: files.length }
}

// ---------------------------------------------------------------------------
// Command entry point
// ---------------------------------------------------------------------------

export function checkCommand(): void {
  const config = loadProjectConfig()
  const srcPath = path.join(process.cwd(), config.srcDir)

  logger.info(`Checking architecture boundaries (${config.architecture})…\n`)

  const { violations, checkedFiles } = runCheck(srcPath, config.architecture)

  if (violations.length === 0) {
    logger.success(`✓ No violations found in ${checkedFiles} file(s). Architecture looks clean!`)
    return
  }

  console.log(chalk.red(`✖ Found ${violations.length} violation(s) in ${checkedFiles} file(s):\n`))

  for (const v of violations) {
    console.log(chalk.bold(chalk.white(`  ${v.file}`)))
    console.log(chalk.gray(`    import "${v.importPath}"`))
    console.log(chalk.red(`    ${v.message}\n`))
  }

  logger.info(
    chalk.yellow('Tip: ') +
      'Each layer should only import from layers below it in the hierarchy.',
  )

  if (config.architecture === 'fsd') {
    logger.info(
      chalk.gray('  FSD order (low → high): shared → entities → features → widgets → pages → app'),
    )
  }

  process.exit(1)
}
