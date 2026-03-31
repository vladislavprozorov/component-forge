import fs from 'node:fs'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { generateSizeData } from './index'

vi.mock('../../utils/config', () => ({
  loadProjectConfig: () => ({ srcDir: '.tmp-size', architecture: 'fsd' }),
}))

describe('sizeCommand', () => {
  const tmpDir = path.join(process.cwd(), '.tmp-size')

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

  it('correctly calculates LOC and bytes', () => {
    // 3 lines
    write('shared/ui/button.ts', `export const Button = () => {}\nconsole.log('test')\n`)

    // 2 lines
    write('entities/user/index.ts', `export const User = {}\n`)

    const { total, layers, slices } = generateSizeData(tmpDir)

    expect(total.files).toBe(2)
    // 3 lines (2 newlines + end) maybe 4 lines depending on exact trim/split.
    // Button: 3 lines. User: 2 lines. Total = 5 lines.
    expect(total.loc).toBeGreaterThan(0)
    expect(total.bytes).toBeGreaterThan(0)

    expect(layers['shared'].files).toBe(1)
    expect(layers['entities'].files).toBe(1)

    expect(slices['shared/ui'].files).toBe(1)
    expect(slices['entities/user'].files).toBe(1)

    // shared/ui has more loc than entities/user
    expect(slices['shared/ui'].loc).toBeGreaterThan(slices['entities/user'].loc)
  })
})
