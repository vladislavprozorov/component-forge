import { SliceType } from '../types/folder-tree'

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
// Individual file templates
// ---------------------------------------------------------------------------

const indexTemplate: FileTemplate = (name) =>
  [
    `export { ${name} } from './ui/${name}'`,
    `export type { ${name}Props } from './ui/${name}'`,
    '',
  ].join('\n')

const componentIndexTemplate: FileTemplate = (name) =>
  [`export { ${name} } from './${name}'`, `export type { ${name}Props } from './${name}'`, ''].join(
    '\n',
  )

const reactComponentTemplate: FileTemplate = (name) =>
  [
    `export interface ${name}Props {`,
    `  // define props here`,
    `}`,
    ``,
    `export function ${name}({ ...props }: ${name}Props) {`,
    `  return (`,
    `    <div {...props}>`,
    `      {/* ${name} */}`,
    `    </div>`,
    `  )`,
    `}`,
    ``,
  ].join('\n')

const modelTemplate: FileTemplate = (name) =>
  [
    `// ${name} model — state, stores, hooks`,
    ``,
    `export interface ${name}State {`,
    `  // define state shape here`,
    `}`,
    ``,
  ].join('\n')

const apiTemplate: FileTemplate = (name) =>
  [
    `// ${name} API — data fetching`,
    ``,
    `export async function fetch${name}(): Promise<void> {`,
    `  // implement API call here`,
    `}`,
    ``,
  ].join('\n')

// ---------------------------------------------------------------------------
// Slice file maps — what files get generated per slice type
// ---------------------------------------------------------------------------

/**
 * Returns a map of { relativeFilePath: fileContent } for a given slice type.
 * The caller is responsible for writing these to disk.
 */
export function getSliceFiles(sliceType: SliceType, name: string): SliceFileMap {
  switch (sliceType) {
    case 'feature':
    case 'entity':
      return {
        'index.ts': indexTemplate(name),
        [`ui/${name}.tsx`]: reactComponentTemplate(name),
        'model/index.ts': modelTemplate(name),
        'api/index.ts': apiTemplate(name),
      }

    case 'widget':
      return {
        'index.ts': indexTemplate(name),
        [`ui/${name}.tsx`]: reactComponentTemplate(name),
        'model/index.ts': modelTemplate(name),
      }

    case 'page':
      return {
        'index.ts': [`export { ${name}Page } from './ui/${name}Page'`, ''].join('\n'),
        [`ui/${name}Page.tsx`]: reactComponentTemplate(`${name}Page`),
      }

    case 'component':
      return {
        'index.ts': componentIndexTemplate(name),
        [`${name}.tsx`]: reactComponentTemplate(name),
      }

    case 'module':
      return {
        'index.ts': indexTemplate(name),
        [`ui/${name}.tsx`]: reactComponentTemplate(name),
        'model/index.ts': modelTemplate(name),
        'api/index.ts': apiTemplate(name),
      }
  }
}
