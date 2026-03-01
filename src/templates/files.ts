import type { SliceType } from '../types/folder-tree'

// ---------------------------------------------------------------------------
// File template system
//
// Each template is a function that receives the slice name and returns
// the file content as a string. This keeps templates pure and testable.
//
// Map key = relative path inside the slice directory.
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
// Individual file templates
// ---------------------------------------------------------------------------

const indexTemplate: FileTemplate = (name) => {
  const pascal = toPascalCase(name)
  return [
    `export { ${pascal} } from './ui/${pascal}'`,
    `export type { ${pascal}Props } from './ui/${pascal}'`,
    '',
  ].join('\n')
}

const componentIndexTemplate: FileTemplate = (name) => {
  const pascal = toPascalCase(name)
  return [
    `export { ${pascal} } from './${pascal}'`,
    `export type { ${pascal}Props } from './${pascal}'`,
    '',
  ].join('\n')
}

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
    case 'feature':
    case 'entity':
      return {
        'index.ts': indexTemplate(name),
        [`ui/${pascal}.tsx`]: reactComponentTemplate(name),
        'model/index.ts': modelTemplate(name),
        'api/index.ts': apiTemplate(name),
      }

    case 'widget':
      return {
        'index.ts': indexTemplate(name),
        [`ui/${pascal}.tsx`]: reactComponentTemplate(name),
        'model/index.ts': modelTemplate(name),
      }

    case 'page':
      return {
        'index.ts': [`export { ${pascal}Page } from './ui/${pascal}Page'`, ''].join('\n'),
        [`ui/${pascal}Page.tsx`]: reactComponentTemplate(`${pascal}Page`),
      }

    case 'component':
      return {
        'index.ts': componentIndexTemplate(name),
        [`${pascal}.tsx`]: reactComponentTemplate(name),
      }

    case 'module':
      return {
        'index.ts': indexTemplate(name),
        [`ui/${pascal}.tsx`]: reactComponentTemplate(name),
        'model/index.ts': modelTemplate(name),
        'api/index.ts': apiTemplate(name),
      }
  }
}

