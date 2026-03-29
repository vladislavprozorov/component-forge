import fs from 'node:fs'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { buildTree, generateTree } from './index'

vi.mock('../../utils/config', () => ({
  loadProjectConfig: () => ({ srcDir: '.tmp-tree', architecture: 'fsd' }),
}))

describe('treeCommand', () => {
  const tmpDir = path.join(process.cwd(), '.tmp-tree')

  beforeEach(() => {
    fs.mkdirSync(tmpDir, { recursive: true })
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    vi.clearAllMocks()
  })

  function write(relPath: string) {
    const fullPath = path.join(tmpDir, relPath)
    fs.mkdirSync(fullPath, { recursive: true })
    fs.writeFileSync(path.join(fullPath, 'index.ts'), '')
  }

  it('builds correct tree structure up to max depth', () => {
    write('features/auth/ui')
    write('features/auth/model')
    write('shared/ui/button')
    // empty folder
    write('entities')

    // add files to entities so it shows up? buildTree filters out if no children/files
    fs.writeFileSync(path.join(tmpDir, 'entities', 'index.ts'), '')

    const tree = buildTree(tmpDir, 3)

    // Expect Order: features -> entities -> shared
    expect(tree[0].name).toBe('features')
    expect(tree[1].name).toBe('entities')
    expect(tree[2].name).toBe('shared')

    expect(tree[0].children[0].name).toBe('auth')
    expect(tree[0].children[0].children.length).toBe(2) // ui, model
  })

  it('returns valid string from generateTree', () => {
    write('features/auth')
    const out = generateTree(tmpDir, 2, true)

    expect(out).toContain('📁 .tmp-tree/')
    expect(out).toMatch(/└── .*(?:features).*/)
  })
})
