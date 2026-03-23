import fs from 'node:fs'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { findCycles } from './index'

const tmpDir = path.join(__dirname, '.tmp-cycles')

function write(relPath: string, content = '') {
  const fullPath = path.join(tmpDir, relPath)
  fs.mkdirSync(path.dirname(fullPath), { recursive: true })
  fs.writeFileSync(fullPath, content, 'utf8')
}

describe('cyclesCommand', () => {
  beforeEach(() => {
    fs.mkdirSync(tmpDir, { recursive: true })
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('detects simple cycles', () => {
    // user depends on post
    write(
      'entities/user/index.ts',
      `
import { post } from '../post/index'
      `,
    )

    // post depends on user
    write(
      'entities/post/index.ts',
      `
import { user } from '../user/index'
      `,
    )

    const cycles = findCycles(tmpDir, [])

    expect(cycles).toHaveLength(1)
    expect(cycles[0]).toContain('entities/user')
    expect(cycles[0]).toContain('entities/post')
  })

  it('detects longer cycles (3 nodes)', () => {
    write('features/a/index.ts', `import { b } from '../b/index'`)
    write('features/b/index.ts', `import { c } from '../c/index'`)
    write('features/c/index.ts', `import { a } from '../a/index'`)

    const cycles = findCycles(tmpDir, [])

    expect(cycles).toHaveLength(1)
    expect(cycles[0]).toHaveLength(3)
    expect(cycles[0]).toContain('features/a')
    expect(cycles[0]).toContain('features/b')
    expect(cycles[0]).toContain('features/c')
  })

  it('ignores self-imports', () => {
    write('features/auth/index.ts', `import { helper } from './helper'`)
    write('features/auth/helper.ts', `import { core } from './index'`)

    const cycles = findCycles(tmpDir, [])

    expect(cycles).toHaveLength(0) // same slice!
  })
})
