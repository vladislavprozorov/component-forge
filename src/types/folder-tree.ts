export type FolderTree = {
  [key: string]: FolderTree
}

/**
 * Supported architecture strategies
 */
export type Architecture = 'fsd' | 'modular'

/**
 * Supported slice / segment types per architecture
 */
export type SliceType =
  | 'feature'
  | 'entity'
  | 'widget'
  | 'page'
  | 'component'
  | 'module'

/**
 * Project config — written by `init`, read by all commands.
 *
 * Can live in:
 *   - forge.config.ts  (recommended — full TypeScript + IntelliSense)
 *   - .component-forge.json  (legacy — still supported for backwards compatibility)
 *
 * @example forge.config.ts
 * ```ts
 * import { defineConfig } from '@xanahlight/component-forge'
 *
 * export default defineConfig({
 *   architecture: 'fsd',
 *   srcDir: 'src',
 * })
 * ```
 */
export interface ProjectConfig {
  architecture: Architecture
  srcDir: string
  /**
   * Optional path to a directory containing custom Handlebars (.hbs) templates.
   * Resolved relative to the project root.
   *
   * Directory structure must mirror the built-in layout:
   *   <templatesDir>/<sliceType>/<file>.hbs
   *
   * Any missing template falls back to the built-in default.
   *
   * @example ".forge-templates"
   */
  templates?: string
}

/**
 * Type-safe config helper — provides IntelliSense and compile-time validation
 * in forge.config.ts.
 *
 * @example
 * ```ts
 * import { defineConfig } from '@xanahlight/component-forge'
 *
 * export default defineConfig({
 *   architecture: 'fsd',
 *   srcDir: 'src',
 * })
 * ```
 */
export function defineConfig(config: ProjectConfig): ProjectConfig {
  return config
}
