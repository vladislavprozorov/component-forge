import fs from 'node:fs'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { generateDocs } from './index'

vi.mock('../../utils/config', () => ({
  loadProjectConfig: () => ({ srcDir: '.tmp-docs', architecture: 'fsd' }),
}))

vi.mock('../check/index', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>()
  return {
    ...original,
    loadAliasEntries: () => [{ prefix: '@/', target: '' }],
  }
})

describe('docsCommand', () => {
  const tmpDir = path.join(process.cwd(), '.tmp-docs')

  beforeEach(() => {
    fs.mkdirSync(tmpDir, { recursive: true })
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    vi.clearAllMocks()
  })

  function write(relPath: string, content: string) {
    const fullPath = path.join(tmpDir, relPath)
    fs.mkdirSync(path.dirname(fullPath), { recursive: true })
    fs.writeFileSync(fullPath, content.trim(), 'utf8')
  }

  it('generates an ARCHITECTURE.md file with stats and mermaid graph', () => {
    write('features/auth/index.ts', `export const Auth = 'auth'`)
    write('entities/user/index.ts', `export const User = 'user'`)
    write(
      'app/main.ts',
      `import { Auth } from '@/features/auth'\nimport { User } from '@/entities/user'`,
    )

    const outPath = path.join(tmpDir, 'ARCHITECTURE.md')
    generateDocs(outPath)

    expect(fs.existsSync(outPath)).toBe(true)

    const content = fs.readFileSync(outPath, 'utf8')
    expect(content).toContain('# Architecture Documentation')
    expect(content).toContain('**FSD**')
    expect(content).toContain('### `features`')
    expect(content).toContain('`auth`')
    expect(content).toContain('```mermaid')
    expect(content).toContain('graph TD')
    // App depends on features/auth and entities/user
    expect(content).toContain('app --> features_auth')
    expect(content).toContain('app --> entities_user')
  })
})
