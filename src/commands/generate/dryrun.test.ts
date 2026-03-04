import os from 'node:os'
import path from 'node:path'

import fs from 'fs-extra'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { generateCommand, printFilePreview } from './index'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string

function setupProject(architecture: 'fsd' | 'modular' = 'fsd'): void {
  fs.writeFileSync(
    path.join(tmpDir, 'forge.config.ts'),
    `export default { architecture: '${architecture}', srcDir: 'src' }`,
  )
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-dryrun-'))
  vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
})

afterEach(() => {
  vi.restoreAllMocks()
  fs.removeSync(tmpDir)
})

// ---------------------------------------------------------------------------
// printFilePreview — unit tests
// ---------------------------------------------------------------------------

describe('printFilePreview', () => {
  it('prints the file path in the header line', () => {
    const logs: string[] = []
    vi.spyOn(console, 'log').mockImplementation((...args) => logs.push(String(args[0])))

    printFilePreview('src/features/auth/index.ts', "export { Auth } from './ui/Auth'")

    const header = logs.find((l) => l.includes('src/features/auth/index.ts'))
    expect(header).toBeDefined()
  })

  it('prints each line of the content', () => {
    const logs: string[] = []
    vi.spyOn(console, 'log').mockImplementation((...args) => logs.push(String(args[0])))

    printFilePreview('src/features/auth/index.ts', 'line one\nline two\nline three')

    const allOutput = logs.join('\n')
    expect(allOutput).toContain('line one')
    expect(allOutput).toContain('line two')
    expect(allOutput).toContain('line three')
  })

  it('trims trailing blank lines from content', () => {
    const logs: string[] = []
    vi.spyOn(console, 'log').mockImplementation((...args) => logs.push(String(args[0])))

    printFilePreview('path/to/file.ts', 'content\n\n\n')

    // Only one content line should appear (blank trailing lines stripped)
    const contentLines = logs.filter((l) => l.includes('│'))
    expect(contentLines).toHaveLength(1)
    expect(contentLines[0]).toContain('content')
  })

  it('handles empty content without throwing', () => {
    const logs: string[] = []
    vi.spyOn(console, 'log').mockImplementation((...args) => logs.push(String(args[0])))

    expect(() => printFilePreview('path/to/file.ts', '')).not.toThrow()
    // Header + footer should still be printed
    expect(logs.some((l) => l.includes('┌─'))).toBe(true)
    expect(logs.some((l) => l.includes('└─'))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// generateCommand dry-run — integration
// ---------------------------------------------------------------------------

describe('generateCommand — dry-run', () => {
  it('does NOT create files on disk', () => {
    setupProject('fsd')
    const logs: string[] = []
    vi.spyOn(console, 'log').mockImplementation((...args) => logs.push(String(args[0])))

    generateCommand('feature', 'auth', { dryRun: true })

    const slicePath = path.join(tmpDir, 'src', 'features', 'auth')
    expect(fs.existsSync(slicePath)).toBe(false)
  })

  it('prints file content preview — contains ┌─ header and └─ footer', () => {
    setupProject('fsd')
    const logs: string[] = []
    vi.spyOn(console, 'log').mockImplementation((...args) => logs.push(String(args[0])))

    generateCommand('feature', 'auth', { dryRun: true })

    expect(logs.some((l) => l.includes('┌─'))).toBe(true)
    expect(logs.some((l) => l.includes('└─'))).toBe(true)
  })

  it('shows slice type and name in dry-run header', () => {
    setupProject('fsd')
    const logs: string[] = []
    vi.spyOn(console, 'log').mockImplementation((...args) => logs.push(String(args[0])))

    generateCommand('feature', 'auth', { dryRun: true })

    const allOutput = logs.join('\n')
    expect(allOutput).toContain('feature')
    expect(allOutput).toContain('auth')
  })

  it('shows how many files would be created', () => {
    setupProject('fsd')
    const logs: string[] = []
    vi.spyOn(console, 'log').mockImplementation((...args) => logs.push(String(args[0])))

    generateCommand('feature', 'auth', { dryRun: true })

    const allOutput = logs.join('\n')
    expect(allOutput).toMatch(/\d+ file\(s\) would be created/)
  })

  it('shows index.ts preview content (has "export" keyword)', () => {
    setupProject('fsd')
    const logs: string[] = []
    vi.spyOn(console, 'log').mockImplementation((...args) => logs.push(String(args[0])))

    generateCommand('feature', 'auth', { dryRun: true })

    const allOutput = logs.join('\n')
    expect(allOutput).toContain('export')
  })

  it('works for entity slice type', () => {
    setupProject('fsd')
    const logs: string[] = []
    vi.spyOn(console, 'log').mockImplementation((...args) => logs.push(String(args[0])))

    generateCommand('entity', 'user', { dryRun: true })

    const allOutput = logs.join('\n')
    expect(allOutput).toContain('entity')
    expect(allOutput).toContain('user')
    expect(allOutput).toMatch(/\d+ file\(s\) would be created/)
    expect(fs.existsSync(path.join(tmpDir, 'src', 'entities', 'user'))).toBe(false)
  })

  it('works for modular architecture module slice', () => {
    setupProject('modular')
    const logs: string[] = []
    vi.spyOn(console, 'log').mockImplementation((...args) => logs.push(String(args[0])))

    generateCommand('module', 'profile', { dryRun: true })

    const allOutput = logs.join('\n')
    expect(allOutput).toContain('module')
    expect(allOutput).toContain('profile')
    expect(fs.existsSync(path.join(tmpDir, 'src', 'modules', 'profile'))).toBe(false)
  })

  it('shows the target path in the output', () => {
    setupProject('fsd')
    const logs: string[] = []
    vi.spyOn(console, 'log').mockImplementation((...args) => logs.push(String(args[0])))

    generateCommand('feature', 'auth', { dryRun: true })

    const allOutput = logs.join('\n')
    // Target path should contain 'features/auth'
    expect(allOutput).toContain(path.join('features', 'auth'))
  })
})
