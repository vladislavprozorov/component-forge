import fs from 'node:fs'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'

import { removeCommand } from './index'

vi.mock('../../utils/config', () => ({
  loadProjectConfig: () => ({ srcDir: '.tmp-remove', architecture: 'fsd' }),
}))

vi.mock('../check/index', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>()
  return {
    ...original,
    loadAliasEntries: () => [{ prefix: '@/', target: '' }],
  }
})

describe('removeCommand', () => {
  const tmpDir = path.join(process.cwd(), '.tmp-remove')
  let mockExit: MockInstance

  beforeEach(() => {
    fs.mkdirSync(tmpDir, { recursive: true })
    mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit() was called.')
    })
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    vi.clearAllMocks()
    mockExit.mockRestore()
  })

  function write(relPath: string, content: string) {
    const fullPath = path.join(tmpDir, relPath)
    fs.mkdirSync(path.dirname(fullPath), { recursive: true })
    fs.writeFileSync(fullPath, content.trim(), 'utf8')
  }

  it('fails if slice does not exist', () => {
    expect(() => removeCommand('features/missing', {})).toThrow('process.exit() was called.')
    expect(mockExit).toHaveBeenCalledWith(1)
  })

  it('removes slice successfully if it has no dependents', () => {
    write('features/auth/index.ts', `export const Auth = 'auth'`)

    removeCommand('features/auth', {})
    expect(fs.existsSync(path.join(tmpDir, 'features/auth'))).toBe(false)
    expect(mockExit).not.toHaveBeenCalled()
  })

  it('prevents removal if there are dependents (without force)', () => {
    write('features/auth/index.ts', `export const Auth = 'auth'`)
    write('app/main.ts', `import { Auth } from '@/features/auth'`)

    expect(() => removeCommand('features/auth', {})).toThrow('process.exit() was called.')

    // Directory should still exist
    expect(fs.existsSync(path.join(tmpDir, 'features/auth'))).toBe(true)
    expect(mockExit).toHaveBeenCalledWith(1)
  })

  it('removes slice if there are dependents but --force is used', () => {
    write('features/auth/index.ts', `export const Auth = 'auth'`)
    write('app/main.ts', `import { Auth } from '@/features/auth'`)

    removeCommand('features/auth', { force: true })

    expect(fs.existsSync(path.join(tmpDir, 'features/auth'))).toBe(false)
    expect(mockExit).not.toHaveBeenCalled()
  })
})
