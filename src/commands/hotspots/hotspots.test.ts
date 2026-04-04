import fs from 'node:fs'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { generateHotspots } from './index'

// Mock child_process execSync to simulate git output
vi.mock('node:child_process', () => ({
  execSync: vi.fn().mockImplementation((cmd: string) => {
    if (cmd.includes('git log')) {
      // Simulate git output for these two files
      return [
        'shared/ui/button.ts',
        'shared/ui/button.ts',
        'entities/user/index.ts',
        '',
        'shared/ui/button.ts', // 3 commits for button, 1 for user
      ].join('\n')
    }
    return ''
  }),
}))

vi.mock('../../utils/config', () => ({
  loadProjectConfig: () => ({ srcDir: '.tmp-hotspots', architecture: 'fsd' }),
}))

// Mock logger.error and process.exit to not kill the test runner
vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}))

describe('hotspotsCommand', () => {
  const tmpDir = path.join(process.cwd(), '.tmp-hotspots')

  beforeEach(() => {
    fs.mkdirSync(tmpDir, { recursive: true })
    vi.spyOn(process, 'exit').mockImplementation((() => {}) as unknown as (
      code?: string | number | null,
    ) => never)
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  function write(relPath: string, content: string) {
    const fullPath = path.join(tmpDir, relPath)
    fs.mkdirSync(path.dirname(fullPath), { recursive: true })
    fs.writeFileSync(fullPath, content.trim() + '\n', 'utf8')
  }

  it('aggregates commits and calculates risk score', () => {
    write('shared/ui/button.ts', `// button code\n// line 2`) // 2 loc
    write('entities/user/index.ts', `// user code`) // 1 loc

    const slices = generateHotspots(tmpDir)

    // Check slice extraction
    expect(slices['shared/ui']).toBeDefined()
    expect(slices['entities/user']).toBeDefined()

    // Check commits aggregation (simulated: 3 for button, 1 for user)
    expect(slices['shared/ui'].commits).toBe(3)
    expect(slices['entities/user'].commits).toBe(1)

    // Check LOC aggregation
    expect(slices['shared/ui'].loc).toBe(3)
    expect(slices['entities/user'].loc).toBe(2)

    // Check generated Score (loc * commits)
    expect(slices['shared/ui'].score).toBe(9) // 3 * 3
    expect(slices['entities/user'].score).toBe(2) // 2 * 1
  })
})
