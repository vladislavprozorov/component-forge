import fs from 'fs-extra'
import path from 'node:path'

import { Architecture, ProjectConfig } from '../types/folder-tree'
import { logger } from '../utils/logger'
import { CONFIG_FILENAME } from './init'

// ---------------------------------------------------------------------------
// Expected layer rules per architecture
// ---------------------------------------------------------------------------

interface LayerRule {
  /** Required directories that MUST exist */
  required: string[]
  /** Directories that are allowed (required + optional) */
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

interface ValidationIssue {
  severity: Severity
  message: string
}

// ---------------------------------------------------------------------------
// Config loading
// ---------------------------------------------------------------------------

function loadProjectConfig(): ProjectConfig {
  const configPath = path.join(process.cwd(), CONFIG_FILENAME)

  if (!fs.existsSync(configPath)) {
    logger.error(`No ${CONFIG_FILENAME} found.`)
    logger.info('Run "component-forge init <architecture>" first.')
    process.exit(1)
  }

  return fs.readJsonSync(configPath) as ProjectConfig
}

// ---------------------------------------------------------------------------
// Validation rules
// ---------------------------------------------------------------------------

/**
 * Checks that all required layers exist under srcDir
 */
function checkRequiredLayers(
  srcPath: string,
  rule: LayerRule,
): ValidationIssue[] {
  return rule.required
    .filter((layer) => !fs.existsSync(path.join(srcPath, layer)))
    .map((layer) => ({
      severity: 'error' as const,
      message: `Missing required layer: src/${layer}`,
    }))
}

/**
 * Checks that no unknown (forbidden) layers exist under srcDir
 */
function checkUnknownLayers(
  srcPath: string,
  rule: LayerRule,
): ValidationIssue[] {
  if (!fs.existsSync(srcPath)) return []

  return fs
    .readdirSync(srcPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => !rule.allowed.includes(entry.name))
    .map((entry) => ({
      severity: 'warning' as const,
      message: `Unknown layer "src/${entry.name}" is not part of ${entry.name} architecture`,
    }))
}

/**
 * Checks each slice directory for a public API index.ts
 */
function checkPublicApiFiles(
  srcPath: string,
  rule: LayerRule,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  const layersToCheck = rule.allowed.filter(
    (l) => l !== 'app' && l !== 'shared' && l !== 'core',
  )

  for (const layer of layersToCheck) {
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
          message: `Missing public API: src/${layer}/${slice.name}/index.ts`,
        })
      }
    }
  }

  return issues
}

// ---------------------------------------------------------------------------
// Command entry point
// ---------------------------------------------------------------------------

export function validateCommand(): void {
  const config = loadProjectConfig()
  const srcPath = path.join(process.cwd(), config.srcDir)
  const rule = layerRulesByArchitecture[config.architecture]

  logger.info(`Validating ${config.architecture.toUpperCase()} architecture…`)

  const issues: ValidationIssue[] = [
    ...checkRequiredLayers(srcPath, rule),
    ...checkUnknownLayers(srcPath, rule),
    ...checkPublicApiFiles(srcPath, rule),
  ]

  if (issues.length === 0) {
    logger.success('Architecture is valid. No issues found.')
    return
  }

  const errors = issues.filter((i) => i.severity === 'error')
  const warnings = issues.filter((i) => i.severity === 'warning')

  for (const issue of warnings) {
    logger.warning(issue.message)
  }
  for (const issue of errors) {
    logger.error(issue.message)
  }

  logger.info(`Found ${errors.length} error(s), ${warnings.length} warning(s).`)

  if (errors.length > 0) {
    process.exit(1)
  }
}
