import path from 'node:path'

import fs from 'fs-extra'
import { createJiti } from 'jiti'

import type { ProjectConfig } from '../types/folder-tree'

import { logger } from './logger'

// ---------------------------------------------------------------------------
// Config file resolution order
//
//   1. forge.config.ts   ← recommended (TypeScript, IntelliSense)
//   2. forge.config.js   ← for projects that prefer plain JS
//   3. .component-forge.json  ← legacy (backwards compat)
// ---------------------------------------------------------------------------

export const CONFIG_FILENAMES = {
  ts: 'forge.config.ts',
  js: 'forge.config.js',
  json: '.component-forge.json',
} as const

/**
 * Attempts to load forge.config.ts / forge.config.js via jiti (zero-config TS runner).
 * Returns the default export, or null if the file does not exist.
 */
function loadTsConfig(projectRoot: string): ProjectConfig | null {
  for (const filename of [CONFIG_FILENAMES.ts, CONFIG_FILENAMES.js]) {
    const configPath = path.join(projectRoot, filename)

    if (!fs.existsSync(configPath)) continue

    try {
      // jiti executes TypeScript on-the-fly — no build step needed
      const jiti = createJiti(__filename, { interopDefault: true })
      const mod = jiti(configPath) as { default?: ProjectConfig } | ProjectConfig

      const config = (mod as { default?: ProjectConfig }).default ?? (mod as ProjectConfig)

      if (!config || typeof config !== 'object') {
        logger.error(`${filename} must export a default config object.`)
        logger.info(
          `Use defineConfig({ architecture: 'fsd', srcDir: 'src' }) as the default export.`,
        )
        process.exit(1)
      }

      return config as ProjectConfig
    } catch (err) {
      logger.error(`Failed to load ${filename}: ${(err as Error).message}`)
      process.exit(1)
    }
  }

  return null
}

/**
 * Reads and returns the project config.
 *
 * Resolution order:
 *   1. forge.config.ts
 *   2. forge.config.js
 *   3. .component-forge.json  (legacy)
 *
 * Exits with a user-friendly error if no config is found.
 */
export function loadProjectConfig(projectRoot: string = process.cwd()): ProjectConfig {
  // 1 & 2 — TypeScript / JS config
  const tsConfig = loadTsConfig(projectRoot)
  if (tsConfig) return tsConfig

  // 3 — Legacy JSON config
  const jsonPath = path.join(projectRoot, CONFIG_FILENAMES.json)
  if (fs.existsSync(jsonPath)) {
    return fs.readJsonSync(jsonPath) as ProjectConfig
  }

  // Nothing found
  logger.error(`No forge.config.ts (or ${CONFIG_FILENAMES.json}) found.`)
  logger.info('Run "component-forge init" to create a config, or create forge.config.ts manually:')
  logger.info('')
  logger.info("  import { defineConfig } from '@xanahlight/component-forge'")
  logger.info('')
  logger.info('  export default defineConfig({')
  logger.info("    architecture: 'fsd',")
  logger.info("    srcDir: 'src',")
  logger.info('  })')
  process.exit(1)
}

/**
 * Writes the project config to .component-forge.json (legacy format).
 * Used by the `migrate` command to update the architecture after execution.
 *
 * Note: users can migrate to forge.config.ts at any time for better DX.
 */
export function writeProjectConfig(config: ProjectConfig, projectRoot: string): void {
  const configPath = path.join(projectRoot, CONFIG_FILENAMES.json)
  fs.writeJsonSync(configPath, config, { spaces: 2 })
}

/**
 * Writes a forge.config.ts file with a defineConfig() call.
 * Used by the `init` command when creating a new project.
 */
export function writeForgeConfigTs(config: ProjectConfig, projectRoot: string): void {
  const lines: string[] = [
    `import { defineConfig } from '@xanahlight/component-forge'`,
    ``,
    `export default defineConfig({`,
    `  architecture: '${config.architecture}',`,
    `  srcDir: '${config.srcDir}',`,
  ]
  if (config.templates) {
    lines.push(`  templates: '${config.templates}',`)
  }
  lines.push(`})`, ``)

  const configPath = path.join(projectRoot, CONFIG_FILENAMES.ts)
  fs.writeFileSync(configPath, lines.join('\n'), 'utf8')
}
