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
        hint: buildHint('modular-forbidden', fileLayer, targetLayer),
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
