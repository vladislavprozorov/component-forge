import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { beforeEach, afterEach, describe, it, expect } from 'vitest'

import { findOrphans } from './index'

let tmpDir: string

function write(relPath: string, content: string): void {
  const full = path.join(tmpDir, relPath)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, content)
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-orphans-'))
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('findOrphans', () => {
  it('identifies unimported slices as orphans', () => {
    write('features/auth/index.ts', `export const auth = true`)
    write('entities/user/index.ts', `export const user = true`) // Orphan
    write('app/index.ts', `import { auth } from '../features/auth'`)

    const { orphanedNodes } = findOrphans(tmpDir, [])
    expect(orphanedNodes).toHaveLength(1)
    expect(orphanedNodes).toContain('entities/user')
  })

  it('ignores the app and core layers completely', () => {
    write('app/providers/index.ts', `export const providers = true`)
    write('core/router/index.ts', `export const router = true`)

    const { orphanedNodes } = findOrphans(tmpDir, [])
    expect(orphanedNodes).toHaveLength(0)
  })

  it('marks shared segments correctly', () => {
    write('shared/ui/Button/index.ts', `export const Button = () => null`) // Orphan
    write('shared/api/client.ts', `export const client = {}`) // Used
    write('features/auth/index.ts', `import { client } from '../../shared/api/client'`)
    write('app/index.ts', `import { auth } from '../features/auth'`)

    const { orphanedNodes } = findOrphans(tmpDir, [])
    expect(orphanedNodes).toContain('shared/ui')
    expect(orphanedNodes).not.toContain('shared/api')
    expect(orphanedNodes).not.toContain('features/auth')
  })

  it('resolves aliases correctly', () => {
    write('widgets/header/index.ts', `export const Header = () => null`)
    write('features/auth/index.ts', `export const auth = () => null`) // Orphan
    write('app/index.ts', `import { Header } from '@/widgets/header'`)

    const { orphanedNodes } = findOrphans(tmpDir, [{ prefix: '@/', target: '' }])
    expect(orphanedNodes).toContain('features/auth')
    expect(orphanedNodes).not.toContain('widgets/header')
  })
})

  it('treats files in root src as root layer and protects their imports', () => {
    write('features/auth/index.ts', `export const auth = true`)
    write('index.ts', `import { auth } from './features/auth'`) // Root entry file

    const { orphanedNodes } = findOrphans(tmpDir, [])
    expect(orphanedNodes).toHaveLength(0)
  })
