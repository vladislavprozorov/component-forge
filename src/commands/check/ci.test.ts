import { describe, it, expect } from 'vitest'

import { type CheckViolation, escapeCiValue, formatCiAnnotations } from './index'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeViolation(
  file: string,
  importPath: string,
  message = 'Layer "features" must not import from "features"',
  hint = 'Extract shared logic to shared/',
): CheckViolation {
  return { file, importPath, message, hint }
}

// ---------------------------------------------------------------------------
// escapeCiValue
// ---------------------------------------------------------------------------

describe('escapeCiValue', () => {
  it('leaves plain ASCII strings unchanged', () => {
    expect(escapeCiValue('hello world')).toBe('hello world')
  })

  it('encodes % as %25', () => {
    expect(escapeCiValue('100%')).toBe('100%25')
  })

  it('encodes carriage return as %0D', () => {
    expect(escapeCiValue('line1\rline2')).toBe('line1%0Dline2')
  })

  it('encodes newline as %0A', () => {
    expect(escapeCiValue('line1\nline2')).toBe('line1%0Aline2')
  })

  it('encodes colon as %3A to avoid breaking ::command syntax', () => {
    expect(escapeCiValue('must not: import')).toBe('must not%3A import')
  })

  it('encodes comma as %2C to avoid breaking key=value,key=value syntax', () => {
    expect(escapeCiValue('a,b')).toBe('a%2Cb')
  })

  it('encodes multiple special characters in one string', () => {
    const input = 'feat/auth: 100% done,\nnew line'
    const result = escapeCiValue(input)
    expect(result).not.toContain(':')
    expect(result).not.toContain(',')
    expect(result).not.toContain('\n')
    expect(result).not.toContain('%\n') // % alone (not yet encoded) should not appear
  })

  it('returns empty string for empty input', () => {
    expect(escapeCiValue('')).toBe('')
  })
})

// ---------------------------------------------------------------------------
// formatCiAnnotations
// ---------------------------------------------------------------------------

describe('formatCiAnnotations', () => {
  it('returns an empty array for zero violations', () => {
    expect(formatCiAnnotations([])).toEqual([])
  })

  it('returns one annotation string per violation', () => {
    const v = makeViolation('features/auth/index.ts', '../cart')
    const result = formatCiAnnotations([v])
    expect(result).toHaveLength(1)
  })

  it('annotation starts with ::error', () => {
    const v = makeViolation('features/auth/index.ts', '../cart')
    const [line] = formatCiAnnotations([v])
    expect(line).toMatch(/^::error /)
  })

  it('annotation contains file= with the violation file path', () => {
    const v = makeViolation('features/auth/index.ts', '../cart')
    const [line] = formatCiAnnotations([v])
    expect(line).toContain('file=features/auth/index.ts')
  })

  it('annotation contains line=1', () => {
    const v = makeViolation('features/auth/index.ts', '../cart')
    const [line] = formatCiAnnotations([v])
    expect(line).toContain('line=1')
  })

  it('annotation contains title=Architecture violation', () => {
    const v = makeViolation('features/auth/index.ts', '../cart')
    const [line] = formatCiAnnotations([v])
    // title value is escaped so colon → %3A
    expect(line).toContain('title=Architecture violation')
  })

  it('annotation body contains the violation message', () => {
    const v = makeViolation('features/auth/index.ts', '../cart', 'Layer X must not import Y', 'move to shared/')
    const [line] = formatCiAnnotations([v])
    // colons are escaped in the body
    const decoded = line.replace(/%3A/g, ':').replace(/%2C/g, ',').replace(/%0A/g, '\n')
    expect(decoded).toContain('Layer X must not import Y')
  })

  it('annotation body contains the violation hint', () => {
    const v = makeViolation('features/auth/index.ts', '../cart', 'msg', 'Extract to shared/')
    const [line] = formatCiAnnotations([v])
    expect(line).toContain('Extract to shared/')
  })

  it('body uses " — " as separator between message and hint', () => {
    const v = makeViolation('features/auth/index.ts', '../cart', 'MSG', 'HINT')
    const [line] = formatCiAnnotations([v])
    // separator " — " contains no special chars — should be intact
    expect(line).toContain('MSG \u2014 HINT')
  })

  it('produces a separate annotation for each violation', () => {
    const violations = [
      makeViolation('features/auth/index.ts', '../cart'),
      makeViolation('entities/user/index.ts', '../../features/auth'),
      makeViolation('shared/ui/index.ts', '../features/auth'),
    ]
    const result = formatCiAnnotations(violations)
    expect(result).toHaveLength(3)
    expect(result[0]).toContain('features/auth/index.ts')
    expect(result[1]).toContain('entities/user/index.ts')
    expect(result[2]).toContain('shared/ui/index.ts')
  })

  it('escapes special characters in the file path', () => {
    // Unlikely in practice but the escaper must handle it
    const v = makeViolation('features/auth%special/index.ts', '../cart')
    const [line] = formatCiAnnotations([v])
    expect(line).toContain('features/auth%25special/index.ts')
  })
})
