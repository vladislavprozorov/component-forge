import fs from 'node:fs'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { moveCommand } from './index'

// We will mock the config and check loading
vi.mock('../../utils/config', () => ({
  loadProjectConfig: () => ({ srcDir: '.tmp-move', architecture: 'fsd' }),
}))

vi.mock('../check/index', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>()
  return {
    ...original,
    loadAliasEntries: () => [{ prefix: '@/', target: '' }],
  }
})

describe('moveCommand', () => {
  const tmpDir = path.join(process.cwd(), '.tmp-move')

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

  function read(relPath: string) {
    return fs.readFileSync(path.join(tmpDir, relPath), 'utf8').trim()
  }

  it('moves a slice and updates aliased imports outside', () => {
    write('features/auth/index.ts', `export const Auth = 'auth'`)
    write('app/main.ts', `import { Auth } from '@/features/auth'\nconsole.log(Auth)`)

    moveCommand('features/auth', 'widgets/auth-form', { dryRun: false })

    expect(fs.existsSync(path.join(tmpDir, 'features/auth/index.ts'))).toBe(false)
    expect(fs.existsSync(path.join(tmpDir, 'widgets/auth-form/index.ts'))).toBe(true)

    const mainApp = read('app/main.ts')
    expect(mainApp).toBe(`import { Auth } from '@/widgets/auth-form'\nconsole.log(Auth)`)
  })

  it('updates relative imports pointing to the moved slice from outside', () => {
    write('features/auth/ui/button.ts', `export const Btn = 'btn'`)
    write('pages/login/index.ts', `import { Btn } from '../../features/auth/ui/button'`)

    moveCommand('features/auth', 'widgets/auth-form', { dryRun: false })

    const pageContent = read('pages/login/index.ts')
    // new path should be '../../widgets/auth-form/ui/button'
    expect(pageContent).toContain(`import { Btn } from '../../widgets/auth-form/ui/button'`)
  })
})
