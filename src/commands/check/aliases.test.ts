import os from 'node:os'
import path from 'node:path'

import fs from 'fs-extra'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { loadAliasEntries, resolveAliasedImport, runCheck } from './index'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string

function writeFile(relPath: string, content: string): void {
  const full = path.join(tmpDir, relPath)
  fs.ensureDirSync(path.dirname(full))
  fs.writeFileSync(full, content)
}

function writeTsconfig(content: object): void {
  fs.writeFileSync(path.join(tmpDir, 'tsconfig.json'), JSON.stringify(content, null, 2))
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-aliases-test-'))
})

afterEach(() => {
  fs.removeSync(tmpDir)
})

// ---------------------------------------------------------------------------
// resolveAliasedImport
// ---------------------------------------------------------------------------

describe('resolveAliasedImport', () => {
  it('resolves @/ prefix to empty target (srcDir root)', () => {
    const aliases = [{ prefix: '@/', target: '' }]
    expect(resolveAliasedImport('@/features/auth', aliases)).toBe('features/auth')
  })

  it('resolves @/ with sub-path', () => {
    const aliases = [{ prefix: '@/', target: '' }]
    expect(resolveAliasedImport('@/shared/ui/Button', aliases)).toBe('shared/ui/Button')
  })

  it('resolves ~/src/ prefix', () => {
    const aliases = [{ prefix: '~/src/', target: '' }]
    expect(resolveAliasedImport('~/src/entities/user', aliases)).toBe('entities/user')
  })

  it('resolves custom alias with non-empty target', () => {
    const aliases = [{ prefix: '@shared/', target: 'shared/' }]
    expect(resolveAliasedImport('@shared/ui/Button', aliases)).toBe('shared/ui/Button')
  })

  it('returns null when no alias matches', () => {
    const aliases = [{ prefix: '@/', target: '' }]
    expect(resolveAliasedImport('./relative/path', aliases)).toBeNull()
    expect(resolveAliasedImport('react', aliases)).toBeNull()
  })

  it('returns null for empty aliases array', () => {
    expect(resolveAliasedImport('@/features/auth', [])).toBeNull()
  })

  it('uses first matching alias when multiple could match', () => {
    const aliases = [
      { prefix: '@/', target: 'src/' },
      { prefix: '@/features', target: 'other/' },
    ]
    expect(resolveAliasedImport('@/features/auth', aliases)).toBe('src/features/auth')
  })
})

// ---------------------------------------------------------------------------
// loadAliasEntries — from tsconfig
// ---------------------------------------------------------------------------

describe('loadAliasEntries — tsconfig', () => {
  it('returns hard-coded conventions when no tsconfig exists', () => {
    const entries = loadAliasEntries(tmpDir, 'src')
    const prefixes = entries.map((e) => e.prefix)
    expect(prefixes).toContain('@/')
    expect(prefixes).toContain('~/src/')
  })

  it('parses @/* alias from tsconfig paths', () => {
    writeTsconfig({
      compilerOptions: {
        baseUrl: '.',
        paths: { '@/*': ['src/*'] },
      },
    })
    const entries = loadAliasEntries(tmpDir, 'src')
    const atEntry = entries.find((e) => e.prefix === '@/')
    expect(atEntry).toBeDefined()
    // target should be relative to srcDir — stripping "src/" prefix
    expect(atEntry!.target).toBe('')
  })

  it('parses named alias like @features/* from tsconfig', () => {
    writeTsconfig({
      compilerOptions: {
        paths: { '@features/*': ['src/features/*'] },
      },
    })
    const entries = loadAliasEntries(tmpDir, 'src')
    const entry = entries.find((e) => e.prefix === '@features/')
    expect(entry).toBeDefined()
    expect(entry!.target).toBe('features/')
  })

  it('does not duplicate hard-coded @/ when tsconfig already defines it', () => {
    writeTsconfig({
      compilerOptions: {
        paths: { '@/*': ['src/*'] },
      },
    })
    const entries = loadAliasEntries(tmpDir, 'src')
    const atEntries = entries.filter((e) => e.prefix === '@/')
    expect(atEntries).toHaveLength(1)
  })

  it('returns conventions even when tsconfig has no paths section', () => {
    writeTsconfig({ compilerOptions: { strict: true } })
    const entries = loadAliasEntries(tmpDir, 'src')
    expect(entries.map((e) => e.prefix)).toContain('@/')
  })

  it('handles malformed tsconfig gracefully — returns conventions only', () => {
    fs.writeFileSync(path.join(tmpDir, 'tsconfig.json'), '{ invalid json <<<')
    const entries = loadAliasEntries(tmpDir, 'src')
    // Should still return convention entries, not throw
    expect(entries.length).toBeGreaterThan(0)
    expect(entries.map((e) => e.prefix)).toContain('@/')
  })
})

// ---------------------------------------------------------------------------
// runCheck — FSD violations via aliased imports
// ---------------------------------------------------------------------------

describe('runCheck — FSD with path aliases', () => {
  const aliases = [{ prefix: '@/', target: '' }]

  it('detects same-layer violation via @/ alias', () => {
    writeFile('features/auth/index.ts', `import { foo } from '@/features/search/index'`)
    const result = runCheck(tmpDir, 'fsd', aliases)
    expect(result.violations).toHaveLength(1)
    expect(result.violations[0].importPath).toBe('@/features/search/index')
    expect(result.violations[0].message).toMatch(/must not import from "features"/)
  })

  it('detects higher-layer violation via @/ alias (entity → feature)', () => {
    writeFile('entities/user/index.ts', `import { login } from '@/features/auth/index'`)
    const result = runCheck(tmpDir, 'fsd', aliases)
    expect(result.violations).toHaveLength(1)
    expect(result.violations[0].message).toMatch(/must not import from "features"/)
  })

  it('does NOT flag valid lower-layer import via @/ alias', () => {
    writeFile('features/auth/index.ts', `import { User } from '@/entities/user/index'`)
    const result = runCheck(tmpDir, 'fsd', aliases)
    expect(result.violations).toHaveLength(0)
  })

  it('does NOT flag external package import that starts with @', () => {
    writeFile('features/auth/index.ts', `import { useForm } from '@tanstack/react-form'`)
    const result = runCheck(tmpDir, 'fsd', [{ prefix: '@/', target: '' }])
    // @tanstack/... does not match @/ prefix exactly (no / after the segment)
    expect(result.violations).toHaveLength(0)
  })

  it('detects violation via ~/src/ alias', () => {
    const tildeSrcAliases = [{ prefix: '~/src/', target: '' }]
    writeFile('entities/user/index.ts', `import { login } from '~/src/features/auth/index'`)
    const result = runCheck(tmpDir, 'fsd', tildeSrcAliases)
    expect(result.violations).toHaveLength(1)
    expect(result.violations[0].message).toMatch(/must not import from "features"/)
  })

  it('violation carries a non-empty hint', () => {
    writeFile('features/auth/index.ts', `import { foo } from '@/features/search/index'`)
    const { violations } = runCheck(tmpDir, 'fsd', aliases)
    expect(violations[0].hint).toBeTruthy()
    expect(violations[0].hint).toContain('shared/')
  })

  it('handles both relative and aliased imports in the same file', () => {
    writeFile(
      'entities/user/index.ts',
      [
        `import { Button } from '../../shared/ui/Button'`, // OK
        `import { login } from '@/features/auth/index'`,   // violation
      ].join('\n'),
    )
    const result = runCheck(tmpDir, 'fsd', aliases)
    expect(result.violations).toHaveLength(1)
    expect(result.violations[0].importPath).toBe('@/features/auth/index')
  })
})

// ---------------------------------------------------------------------------
// runCheck — modular violations via aliased imports
// ---------------------------------------------------------------------------

describe('runCheck — modular with path aliases', () => {
  const aliases = [{ prefix: '@/', target: '' }]

  it('detects shared importing modules via @/ alias', () => {
    writeFile('shared/utils/helper.ts', `import { login } from '@/modules/auth/index'`)
    const result = runCheck(tmpDir, 'modular', aliases)
    expect(result.violations).toHaveLength(1)
    expect(result.violations[0].message).toMatch(/must not import from "modules"/)
  })

  it('detects core importing modules via @/ alias', () => {
    writeFile('core/router.ts', `import { AuthModule } from '@/modules/auth/index'`)
    const result = runCheck(tmpDir, 'modular', aliases)
    expect(result.violations).toHaveLength(1)
    expect(result.violations[0].message).toMatch(/must not import from "modules"/)
  })

  it('does NOT flag module importing module via @/ alias', () => {
    writeFile('modules/profile/index.ts', `import { User } from '@/modules/auth/model'`)
    const result = runCheck(tmpDir, 'modular', aliases)
    expect(result.violations).toHaveLength(0)
  })
})
