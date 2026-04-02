import fs from 'node:fs'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { generateReport } from './index'

vi.mock('../../utils/config', () => ({
  loadProjectConfig: () => ({ srcDir: '.tmp-report', architecture: 'fsd' }),
}))

describe('reportCommand', () => {
  const tmpDir = path.join(process.cwd(), '.tmp-report')

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
    fs.writeFileSync(fullPath, content.trim() + '\n', 'utf8')
  }

  it('generates a JSON report object with stats and metrics', () => {
    write('shared/ui/button.ts', `export const Button = () => {}`)
    write(
      'entities/user/index.ts',
      `import { Button } from '../../shared/ui/button'; export const User = {}`,
    )

    const aliases = [{ prefix: '@/', target: '' }]
    const report = generateReport(tmpDir, 'fsd', aliases)

    expect(report).toHaveProperty('meta')
    expect(report).toHaveProperty('stats')
    expect(report).toHaveProperty('metrics')

    // basic sanity checks
    expect(report.stats.totalFiles).toBeGreaterThan(0)
    expect(Object.keys(report.metrics).length).toBeGreaterThan(0)
  })
})
