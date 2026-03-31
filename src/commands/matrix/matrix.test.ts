import fs from 'node:fs'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { generateMatrix } from './index'

vi.mock('../../utils/config', () => ({
  loadProjectConfig: () => ({ srcDir: '.tmp-matrix', architecture: 'fsd' }),
}))

describe('matrixCommand', () => {
  const tmpDir = path.join(process.cwd(), '.tmp-matrix')

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

  it('correctly calculates DSM', () => {
    write('shared/ui/button.ts', `export const Button = () => {}`)

    write(
      'entities/user/index.ts',
      `import { Button } from '../../shared/ui/button'; export const User = {}`,
    )

    // User imports Button twice essentially for test? No, let's write 2 separate files in entity
    write(
      'entities/user/utils.ts',
      `import { Button } from '../../shared/ui/button'; export const util = {}`,
    )

    write(
      'features/auth/index.ts',
      `import { User } from '../../entities/user'\nimport { Button } from '../../shared/ui/button'`,
    )

    const aliases = [{ prefix: '@/', target: '' }]
    const { nodes, matrix } = generateMatrix(tmpDir, aliases)

    // Check we have nodes
    expect(nodes).toContain('shared/ui')
    expect(nodes).toContain('entities/user')
    expect(nodes).toContain('features/auth')

    // shared/ui has no dependencies
    expect(matrix['shared/ui']['entities/user']).toBe(0)
    expect(matrix['shared/ui']['features/auth']).toBe(0)

    // entities/user imports shared/ui twice
    expect(matrix['entities/user']['shared/ui']).toBe(2)

    // features/auth imports shared/ui once and entities/user once
    expect(matrix['features/auth']['shared/ui']).toBe(1)
    expect(matrix['features/auth']['entities/user']).toBe(1)
  })
})
