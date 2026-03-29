import fs from 'node:fs'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { generateMetrics } from './index'

vi.mock('../../utils/config', () => ({
  loadProjectConfig: () => ({ srcDir: '.tmp-metrics', architecture: 'fsd' }),
}))

describe('metricsCommand', () => {
  const tmpDir = path.join(process.cwd(), '.tmp-metrics')

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

  it('correctly calculates CE, CA, and Instability', () => {
    // shared depends on nothing. (Ce=0, Ca=2) => I=0.0
    write('shared/ui/button.ts', `export const Button = () => {}`)

    // entities depends on shared (Ce=1, Ca=1) => I=0.5
    write(
      'entities/user/index.ts',
      `import { Button } from '../../shared/ui/button'; export const User = {}`,
    )

    // features depends on entities and shared (Ce=2, Ca=0) => I=1.0
    write(
      'features/auth/index.ts',
      `import { User } from '../../entities/user'\nimport { Button } from '../../shared/ui/button'`,
    )

    const aliases = [{ prefix: '@/', target: '' }]
    const metrics = generateMetrics(tmpDir, aliases)

    // Check shared/ui
    expect(metrics['shared/ui'].ce).toBe(0)
    expect(metrics['shared/ui'].ca).toBe(2)
    expect(metrics['shared/ui'].instability).toBe(0)

    // Check entities/user
    expect(metrics['entities/user'].ce).toBe(1)
    expect(metrics['entities/user'].ca).toBe(1)
    expect(metrics['entities/user'].instability).toBe(0.5)

    // Check features/auth
    expect(metrics['features/auth'].ce).toBe(2)
    expect(metrics['features/auth'].ca).toBe(0)
    expect(metrics['features/auth'].instability).toBe(1)
  })

  it('handles isolated slices with N/A instability', () => {
    write('features/isolated/index.ts', `export const isolated = true`)
    const metrics = generateMetrics(tmpDir, [])

    expect(metrics['features/isolated'].ce).toBe(0)
    expect(metrics['features/isolated'].ca).toBe(0)
    expect(metrics['features/isolated'].instability).toBeNull()
  })
})
