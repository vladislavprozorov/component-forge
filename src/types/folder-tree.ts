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
 * Project config stored in .component-forge.json
 */
export interface ProjectConfig {
  architecture: Architecture
  srcDir: string
  /**
   * Optional path to a directory containing custom Handlebars (.hbs) templates.
   * Resolved relative to the project root (where .component-forge.json lives).
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
