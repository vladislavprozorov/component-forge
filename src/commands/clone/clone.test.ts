import fs from 'node:fs'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { cloneCommand } from './index'

vi.mock('../../utils/config', () => ({
  loadProjectConfig: () => ({ srcDir: '.tmp-clone', architecture: 'fsd' }),
}))

// Mock logger.error and process.exit to not kill the test runner
vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe('cloneCommand', () => {
  const tmpDir = path.join(process.cwd(), '.tmp-clone')

  beforeEach(() => {
    fs.mkdirSync(tmpDir, { recursive: true })
    vi.spyOn(process, 'exit').mockImplementation((() => {}) as unknown as (
      code?: string | number | null,
    ) => never)
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  function write(relPath: string, content: string) {
    const fullPath = path.join(tmpDir, relPath)
    fs.mkdirSync(path.dirname(fullPath), { recursive: true })
    fs.writeFileSync(fullPath, content.trim() + '\n', 'utf8')
  }

  function read(relPath: string) {
    return fs.readFileSync(path.join(tmpDir, relPath), 'utf8')
  }

  function exists(relPath: string) {
    return fs.existsSync(path.join(tmpDir, relPath))
  }

  it('clones a directory and replaces names correctly', () => {
    write(
      'features/auth/index.ts',
      `export * from './ui/AuthPanel';\nexport const authStatus = true;`,
    )
    write('features/auth/ui/AuthPanel.tsx', `export const AuthPanel = () => <div>auth</div>`)

    cloneCommand('features/auth', 'features/user', {})

    // Check old files are untouched
    expect(exists('features/auth/ui/AuthPanel.tsx')).toBe(true)

    // Check new files exist and are renamed
    expect(exists('features/user/index.ts')).toBe(true)
    expect(exists('features/user/ui/UserPanel.tsx')).toBe(true)

    // Check string replacements
    const indexContent = read('features/user/index.ts')
    expect(indexContent).toContain(`export * from './ui/UserPanel';`)
    expect(indexContent).toContain(`export const userStatus = true;`)

    const panelContent = read('features/user/ui/UserPanel.tsx')
    expect(panelContent).toContain(`export const UserPanel = () => <div>user</div>`)
  })
})
