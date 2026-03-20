import fs from 'node:fs'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { generateStats } from './index'

const tmpDir = path.join(__dirname, '.tmp-stats')

function write(relPath: string, content = '') {
  const fullPath = path.join(tmpDir, relPath)
  fs.mkdirSync(path.dirname(fullPath), { recursive: true })
  fs.writeFileSync(fullPath, content, 'utf8')
}

describe('statsCommand', () => {
  beforeEach(() => {
    fs.mkdirSync(tmpDir, { recursive: true })
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('generates correct fsd stats', () => {
    write('features/auth/ui/LoginForm.tsx')
    write('features/auth/model/selectors.ts')
    write('features/search/index.ts')
    write('entities/user/ui/UserCard.tsx')
    write('shared/ui/button.tsx')
    write('shared/ui/input.tsx')
    write('app/index.ts')

    const stats = generateStats(tmpDir, 'fsd')

    expect(stats.totalFiles).toBe(7)

    expect(stats.layers['features']).toBeDefined()
    expect(stats.layers['features'].fileCount).toBe(3)
    expect(stats.layers['features'].slices.size).toBe(2) // auth, search
    expect(stats.layers['features'].slices.has('auth')).toBe(true)
    expect(stats.layers['features'].slices.has('search')).toBe(true)

    expect(stats.layers['entities']).toBeDefined()
    expect(stats.layers['entities'].fileCount).toBe(1)
    expect(stats.layers['entities'].slices.size).toBe(1) // user

    expect(stats.layers['shared']).toBeDefined()
    expect(stats.layers['shared'].fileCount).toBe(2)
    // For 'shared', the first level directory acts like a "slice" visually
    expect(stats.layers['shared'].slices.size).toBe(1) // ui

    expect(stats.layers['app']).toBeDefined()
    expect(stats.layers['app'].fileCount).toBe(1)
    expect(stats.layers['app'].slices.size).toBe(0) // root level file
  })

  it('generates correct modular stats', () => {
    write('modules/user/index.ts')
    write('modules/user/profile.tsx')
    write('modules/auth/index.ts')
    write('shared/lib/helper.ts')
    write('core/index.ts')

    const stats = generateStats(tmpDir, 'modular')

    expect(stats.totalFiles).toBe(5)

    expect(stats.layers['modules']).toBeDefined()
    expect(stats.layers['modules'].fileCount).toBe(3)
    expect(stats.layers['modules'].slices.size).toBe(2) // user, auth

    expect(stats.layers['shared']).toBeDefined()
    expect(stats.layers['shared'].fileCount).toBe(1)
    expect(stats.layers['shared'].slices.size).toBe(1) // lib

    expect(stats.layers['core']).toBeDefined()
    expect(stats.layers['core'].fileCount).toBe(1)
    expect(stats.layers['core'].slices.size).toBe(0)
  })
})
