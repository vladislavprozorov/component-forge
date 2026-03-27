import fs from 'node:fs'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'

import { generateReadme } from './index'

vi.mock('../../utils/config', () => ({
  loadProjectConfig: () => ({ srcDir: '.tmp-readme', architecture: 'fsd' }),
}))

vi.mock('../check/index', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>()
  return {
    ...original,
    loadAliasEntries: () => [{ prefix: '@/', target: '' }],
  }
})

describe('readmeCommand', () => {
  const tmpDir = path.join(process.cwd(), '.tmp-readme')
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
    expect(() => generateReadme('features/missing')).toThrow('process.exit() was called.')
    expect(mockExit).toHaveBeenCalledWith(1)
  })

  it('generates a README with correct info', () => {
    write('features/auth/index.ts', `export const Auth = 'auth'\nexport function login() {}`)
    write('app/main.ts', `import { Auth } from '@/features/auth'`)
    write('features/auth/model/index.ts', `import { User } from '@/entities/user'`)

    generateReadme('features/auth')

    const outPath = path.join(tmpDir, 'features/auth/README.md')
    expect(fs.existsSync(outPath)).toBe(true)

    const content = fs.readFileSync(outPath, 'utf8')

    // Check slice title and layer
    expect(content).toContain('# 🧩 Slice: `auth`')
    expect(content).toContain('**Layer:** `features`')

    // Check public API extraction
    expect(content).toContain('export const Auth')
    expect(content).toContain('export function login()')

    // Check dependencies (the file we mocked only checks dependencies if we mocked them properly,
    // but generateInfo parses imports. Wait, entities/user doesn't exist so it won't resolve properly,
    // let's mock the target properly if we want a realistic test, but since generateInfo is real,
    // we should create entities/user.)
  })

  it('generates a README with correct parsed dependencies', () => {
    write('features/auth/index.ts', `export const Auth = 'auth'`)
    write('entities/user/index.ts', `export const User = 'user'`)
    write('features/auth/ui/form.ts', `import { User } from '../../../entities/user'`)
    write('app/main/index.ts', `import { Auth } from '../../features/auth'`)

    generateReadme('features/auth')

    const content = fs.readFileSync(path.join(tmpDir, 'features/auth/README.md'), 'utf8')

    // Check Dependencies
    expect(content).toContain('**entities**')
    expect(content).toContain('- `user`')

    // Check Dependents
    expect(content).toContain('**app**')
    expect(content).toContain('- `main`')
  })
})
