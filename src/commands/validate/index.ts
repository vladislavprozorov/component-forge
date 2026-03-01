import path from 'node:path'

import fs from 'fs-extra'

import type { Architecture } from '../../types/folder-tree'
import { loadProjectConfig } from '../../utils/config'
import { logger } from '../../utils/logger'

// ---------------------------------------------------------------------------
// Layer rules per architecture
// ---------------------------------------------------------------------------

interface LayerRule {
  /** Directories that MUST exist */
  required: string[]
  /** All allowed directories (required + optional) */
  allowed: string[]
}

const layerRulesByArchitecture: Record<Architecture, LayerRule> = {
  fsd: {
    required: ['app', 'shared'],
    allowed: ['app', 'processes', 'pages', 'widgets', 'features', 'entities', 'shared'],
  },
  modular: {
    required: ['shared', 'core'],
    allowed: ['modules', 'shared', 'core'],
  },
}

// ---------------------------------------------------------------------------
// Validation result types
// ---------------------------------------------------------------------------

type Severity = 'error' | 'warning'

export interface ValidationIssue {
  severity: Severity
  message: string
}

// ---------------------------------------------------------------------------
// Validation rules — exported for unit testing
// ---------------------------------------------------------------------------

/**
 * Checks that all required layers exist under srcDir
 */
export function checkRequiredLayers(
  srcPath: string,
  rule: LayerRule,
  srcDir: string,
): ValidationIssue[] {
  return rule.required
    .filter((layer) => !fs.existsSync(path.join(srcPath, layer)))
    .map((layer) => ({
      severity: 'error' as const,
      message: `Missing required layer: ${srcDir}/${layer}`,
    }))
}

/**
 * Checks that no unknown (forbidden) directories exist directly under srcDir
 */
export function checkUnknownLayers(
  srcPath: string,
  rule: LayerRule,
  architecture: Architecture,
  srcDir: string,
): ValidationIssue[] {
  if (!fs.existsSync(srcPath)) return []

  return fs
    .readdirSync(srcPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => !rule.allowed.includes(entry.name))
    .map((entry) => ({
      severity: 'warning' as const,
      message: `"${srcDir}/${entry.name}" is not a recognised layer in ${architecture.toUpperCase()} architecture`,
    }))
}

/**
 * Checks each slice for a public API index.ts file
 */
export function checkPublicApiFiles(
  srcPath: string,
  rule: LayerRule,
  srcDir: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  const sliceLayers = rule.allowed.filter(
    (l) => l !== 'app' && l !== 'shared' && l !== 'core',
  )

  for (const layer of sliceLayers) {
    const layerPath = path.join(srcPath, layer)
    if (!fs.existsSync(layerPath)) continue

    const slices = fs
      .readdirSync(layerPath, { withFileTypes: true })
      .filter((e) => e.isDirectory())

    for (const slice of slices) {
      const indexPath = path.join(layerPath, slice.name, 'index.ts')
      if (!fs.existsSync(indexPath)) {
        issues.push({
          severity: 'warning',
          message: `Missing public API: ${srcDir}/${layer}/${slice.name}/index.ts`,
        })
      }
    }
  }

  return issues
}

// ---------------------------------------------------------------------------
// Output formatting
// ---------------------------------------------------------------------------

function printIssues(issues: ValidationIssue[]): void {
  const errors = issues.filter((i) => i.severity === 'error')
  const warnings = issues.filter((i) => i.severity === 'warning')

  // Print errors first — they are blocking
  for (const issue of errors) {
    logger.error(issue.message)
  }
  for (const issue of warnings) {
    logger.warning(issue.message)
  }

  const parts: string[] = []
  if (errors.length > 0) parts.push(`${errors.length} error(s)`)
  if (warnings.length > 0) parts.push(`${warnings.length} warning(s)`)
  logger.info(`Found ${parts.join(', ')}.`)
}

// ---------------------------------------------------------------------------
// Command entry point
// ---------------------------------------------------------------------------

export function validateCommand(): void {
  const config = loadProjectConfig()
  const { architecture, srcDir } = config
  const srcPath = path.join(process.cwd(), srcDir)
  const rule = layerRulesByArchitecture[architecture]

  logger.info(`Validating ${architecture.toUpperCase()} architecture…`)

  const issues: ValidationIssue[] = [
    ...checkRequiredLayers(srcPath, rule, srcDir),
    ...checkUnknownLayers(srcPath, rule, architecture, srcDir),
    ...checkPublicApiFiles(srcPath, rule, srcDir),
  ]

  if (issues.length === 0) {
    logger.success('Architecture is valid. No issues found.')
    return
  }

  printIssues(issues)

  const hasErrors = issues.some((i) => i.severity === 'error')
  if (hasErrors) {
    process.exit(1)
  }
}
