import fs from 'node:fs'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { generateInfo } from './index'

const tmpDir = path.join(__dirname, '.tmp-info')

function write(relPath: string, content = '') {
  const fullPath = path.join(tmpDir, relPath)
  fs.mkdirSync(path.dirname(fullPath), { recursive: true })
  fs.writeFileSync(fullPath, content, 'utf8')
}

describe('infoCommand', () => {
  beforeEach(() => {
    fs.mkdirSync(tmpDir, { recursive: true })
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('collects dependencies and dependents in fsd architecture', () => {
    // Entities
    write('entities/user/index.ts', 'export const user = {}')
    write('entities/post/index.ts', 'export const post = {}')

    // Shared
    write('shared/ui/button.ts', 'export const btn = {}')

    // Features
    write(
      'features/auth/ui.ts',
      `
import { user } from '../../entities/user/index'
import { btn } from '../../shared/ui/button'
      `,
    )

    // App (depends on features/auth)
    write(
      'app/index.ts',
      `
import { Auth } from '../features/auth/ui'
      `,
    )

    // Test feature/auth target
    const result = generateInfo(tmpDir, 'features/auth', 'fsd')

    expect(result.fileCount).toBe(1)

    // Dependencies of features/auth
    expect(result.dependencies['entities']).toContain('user')
    expect(result.dependencies['shared']).toContain('ui')

    // Dependents of features/auth
    expect(result.dependents['app']).toContain('<root>')
  })

  it('collects dependencies and dependents in modular architecture', () => {
    // Shared
    write('shared/lib/api.ts', 'export const api = {}')

    // Module User
    write(
      'modules/user/index.ts',
      `
import { api } from '../../shared/lib/api'
      `,
    )

    // Module Dashboard
    write(
      'modules/dashboard/index.ts',
      `
import { user } from '../user/index'
      `,
    )

    const result = generateInfo(tmpDir, 'modules/user', 'modular')

    expect(result.fileCount).toBe(1)

    // Dependencies
    expect(result.dependencies['shared']).toContain('lib')

    // Dependents
    expect(result.dependents['modules']).toContain('dashboard')
  })
})
