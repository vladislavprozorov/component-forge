import os from 'node:os'
import path from 'node:path'

import fs from 'fs-extra'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { loadProjectConfig, CONFIG_FILENAMES, writeProjectConfig } from './config'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'forge-config-test-'))
}

// ---------------------------------------------------------------------------
// loadProjectConfig
// ---------------------------------------------------------------------------

describe('loadProjectConfig', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = makeTmpDir()
  })

  afterEach(() => {
    fs.removeSync(tmpDir)
  })

  // -------------------------------------------------------------------------
  // Legacy JSON — backwards compatibility
  // -------------------------------------------------------------------------

  describe('legacy .component-forge.json', () => {
    it('loads config from JSON file', () => {
      fs.writeJsonSync(path.join(tmpDir, CONFIG_FILENAMES.json), {
        architecture: 'fsd',
        srcDir: 'src',
      })

      const config = loadProjectConfig(tmpDir)
      expect(config.architecture).toBe('fsd')
      expect(config.srcDir).toBe('src')
    })

    it('loads modular architecture from JSON', () => {
      fs.writeJsonSync(path.join(tmpDir, CONFIG_FILENAMES.json), {
        architecture: 'modular',
        srcDir: 'app',
      })

      const config = loadProjectConfig(tmpDir)
      expect(config.architecture).toBe('modular')
      expect(config.srcDir).toBe('app')
    })

    it('preserves optional templates field', () => {
      fs.writeJsonSync(path.join(tmpDir, CONFIG_FILENAMES.json), {
        architecture: 'fsd',
        srcDir: 'src',
        templates: '.forge-templates',
      })

      const config = loadProjectConfig(tmpDir)
      expect(config.templates).toBe('.forge-templates')
    })
  })

  // -------------------------------------------------------------------------
  // forge.config.ts — TypeScript config
  // -------------------------------------------------------------------------

  describe('forge.config.ts', () => {
    it('loads config from TypeScript file and prefers it over JSON', () => {
      // Write both — TS should win
      fs.writeJsonSync(path.join(tmpDir, CONFIG_FILENAMES.json), {
        architecture: 'modular',
        srcDir: 'legacy',
      })

      fs.writeFileSync(
        path.join(tmpDir, CONFIG_FILENAMES.ts),
        `const config = { architecture: 'fsd', srcDir: 'src' }; module.exports = config;`,
      )

      const config = loadProjectConfig(tmpDir)
      expect(config.architecture).toBe('fsd')
      expect(config.srcDir).toBe('src')
    })

    it('loads config from forge.config.ts with default export', () => {
      fs.writeFileSync(
        path.join(tmpDir, CONFIG_FILENAMES.ts),
        [
          `const config = { architecture: 'modular', srcDir: 'app' };`,
          `module.exports = { default: config };`,
        ].join('\n'),
      )

      const config = loadProjectConfig(tmpDir)
      expect(config.architecture).toBe('modular')
      expect(config.srcDir).toBe('app')
    })
  })

  // -------------------------------------------------------------------------
  // Error cases
  // -------------------------------------------------------------------------

  describe('error handling', () => {
    it('exits with code 1 when no config file exists', () => {
      expect(() => loadProjectConfig(tmpDir)).toThrow()
    })
  })
})

// ---------------------------------------------------------------------------
// writeProjectConfig
// ---------------------------------------------------------------------------

describe('writeProjectConfig', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = makeTmpDir()
  })

  afterEach(() => {
    fs.removeSync(tmpDir)
  })

  it('writes .component-forge.json', () => {
    writeProjectConfig({ architecture: 'fsd', srcDir: 'src' }, tmpDir)
    const jsonPath = path.join(tmpDir, CONFIG_FILENAMES.json)
    expect(fs.existsSync(jsonPath)).toBe(true)
  })

  it('written JSON is readable back', () => {
    writeProjectConfig({ architecture: 'modular', srcDir: 'app' }, tmpDir)
    const config = loadProjectConfig(tmpDir)
    expect(config.architecture).toBe('modular')
    expect(config.srcDir).toBe('app')
  })
})
