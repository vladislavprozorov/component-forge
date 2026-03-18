import os from 'node:os'
import path from 'node:path'

import fs from 'fs-extra'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { buildHint, collectSourceFiles, parseImports, resolveLayer, runCheck } from './index'

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
    write('entities/user/ui.ts', `import { Button } from '../../shared/ui/button'`)
    const result = runCheck(tmpDir, 'fsd')
    expect(result.violations).toHaveLength(0)
    expect(result.checkedFiles).toBe(1)
  })

  it('detects feature importing from feature (same level)', () => {
    write('features/auth/index.ts', `import { foo } from '../../features/search/index'`)
    const result = runCheck(tmpDir, 'fsd')
    expect(result.violations).toHaveLength(1)
    expect(result.violations[0].message).toMatch(/must not import from "features"/)
  })

  it('detects entity importing from feature (higher level)', () => {
    write('entities/user/index.ts', `import { login } from '../../features/auth/index'`)
    const result = runCheck(tmpDir, 'fsd')
    expect(result.violations).toHaveLength(1)
    expect(result.violations[0].message).toMatch(/must not import from "features"/)
  })

  it('detects shared importing from entities (higher level)', () => {
    write('shared/ui/Avatar.ts', `import { User } from '../../entities/user/model'`)
    const result = runCheck(tmpDir, 'fsd')
    expect(result.violations).toHaveLength(1)
    expect(result.violations[0].message).toMatch(/must not import from "entities"/)
  })

  it('passes when feature imports from entities (lower level)', () => {
    write('features/auth/ui.ts', `import { User } from '../../entities/user/index'`)
    const result = runCheck(tmpDir, 'fsd')
    expect(result.violations).toHaveLength(0)
  })

  it('passes for same-slice internal imports', () => {
    write('features/auth/ui.ts', `import { selectAuth } from './model'`)
    const result = runCheck(tmpDir, 'fsd')
    expect(result.violations).toHaveLength(0)
  })

  it('detects public-api-bypass when importing deep into a slice', () => {
    write('features/auth/ui.ts', `import { UserIcon } from '../../entities/user/ui/UserIcon'`)
    const result = runCheck(tmpDir, 'fsd')
    expect(result.violations).toHaveLength(1)
    expect(result.violations[0].message).toMatch(/bypasses its Public API/)
    expect(result.violations[0].hint).toMatch(/Deep imports into a slice break/)
  })

  it('passes when pages imports from widgets (lower level)', () => {
    write('pages/home/index.ts', `import { Header } from '../../widgets/header/index'`)
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

  it('ignores files matching ignorePatterns', () => {
    write('entities/user/index.ts', `import { login } from '../../features/auth/index'`)
    write('shared/ignore-me/index.ts', `import { Page } from '../../pages/some/index'`)

    // Check without ignore
    const result1 = runCheck(tmpDir, 'fsd')
    expect(result1.violations).toHaveLength(2)

    // Check with ignore
    const result2 = runCheck(tmpDir, 'fsd', [], ['shared/ignore-me/**'])
    expect(result2.violations).toHaveLength(1)
    expect(result2.violations[0].file).toContain('entities')
    expect(result2.checkedFiles).toBe(1)
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

// ---------------------------------------------------------------------------
// buildHint — unit tests for the hint engine
// ---------------------------------------------------------------------------

describe('buildHint', () => {
  it('gives specific advice for public-api-bypass', () => {
    expect(buildHint('public-api-bypass', 'features', 'entities')).toMatch(
      /Always import from the slice's public API/,
    )
  })

  it('gives specific advice for features→features', () => {
    const hint = buildHint('fsd-same-layer', 'features', 'features')
    expect(hint).toContain('shared/')
    expect(hint).toContain('widget')
  })

  it('gives specific advice for entities→entities', () => {
    const hint = buildHint('fsd-same-layer', 'entities', 'entities')
    expect(hint).toContain('shared/')
    expect(hint).toContain('independent')
  })

  it('gives specific advice for widgets→widgets', () => {
    const hint = buildHint('fsd-same-layer', 'widgets', 'widgets')
    expect(hint).toContain('shared/ui')
  })

  it('falls back to generic advice for unknown same-layer pair', () => {
    const hint = buildHint('fsd-same-layer', 'processes', 'processes')
    expect(hint).toContain('shared/')
    expect(hint).toContain('higher layer')
  })

  // -------------------------------------------------------------------------
  // FSD higher-layer — known pairs
  // -------------------------------------------------------------------------

  it('gives specific advice for shared→entities', () => {
    const hint = buildHint('fsd-higher-layer', 'shared', 'entities')
    expect(hint).toContain('foundation')
    expect(hint).toContain('invert the dependency')
  })

  it('gives specific advice for entities→features', () => {
    const hint = buildHint('fsd-higher-layer', 'entities', 'features')
    expect(hint).toContain('prop')
  })

  it('gives specific advice for features→widgets', () => {
    const hint = buildHint('fsd-higher-layer', 'features', 'widgets')
    expect(hint).toContain('widget composes features')
  })

  it('gives specific advice for widgets→pages', () => {
    const hint = buildHint('fsd-higher-layer', 'widgets', 'pages')
    expect(hint).toContain('Pages are the top-level composers')
  })

  it('falls back to generic advice for unlisted higher-layer pair', () => {
    const hint = buildHint('fsd-higher-layer', 'shared', 'app')
    expect(hint).toContain('FSD hierarchy')
    expect(hint).toContain('shared/')
  })

  // -------------------------------------------------------------------------
  // Modular violations
  // -------------------------------------------------------------------------

  it('gives specific advice for shared importing from modules', () => {
    const hint = buildHint('modular-forbidden', 'shared', 'modules')
    expect(hint).toContain('infrastructure')
    expect(hint).toContain('modules/')
  })

  it('gives specific advice for core importing from modules', () => {
    const hint = buildHint('modular-forbidden', 'core', 'modules')
    expect(hint).toContain('application shell')
    expect(hint).toContain('dependency injection')
  })

  it('falls back to generic modular advice for unknown pair', () => {
    const hint = buildHint('modular-forbidden', 'utils', 'modules')
    expect(hint).toContain('modular architecture')
    expect(hint).toContain('shared/')
  })

  // -------------------------------------------------------------------------
  // hint is populated on violations returned by runCheck
  // -------------------------------------------------------------------------

  it('runCheck violation carries a non-empty hint for FSD same-layer', () => {
    write('features/auth/index.ts', `import { foo } from '../../features/search/index'`)
    const { violations } = runCheck(tmpDir, 'fsd')
    expect(violations).toHaveLength(1)
    expect(violations[0].hint).toBeTruthy()
    expect(violations[0].hint).toContain('shared/')
  })

  it('runCheck violation carries a non-empty hint for modular forbidden', () => {
    write('shared/utils/helper.ts', `import { login } from '../../modules/auth/index'`)
    const { violations } = runCheck(tmpDir, 'modular')
    expect(violations).toHaveLength(1)
    expect(violations[0].hint).toBeTruthy()
    expect(violations[0].hint).toContain('infrastructure')
  })
})
