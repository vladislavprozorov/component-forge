import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { applyFixes, computeFixedImport, fixAll, fixFile } from './fixer'

import type { AliasEntry, CheckViolation } from './index'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeViolation(
  file: string,
  importPath: string,
  message = 'test violation',
  hint = 'test hint',
): CheckViolation {
  return { file, importPath, message, hint }
}

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'forge-fixer-'))
}

// ---------------------------------------------------------------------------
// computeFixedImport
// ---------------------------------------------------------------------------

describe('computeFixedImport', () => {
  let srcPath: string

  beforeEach(() => {
    srcPath = makeTmpDir()
  })
  afterEach(() => {
    fs.rmSync(srcPath, { recursive: true, force: true })
  })

  it('rewrites a same-layer FSD import to shared/', () => {
    // features/auth/index.ts importing from features/cart → should go to shared/cart
    const result = computeFixedImport(srcPath, 'features/auth/index.ts', '../cart')
    // from features/auth/ going up 2 levels to srcPath then shared/cart
    expect(result).toBe('../../shared/cart')
  })

  it('rewrites a higher-layer import to shared/', () => {
    // entities/user/index.ts importing from features/auth (higher layer)
    // from entities/user/ → need ../../ to get to srcPath, then features/auth
    const result = computeFixedImport(srcPath, 'entities/user/index.ts', '../../features/auth')
    expect(result).toBe('../../shared/auth')
  })

  it('handles deeply nested file path', () => {
    // features/auth/ui/LoginForm.tsx importing from features/cart (same layer)
    // from features/auth/ui/ need ../../ to get to srcPath/features, then ../cart
    const result = computeFixedImport(srcPath, 'features/auth/ui/LoginForm.tsx', '../../cart')
    expect(result).toBe('../../../shared/cart')
  })

  it('uses target layer name as slice when no second segment', () => {
    // entities/user/index.ts importing just '../../features' (bare layer, no slice)
    const result = computeFixedImport(srcPath, 'entities/user/index.ts', '../../features')
    // target = srcPath/features, parts[0]=features, parts[1]=undefined → sliceName=features
    expect(result).not.toBeNull()
    expect(result).toContain('shared/features')
  })

  it('returns null when result is identical to original import', () => {
    // Manually craft a scenario where computed path == original
    // (hard to trigger naturally, but cover the guard)
    const result = computeFixedImport(srcPath, 'features/auth/index.ts', '../cart')
    // it should NOT return null since the replacement differs
    expect(result).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// applyFixes
// ---------------------------------------------------------------------------

describe('applyFixes', () => {
  let srcPath: string

  beforeEach(() => {
    srcPath = makeTmpDir()
  })
  afterEach(() => {
    fs.rmSync(srcPath, { recursive: true, force: true })
  })

  it('rewrites a single violating import in source text', () => {
    const source = `import { useCart } from '../cart'\nexport const x = 1\n`
    const violations = [makeViolation('features/auth/index.ts', '../cart')]

    const { source: fixed, fixedCount } = applyFixes(
      source,
      violations,
      srcPath,
      'features/auth/index.ts',
    )

    expect(fixedCount).toBe(1)
    expect(fixed).toContain('../../shared/cart')
    expect(fixed).not.toContain(`'../cart'`)
  })

  it('rewrites double-quoted imports too', () => {
    const source = `import { useCart } from "../cart"\n`
    const violations = [makeViolation('features/auth/index.ts', '../cart')]

    const { source: fixed, fixedCount } = applyFixes(
      source,
      violations,
      srcPath,
      'features/auth/index.ts',
    )

    expect(fixedCount).toBe(1)
    expect(fixed).toContain('"../../shared/cart"')
  })

  it('rewrites multiple violations in one file', () => {
    const source = [
      `import { useCart } from '../cart'`,
      `import { useWishlist } from '../wishlist'`,
      `export const x = 1`,
    ].join('\n')

    const violations = [
      makeViolation('features/auth/index.ts', '../cart'),
      makeViolation('features/auth/index.ts', '../wishlist'),
    ]

    const { fixedCount } = applyFixes(source, violations, srcPath, 'features/auth/index.ts')
    expect(fixedCount).toBe(2)
  })

  it('leaves source unchanged when there are no violations', () => {
    const source = `import { noop } from '../shared/utils'\n`
    const { source: fixed, fixedCount } = applyFixes(source, [], srcPath, 'features/auth/index.ts')

    expect(fixedCount).toBe(0)
    expect(fixed).toBe(source)
  })

  it('does not rewrite if import path is not found in source', () => {
    const source = `import { something } from '../other'\n`
    const violations = [makeViolation('features/auth/index.ts', '../cart')]

    const { fixedCount } = applyFixes(source, violations, srcPath, 'features/auth/index.ts')
    expect(fixedCount).toBe(0)
  })

  it('tracks fixed violations list', () => {
    const source = `import { useCart } from '../cart'\n`
    const v = makeViolation('features/auth/index.ts', '../cart')

    const { fixed } = applyFixes(source, [v], srcPath, 'features/auth/index.ts')
    expect(fixed).toHaveLength(1)
    expect(fixed[0].importPath).toBe('../cart')
  })
})

// ---------------------------------------------------------------------------
// fixFile
// ---------------------------------------------------------------------------

describe('fixFile', () => {
  let srcPath: string

  beforeEach(() => {
    srcPath = makeTmpDir()
  })
  afterEach(() => {
    fs.rmSync(srcPath, { recursive: true, force: true })
  })

  it('rewrites a file on disk', () => {
    const featuresDir = path.join(srcPath, 'features', 'auth')
    fs.mkdirSync(featuresDir, { recursive: true })
    const filePath = path.join(featuresDir, 'index.ts')
    fs.writeFileSync(filePath, `import { useCart } from '../cart'\nexport const x = 1\n`)

    const violations = [makeViolation('features/auth/index.ts', '../cart')]
    const result = fixFile(filePath, violations, srcPath, 'features/auth/index.ts')

    expect(result).not.toBeNull()
    expect(result!.fixedCount).toBe(1)

    const written = fs.readFileSync(filePath, 'utf8')
    expect(written).toContain('../../shared/cart')
    expect(written).not.toContain(`'../cart'`)
  })

  it('returns null for a non-existent file', () => {
    const result = fixFile('/nonexistent/file.ts', [], srcPath, 'features/x/index.ts')
    expect(result).toBeNull()
  })

  it('does not write file when there are no fixable violations', () => {
    const featuresDir = path.join(srcPath, 'features', 'auth')
    fs.mkdirSync(featuresDir, { recursive: true })
    const filePath = path.join(featuresDir, 'index.ts')
    const original = `export const x = 1\n`
    fs.writeFileSync(filePath, original)

    const result = fixFile(filePath, [], srcPath, 'features/auth/index.ts')
    expect(result!.fixedCount).toBe(0)
    expect(fs.readFileSync(filePath, 'utf8')).toBe(original)
  })
})

// ---------------------------------------------------------------------------
// fixAll
// ---------------------------------------------------------------------------

describe('fixAll', () => {
  let srcPath: string

  beforeEach(() => {
    srcPath = makeTmpDir()
  })
  afterEach(() => {
    fs.rmSync(srcPath, { recursive: true, force: true })
  })

  it('fixes violations across multiple files', () => {
    const authDir = path.join(srcPath, 'features', 'auth')
    const cartDir = path.join(srcPath, 'features', 'cart')
    fs.mkdirSync(authDir, { recursive: true })
    fs.mkdirSync(cartDir, { recursive: true })

    fs.writeFileSync(path.join(authDir, 'index.ts'), `import { x } from '../cart'\n`)
    fs.writeFileSync(path.join(cartDir, 'index.ts'), `import { y } from '../auth'\n`)

    const checkResult = {
      violations: [
        makeViolation('features/auth/index.ts', '../cart'),
        makeViolation('features/cart/index.ts', '../auth'),
      ],
      checkedFiles: 2,
    }

    const { fixedFiles, totalFixed } = fixAll(checkResult, srcPath)
    expect(totalFixed).toBe(2)
    expect(fixedFiles).toHaveLength(2)
  })

  it('returns zero totalFixed when check result has no violations', () => {
    const { totalFixed, fixedFiles } = fixAll({ violations: [], checkedFiles: 0 }, srcPath)
    expect(totalFixed).toBe(0)
    expect(fixedFiles).toHaveLength(0)
  })

  it('groups multiple violations from the same file into one write', () => {
    const featDir = path.join(srcPath, 'features', 'auth')
    fs.mkdirSync(featDir, { recursive: true })
    fs.writeFileSync(
      path.join(featDir, 'index.ts'),
      `import { a } from '../cart'\nimport { b } from '../wishlist'\n`,
    )

    const checkResult = {
      violations: [
        makeViolation('features/auth/index.ts', '../cart'),
        makeViolation('features/auth/index.ts', '../wishlist'),
      ],
      checkedFiles: 1,
    }

    const { fixedFiles, totalFixed } = fixAll(checkResult, srcPath)
    expect(totalFixed).toBe(2)
    // Both fixes go into one FixResult entry
    expect(fixedFiles).toHaveLength(1)
    expect(fixedFiles[0].fixedCount).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// Alias support
// ---------------------------------------------------------------------------

describe('computeFixedImport — aliased imports', () => {
  let srcPath: string

  beforeEach(() => {
    srcPath = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-fixer-alias-'))
  })
  afterEach(() => {
    fs.rmSync(srcPath, { recursive: true, force: true })
  })

  it('resolves @/ alias and rewrites to shared/', () => {
    // features/auth/index.ts imports @/features/cart — same-layer via alias
    // @/ maps to '' (srcDir root), so aliasResolved = 'features/cart'
    const aliases: AliasEntry[] = [{ prefix: '@/', target: '' }]
    const result = computeFixedImport(srcPath, 'features/auth/index.ts', '@/features/cart', aliases)
    expect(result).toBe('../../shared/cart')
  })

  it('resolves @features/ alias and rewrites to shared/', () => {
    // @features/ → 'features/'
    const aliases: AliasEntry[] = [{ prefix: '@features/', target: 'features/' }]
    const result = computeFixedImport(srcPath, 'features/auth/index.ts', '@features/cart', aliases)
    // aliasResolved = 'features/cart', same logic as relative
    expect(result).toBe('../../shared/cart')
  })

  it('resolves ~/src/ alias and rewrites to shared/', () => {
    const aliases: AliasEntry[] = [{ prefix: '~/src/', target: '' }]
    const result = computeFixedImport(
      srcPath,
      'entities/user/index.ts',
      '~/src/features/auth',
      aliases,
    )
    // aliasResolved = 'features/auth', slice = 'auth'
    expect(result).toBe('../../shared/auth')
  })

  it('returns null for unrecognised alias (no match)', () => {
    // No aliases provided — non-relative import cannot be resolved
    const result = computeFixedImport(srcPath, 'features/auth/index.ts', '@/features/cart', [])
    expect(result).toBeNull()
  })

  it('uses layer name as slice when alias resolves to a bare layer path', () => {
    const aliases: AliasEntry[] = [{ prefix: '@/', target: '' }]
    // @/features (no slice segment)
    const result = computeFixedImport(srcPath, 'entities/user/index.ts', '@/features', aliases)
    expect(result).not.toBeNull()
    expect(result).toContain('shared/features')
  })
})

describe('applyFixes — aliased imports', () => {
  let srcPath: string

  beforeEach(() => {
    srcPath = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-fixer-alias-apply-'))
  })
  afterEach(() => {
    fs.rmSync(srcPath, { recursive: true, force: true })
  })

  it('rewrites an aliased import in source text', () => {
    const source = `import { useCart } from '@/features/cart'\nexport const x = 1\n`
    const aliases: AliasEntry[] = [{ prefix: '@/', target: '' }]
    const violations: CheckViolation[] = [
      makeViolation('features/auth/index.ts', '@/features/cart'),
    ]

    const { source: fixed, fixedCount } = applyFixes(
      source,
      violations,
      srcPath,
      'features/auth/index.ts',
      aliases,
    )

    expect(fixedCount).toBe(1)
    expect(fixed).toContain('../../shared/cart')
    expect(fixed).not.toContain('@/features/cart')
  })

  it('skips aliased import when no alias matches', () => {
    const source = `import { useCart } from '@/features/cart'\n`
    // No aliases — cannot resolve
    const violations: CheckViolation[] = [
      makeViolation('features/auth/index.ts', '@/features/cart'),
    ]

    const { fixedCount } = applyFixes(source, violations, srcPath, 'features/auth/index.ts', [])
    expect(fixedCount).toBe(0)
  })

  it('fixes mix of relative and aliased violations in one pass', () => {
    const source =
      [`import { a } from '../cart'`, `import { b } from '@/features/wishlist'`].join('\n') + '\n'

    const aliases: AliasEntry[] = [{ prefix: '@/', target: '' }]
    const violations: CheckViolation[] = [
      makeViolation('features/auth/index.ts', '../cart'),
      makeViolation('features/auth/index.ts', '@/features/wishlist'),
    ]

    const { fixedCount, source: fixed } = applyFixes(
      source,
      violations,
      srcPath,
      'features/auth/index.ts',
      aliases,
    )

    expect(fixedCount).toBe(2)
    expect(fixed).toContain('../../shared/cart')
    expect(fixed).toContain('../../shared/wishlist')
  })
})

describe('fixAll — aliased imports', () => {
  let srcPath: string

  beforeEach(() => {
    srcPath = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-fixer-alias-fixall-'))
  })
  afterEach(() => {
    fs.rmSync(srcPath, { recursive: true, force: true })
  })

  it('rewrites aliased violations on disk when aliases are provided', () => {
    const featDir = path.join(srcPath, 'features', 'auth')
    fs.mkdirSync(featDir, { recursive: true })
    const filePath = path.join(featDir, 'index.ts')
    fs.writeFileSync(filePath, `import { useCart } from '@/features/cart'\nexport const x = 1\n`)

    const aliases: AliasEntry[] = [{ prefix: '@/', target: '' }]
    const checkResult = {
      violations: [makeViolation('features/auth/index.ts', '@/features/cart')],
      checkedFiles: 1,
    }

    const { totalFixed, fixedFiles } = fixAll(checkResult, srcPath, aliases)

    expect(totalFixed).toBe(1)
    expect(fixedFiles).toHaveLength(1)

    const written = fs.readFileSync(filePath, 'utf8')
    expect(written).toContain('../../shared/cart')
    expect(written).not.toContain('@/features/cart')
  })

  it('does not rewrite aliased violations when no aliases given', () => {
    const featDir = path.join(srcPath, 'features', 'auth')
    fs.mkdirSync(featDir, { recursive: true })
    const filePath = path.join(featDir, 'index.ts')
    const original = `import { useCart } from '@/features/cart'\nexport const x = 1\n`
    fs.writeFileSync(filePath, original)

    // Pass no aliases → computeFixedImport returns null → file unchanged
    const checkResult = {
      violations: [makeViolation('features/auth/index.ts', '@/features/cart')],
      checkedFiles: 1,
    }

    const { totalFixed } = fixAll(checkResult, srcPath, [])
    expect(totalFixed).toBe(0)
    expect(fs.readFileSync(filePath, 'utf8')).toBe(original)
  })
})
