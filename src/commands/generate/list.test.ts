import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { getLayersForArchitecture, listSlices, scanLayerSlices } from './index'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'forge-list-'))
}

function mkdir(base: string, ...parts: string[]): void {
  fs.mkdirSync(path.join(base, ...parts), { recursive: true })
}

function touch(base: string, ...parts: string[]): void {
  const full = path.join(base, ...parts)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, '')
}

// ---------------------------------------------------------------------------
// getLayersForArchitecture
// ---------------------------------------------------------------------------

describe('getLayersForArchitecture', () => {
  it('returns all 7 FSD layers in correct order', () => {
    const layers = getLayersForArchitecture('fsd')
    expect(layers).toEqual([
      'app',
      'processes',
      'pages',
      'widgets',
      'features',
      'entities',
      'shared',
    ])
  })

  it('returns modular layers', () => {
    const layers = getLayersForArchitecture('modular')
    expect(layers).toEqual(['modules', 'shared', 'core'])
  })
})

// ---------------------------------------------------------------------------
// scanLayerSlices
// ---------------------------------------------------------------------------

describe('scanLayerSlices', () => {
  let tmp: string

  beforeEach(() => {
    tmp = makeTmpDir()
  })
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true })
  })

  it('returns empty array for non-existent directory', () => {
    expect(scanLayerSlices('/nonexistent/path')).toEqual([])
  })

  it('returns empty array for empty directory', () => {
    expect(scanLayerSlices(tmp)).toEqual([])
  })

  it('returns sorted directory names only (no files)', () => {
    mkdir(tmp, 'auth')
    mkdir(tmp, 'cart')
    mkdir(tmp, 'profile')
    touch(tmp, 'some-file.ts')

    expect(scanLayerSlices(tmp)).toEqual(['auth', 'cart', 'profile'])
  })

  it('sorts results alphabetically', () => {
    mkdir(tmp, 'zebra')
    mkdir(tmp, 'alpha')
    mkdir(tmp, 'middle')

    expect(scanLayerSlices(tmp)).toEqual(['alpha', 'middle', 'zebra'])
  })
})

// ---------------------------------------------------------------------------
// listSlices — FSD
// ---------------------------------------------------------------------------

describe('listSlices — FSD architecture', () => {
  let tmp: string

  beforeEach(() => {
    tmp = makeTmpDir()
  })
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true })
  })

  it('returns an entry for every FSD layer', () => {
    const result = listSlices(tmp, 'fsd')
    const layers = result.map((e) => e.layer)
    expect(layers).toEqual([
      'app',
      'processes',
      'pages',
      'widgets',
      'features',
      'entities',
      'shared',
    ])
  })

  it('reports empty slices for layers with no subdirs', () => {
    mkdir(tmp, 'features')
    // no slices inside features

    const result = listSlices(tmp, 'fsd')
    const features = result.find((e) => e.layer === 'features')!
    expect(features.slices).toEqual([])
  })

  it('lists slices inside a layer', () => {
    mkdir(tmp, 'features', 'auth')
    mkdir(tmp, 'features', 'cart')

    const result = listSlices(tmp, 'fsd')
    const features = result.find((e) => e.layer === 'features')!
    expect(features.slices).toEqual(['auth', 'cart'])
  })

  it('annotates shared/ui components with ui/ prefix', () => {
    mkdir(tmp, 'shared', 'ui', 'Button')
    mkdir(tmp, 'shared', 'ui', 'Input')

    const result = listSlices(tmp, 'fsd')
    const shared = result.find((e) => e.layer === 'shared')!
    expect(shared.slices).toContain('ui/Button')
    expect(shared.slices).toContain('ui/Input')
  })

  it('does not include "ui" as a plain slice when shared/ui has children', () => {
    mkdir(tmp, 'shared', 'ui', 'Button')

    const result = listSlices(tmp, 'fsd')
    const shared = result.find((e) => e.layer === 'shared')!
    // 'ui' as a raw entry should be removed — only ui/Button should appear
    expect(shared.slices).not.toContain('ui')
  })

  it('returns multiple layers populated simultaneously', () => {
    mkdir(tmp, 'features', 'auth')
    mkdir(tmp, 'entities', 'user')
    mkdir(tmp, 'widgets', 'Header')

    const result = listSlices(tmp, 'fsd')

    expect(result.find((e) => e.layer === 'features')!.slices).toEqual(['auth'])
    expect(result.find((e) => e.layer === 'entities')!.slices).toEqual(['user'])
    expect(result.find((e) => e.layer === 'widgets')!.slices).toEqual(['Header'])
  })
})

// ---------------------------------------------------------------------------
// listSlices — Modular architecture
// ---------------------------------------------------------------------------

describe('listSlices — modular architecture', () => {
  let tmp: string

  beforeEach(() => {
    tmp = makeTmpDir()
  })
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true })
  })

  it('returns entries for modules, shared, core', () => {
    const result = listSlices(tmp, 'modular')
    const layers = result.map((e) => e.layer)
    expect(layers).toEqual(['modules', 'shared', 'core'])
  })

  it('lists module slices', () => {
    mkdir(tmp, 'modules', 'auth')
    mkdir(tmp, 'modules', 'profile')

    const result = listSlices(tmp, 'modular')
    const modules = result.find((e) => e.layer === 'modules')!
    expect(modules.slices).toEqual(['auth', 'profile'])
  })
})
