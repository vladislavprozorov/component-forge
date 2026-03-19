import type { SliceType } from '../types/folder-tree'

// ---------------------------------------------------------------------------
// File template system
//
// Each template is a pure function: (name: string) => string
// Map key = relative path inside the slice directory.
//
// Smart templates — every slice type has its own file set:
//
//  feature   → index + ui/ + model/ + api/   (full vertical slice)
//  entity    → index + model/ + api/          (data layer, no UI)
//  widget    → index + ui/ + model/           (composed UI block, no direct API)
//  page      → index + ui/*Page.tsx           (route-level component, thin)
//  component → index + flat *.tsx             (pure UI atom, no model/api)
//  module    → index + ui/ + model/ + api/    (modular-arch vertical slice)
// ---------------------------------------------------------------------------

type FileTemplate = (name: string) => string

type SliceFileMap = Record<string, string>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** "auth" → "Auth", "userProfile" → "UserProfile" */
function toPascalCase(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1)
}

// ---------------------------------------------------------------------------
// Shared file templates
// ---------------------------------------------------------------------------

/** Public barrel — re-exports ui component + its props type */
const uiBarrelTemplate: FileTemplate = (name) => {
  const pascal = toPascalCase(name)
  return [
    `export { ${pascal} } from './ui/${pascal}'`,
    `export type { ${pascal}Props } from './ui/${pascal}'`,
    '',
  ].join('\n')
}

/** Public barrel for entity — re-exports model types and api */
const entityBarrelTemplate: FileTemplate = (name) => {
  const pascal = toPascalCase(name)
  return [
    `export type { ${pascal}State } from './model'`,
    `export { fetch${pascal} } from './api'`,
    '',
  ].join('\n')
}

/** Public barrel for page — re-exports Page component */
const pageBarrelTemplate: FileTemplate = (name) => {
  const pascal = toPascalCase(name)
  return [`export { ${pascal}Page } from './ui/${pascal}Page'`, ''].join('\n')
}

/** Public barrel for flat component */
const componentBarrelTemplate: FileTemplate = (name) => {
  const pascal = toPascalCase(name)
  return [
    `export { ${pascal} } from './${pascal}'`,
    `export type { ${pascal}Props } from './${pascal}'`,
    '',
  ].join('\n')
}

/** React function component */
const reactComponentTemplate: FileTemplate = (name) => {
  const pascal = toPascalCase(name)
  return [
    `export interface ${pascal}Props {`,
    `  // define props here`,
    `}`,
    ``,
    `export function ${pascal}({ ...props }: ${pascal}Props) {`,
    `  return (`,
    `    <div>`,
    `      {/* ${pascal} */}`,
    `    </div>`,
    `  )`,
    `}`,
    ``,
  ].join('\n')
}

/** State / stores / hooks */
const modelTemplate: FileTemplate = (name) => {
  const pascal = toPascalCase(name)
  return [
    `// ${pascal} model — state, stores, hooks`,
    ``,
    `export interface ${pascal}State {`,
    `  // define state shape here`,
    `}`,
    ``,
  ].join('\n')
}

/** Data fetching / mutations */
const apiTemplate: FileTemplate = (name) => {
  const pascal = toPascalCase(name)
  return [
    `// ${pascal} API — data fetching`,
    ``,
    `export async function fetch${pascal}(): Promise<void> {`,
    `  // implement API call here`,
    `}`,
    ``,
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Slice file maps — what files get generated per slice type
// ---------------------------------------------------------------------------

/**
 * Returns a map of { relativeFilePath: fileContent } for a given slice type.
 * The caller is responsible for writing these to disk.
 */
export function getSliceFiles(sliceType: SliceType, name: string): SliceFileMap {
  const pascal = toPascalCase(name)

  switch (sliceType) {
    /**
     * feature — full vertical slice (FSD)
     * Owns its own UI, business logic (model) and server communication (api).
     */
    case 'feature':
      return {
        'index.ts': uiBarrelTemplate(name),
        [`ui/${pascal}.tsx`]: reactComponentTemplate(name),
        'model/index.ts': modelTemplate(name),
        'api/index.ts': apiTemplate(name),
      }

    /**
     * entity — data-layer slice (FSD)
     * Represents a domain object: model + api, no UI of its own.
     * UI is assembled in features/widgets that consume the entity.
     */
    case 'entity':
      return {
        'index.ts': entityBarrelTemplate(name),
        'model/index.ts': modelTemplate(name),
        'api/index.ts': apiTemplate(name),
      }

    /**
     * widget — composite UI block (FSD)
     * Combines multiple features/entities into a self-contained UI block.
     * Has UI and may have local model state, but does NOT own server calls.
     */
    case 'widget':
      return {
        'index.ts': uiBarrelTemplate(name),
        [`ui/${pascal}.tsx`]: reactComponentTemplate(name),
        'model/index.ts': modelTemplate(name),
      }

    /**
     * page — route-level shell (FSD)
     * Thin composition layer: assembles widgets/features for a route.
     * No model or api — those belong to the layers below.
     */
    case 'page':
      return {
        'index.ts': pageBarrelTemplate(name),
        [`ui/${pascal}Page.tsx`]: reactComponentTemplate(`${pascal}Page`),
      }

    /**
     * component — pure UI atom (FSD shared/ui or Modular shared/ui)
     * Stateless, presentational, reusable across the whole codebase.
     * Flat structure — no sub-directories.
     */
    case 'component':
      return {
        'index.ts': componentBarrelTemplate(name),
        [`${pascal}.tsx`]: reactComponentTemplate(name),
      }

    /**
     * module — full vertical slice (Modular architecture)
     * Equivalent to a feature in FSD: owns UI, model and api.
     */
    case 'module':
      return {
        'index.ts': uiBarrelTemplate(name),
        [`ui/${pascal}.tsx`]: reactComponentTemplate(name),
        'model/index.ts': modelTemplate(name),
        'api/index.ts': apiTemplate(name),
      }
  }
}
