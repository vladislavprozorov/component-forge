import os from 'node:os'
import path from 'node:path'

import fs from 'fs-extra'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { resolveSliceFiles } from './template-resolver'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cf-test-'))
}

// ---------------------------------------------------------------------------
// resolveSliceFiles
// ---------------------------------------------------------------------------

describe('resolveSliceFiles', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = makeTempDir()
  })

  afterEach(() => {
    fs.removeSync(tmpDir)
  })

  describe('without custom templates', () => {
    it('returns built-in files when no templatesDir is provided', () => {
      const files = resolveSliceFiles('feature', 'auth')
      expect(Object.keys(files)).toEqual([
        'index.ts',
        'ui/Auth.tsx',
        'model/index.ts',
        'api/index.ts',
      ])
    })

    it('returns built-in files when templatesDir does not exist', () => {
      const files = resolveSliceFiles('feature', 'auth', '/non/existent/path')
      expect(files['index.ts']).toContain("export { Auth } from './ui/Auth'")
    })

    it('returns built-in files when sliceType subdir is missing', () => {
      // tmpDir exists but has no 'feature' subdirectory
      const files = resolveSliceFiles('feature', 'auth', tmpDir)
      expect(files['index.ts']).toContain("export { Auth } from './ui/Auth'")
    })
  })

  describe('with custom templates', () => {
    it('overrides a single file with a custom .hbs template', () => {
      const customDir = path.join(tmpDir, 'feature')
      fs.ensureDirSync(customDir)
      fs.writeFileSync(
        path.join(customDir, 'index.ts.hbs'),
        '// custom: {{sliceType}} {{Name}}\nexport { {{Name}} } from "./ui/{{Name}}"\n',
      )

      const files = resolveSliceFiles('feature', 'auth', tmpDir)

      expect(files['index.ts']).toBe(
        '// custom: feature Auth\nexport { Auth } from "./ui/Auth"\n',
      )
      // Other files must fall back to built-ins
      expect(files['ui/Auth.tsx']).toContain('export function Auth')
    })

    it('injects {{name}} (raw) and {{Name}} (PascalCase) correctly', () => {
      const customDir = path.join(tmpDir, 'component')
      fs.ensureDirSync(customDir)
      fs.writeFileSync(
        path.join(customDir, 'index.ts.hbs'),
        'export { {{Name}} } from "./{{Name}}"\n// raw: {{name}}\n',
      )

      const files = resolveSliceFiles('component', 'button', tmpDir)
      expect(files['index.ts']).toContain('export { Button } from "./Button"')
      expect(files['index.ts']).toContain('// raw: button')
    })

    it('injects {{Name}} as PascalCase for nested names', () => {
      const customDir = path.join(tmpDir, 'component')
      fs.ensureDirSync(customDir)
      fs.writeFileSync(
        path.join(customDir, 'index.ts.hbs'),
        'export { {{Name}} } from "./{{Name}}"\n',
      )

      // "forms/Input" → Name should be "Input" (basename)
      const files = resolveSliceFiles('component', 'forms/Input', tmpDir)
      expect(files['index.ts']).toContain('export { Input } from "./Input"')
    })

    it('falls back to built-in when .hbs file is missing for that path', () => {
      const customDir = path.join(tmpDir, 'feature')
      fs.ensureDirSync(customDir)
      // Only override index.ts — all other files should be built-in
      fs.writeFileSync(path.join(customDir, 'index.ts.hbs'), '// custom index\n')

      const files = resolveSliceFiles('feature', 'auth', tmpDir)
      expect(files['index.ts']).toBe('// custom index\n')
      expect(files['model/index.ts']).toContain('export interface AuthState')
      expect(files['api/index.ts']).toContain('export async function fetchAuth')
    })
  })
})
