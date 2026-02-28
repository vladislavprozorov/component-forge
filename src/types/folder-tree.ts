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
}
