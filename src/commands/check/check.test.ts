import os from 'node:os'
import path from 'node:path'

import fs from 'fs-extra'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { collectSourceFiles, parseImports, resolveLayer, runCheck } from './index'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string

function write(relPath: string, content: string): void {
  const full = path.join(tmpDir, relPath)
  fs.ensureDirSync(path.dirname(full))
  fs.writeFileSync(full, content)
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-check-'))
})

afterEach(() => {
  fs.removeSync(tmpDir)
})

// ---------------------------------------------------------------------------
// parseImports
// ---------------------------------------------------------------------------

describe('parseImports', () => {
  it('extracts named imports', () => {
    const src = `import { foo } from './foo'\nimport type { Bar } from '../bar'`
    expect(parseImports(src)).toEqual(['./foo', '../bar'])
  })

  it('extracts default imports', () => {
    expect(parseImports(`import React from 'react'`)).toEqual(['react'])
  })

  it('extracts re-exports', () => {
    expect(parseImports(`export { foo } from './foo'`)).toEqual(['./foo'])
  })

  it('ignores non-import lines', () => {
    expect(parseImports(`const x = 1\nconsole.log(x)`)).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// resolveLayer
// ---------------------------------------------------------------------------

describe('resolveLayer', () => {
  it('returns first path segment as layer', () => {
    expect(resolveLayer('features/auth/index.ts')).toBe('features')
    expect(resolveLayer('shared/ui/Button.tsx')).toBe('shared')
  })

  it('returns single-segment layer', () => {
    expect(resolveLayer('app')).toBe('app')
  })
})

// ---------------------------------------------------------------------------
// collectSourceFiles
// ---------------------------------------------------------------------------

describe('collectSourceFiles', () => {
  it('finds ts and tsx files', () => {
    write('features/auth/index.ts', '')
    write('shared/ui/Button.tsx', '')
    write('shared/ui/Button.test.ts', '') // should be excluded

    const files = collectSourceFiles(tmpDir)
    expect(files).toContain(path.join('features', 'auth', 'index.ts'))
    expect(files).toContain(path.join('shared', 'ui', 'Button.tsx'))
    expect(files.some((f) => f.endsWith('.test.ts'))).toBe(false)
  })

  it('returns empty array for non-existent dir', () => {
    expect(collectSourceFiles('/non/existent/path')).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// FSD violations
// ---------------------------------------------------------------------------

describe('runCheck — FSD', () => {
  it('passes when lower layer imports from even lower layer (entities → shared)', () => {
    write('entities/user/index.ts', `import { Button } from '../../shared/ui/Button'`)
    const result = runCheck(tmpDir, 'fsd')
    expect(result.violations).toHaveLength(0)
    expect(result.checkedFiles).toBe(1)
  })

  it('detects feature importing from feature (same level)', () => {
    write(
      'features/auth/index.ts',
      `import { foo } from '../../features/search/index'`,
    )
    const result = runCheck(tmpDir, 'fsd')
    expect(result.violations).toHaveLength(1)
    expect(result.violations[0].message).toMatch(/must not import from "features"/)
  })

  it('detects entity importing from feature (higher level)', () => {
    write(
      'entities/user/index.ts',
      `import { login } from '../../features/auth/index'`,
    )
    const result = runCheck(tmpDir, 'fsd')
    expect(result.violations).toHaveLength(1)
    expect(result.violations[0].message).toMatch(/must not import from "features"/)
  })

  it('detects shared importing from entities (higher level)', () => {
    write(
      'shared/ui/Avatar.ts',
      `import { User } from '../../entities/user/model'`,
    )
    const result = runCheck(tmpDir, 'fsd')
    expect(result.violations).toHaveLength(1)
    expect(result.violations[0].message).toMatch(/must not import from "entities"/)
  })

  it('passes when feature imports from entities (lower level)', () => {
    write(
      'features/auth/index.ts',
      `import { User } from '../../entities/user/index'`,
    )
    const result = runCheck(tmpDir, 'fsd')
    expect(result.violations).toHaveLength(0)
  })

  it('passes when pages imports from widgets (lower level)', () => {
    write(
      'pages/home/index.ts',
      `import { Header } from '../../widgets/header/index'`,
    )
    const result = runCheck(tmpDir, 'fsd')
    expect(result.violations).toHaveLength(0)
  })

  it('ignores external (non-relative) imports', () => {
    write('features/auth/index.ts', `import React from 'react'`)
    const result = runCheck(tmpDir, 'fsd')
    expect(result.violations).toHaveLength(0)
  })

  it('reports multiple violations across multiple files', () => {
    write('entities/user/index.ts', `import { login } from '../../features/auth/index'`)
    write('shared/ui/Button.ts', `import { User } from '../../entities/user/model'`)
    const result = runCheck(tmpDir, 'fsd')
    expect(result.violations).toHaveLength(2)
    expect(result.checkedFiles).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// Modular violations
// ---------------------------------------------------------------------------

describe('runCheck — modular', () => {
  it('passes when module imports from another module', () => {
    write('modules/auth/index.ts', `import { foo } from '../../modules/ui/index'`)
    const result = runCheck(tmpDir, 'modular')
    expect(result.violations).toHaveLength(0)
  })

  it('detects shared importing from modules', () => {
    write('shared/utils/helper.ts', `import { login } from '../../modules/auth/index'`)
    const result = runCheck(tmpDir, 'modular')
    expect(result.violations).toHaveLength(1)
    expect(result.violations[0].message).toMatch(/must not import from "modules"/)
  })

  it('detects core importing from modules', () => {
    write('core/router.ts', `import { AuthModule } from '../modules/auth/index'`)
    const result = runCheck(tmpDir, 'modular')
    expect(result.violations).toHaveLength(1)
    expect(result.violations[0].message).toMatch(/must not import from "modules"/)
  })

  it('passes when module imports from shared', () => {
    write('modules/auth/index.ts', `import { Button } from '../../shared/ui/Button'`)
    const result = runCheck(tmpDir, 'modular')
    expect(result.violations).toHaveLength(0)
  })
})
