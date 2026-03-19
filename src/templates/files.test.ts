import { describe, it, expect } from 'vitest'

import { getSliceFiles } from './files'

// ---------------------------------------------------------------------------
// getSliceFiles — smart templates
//
//  feature   → index + ui/ + model/ + api/   (full vertical slice)
//  entity    → index + model/ + api/          (data layer, no UI)
//  widget    → index + ui/ + model/           (composite UI, no api)
//  page      → index + ui/*Page.tsx           (route shell, thin)
//  component → index + flat *.tsx             (pure UI atom)
//  module    → index + ui/ + model/ + api/    (modular vertical slice)
// ---------------------------------------------------------------------------

describe('getSliceFiles', () => {
  // -------------------------------------------------------------------------
  // feature — full vertical slice (FSD)
  // -------------------------------------------------------------------------
  describe('feature', () => {
    it('returns index + ui + model + api', () => {
      const files = getSliceFiles('feature', 'auth')
      expect(Object.keys(files)).toEqual([
        'index.ts',
        'ui/Auth.tsx',
        'model/index.ts',
        'api/index.ts',
      ])
    })

    it('uses PascalCase for component filename', () => {
      const files = getSliceFiles('feature', 'userProfile')
      expect(files).toHaveProperty('ui/UserProfile.tsx')
    })

    it('index.ts re-exports the ui component and its props type', () => {
      const files = getSliceFiles('feature', 'auth')
      expect(files['index.ts']).toContain("export { Auth } from './ui/Auth'")
      expect(files['index.ts']).toContain("export type { AuthProps } from './ui/Auth'")
    })

    it('component file contains a React function component', () => {
      const files = getSliceFiles('feature', 'auth')
      expect(files['ui/Auth.tsx']).toContain('export function Auth')
      expect(files['ui/Auth.tsx']).toContain('export interface AuthProps')
    })

    it('model/index.ts contains state interface', () => {
      const files = getSliceFiles('feature', 'auth')
      expect(files['model/index.ts']).toContain('export interface AuthState')
    })

    it('api/index.ts contains fetch function', () => {
      const files = getSliceFiles('feature', 'auth')
      expect(files['api/index.ts']).toContain('export async function fetchAuth')
    })
  })

  // -------------------------------------------------------------------------
  // entity — data-layer slice (FSD)
  // NO UI — model + api only
  // -------------------------------------------------------------------------
  describe('entity', () => {
    it('returns index + model + api — no ui directory', () => {
      const files = getSliceFiles('entity', 'user')
      expect(Object.keys(files)).toEqual(['index.ts', 'model/index.ts', 'api/index.ts'])
    })

    it('does NOT generate a ui/ component', () => {
      const files = getSliceFiles('entity', 'user')
      const keys = Object.keys(files)
      expect(keys.some((k) => k.startsWith('ui/'))).toBe(false)
    })

    it('index.ts re-exports model type and fetch function', () => {
      const files = getSliceFiles('entity', 'user')
      expect(files['index.ts']).toContain('export type { UserState }')
      expect(files['index.ts']).toContain("export { fetchUser } from './api'")
    })

    it('model/index.ts contains state interface', () => {
      const files = getSliceFiles('entity', 'user')
      expect(files['model/index.ts']).toContain('export interface UserState')
    })

    it('api/index.ts contains fetch function', () => {
      const files = getSliceFiles('entity', 'user')
      expect(files['api/index.ts']).toContain('export async function fetchUser')
    })
  })

  // -------------------------------------------------------------------------
  // widget — composite UI block (FSD)
  // Has UI + model state; does NOT own server calls
  // -------------------------------------------------------------------------
  describe('widget', () => {
    it('returns index + ui + model — no api', () => {
      const files = getSliceFiles('widget', 'header')
      expect(Object.keys(files)).toEqual(['index.ts', 'ui/Header.tsx', 'model/index.ts'])
    })

    it('does NOT generate api/index.ts', () => {
      const files = getSliceFiles('widget', 'header')
      expect(files).not.toHaveProperty('api/index.ts')
    })

    it('index.ts re-exports the ui component', () => {
      const files = getSliceFiles('widget', 'header')
      expect(files['index.ts']).toContain("export { Header } from './ui/Header'")
    })
  })

  // -------------------------------------------------------------------------
  // page — route-level shell (FSD)
  // Thin composition layer — no model/api
  // -------------------------------------------------------------------------
  describe('page', () => {
    it('returns index and a Page-suffixed component only', () => {
      const files = getSliceFiles('page', 'dashboard')
      expect(Object.keys(files)).toEqual(['index.ts', 'ui/DashboardPage.tsx'])
    })

    it('component filename has Page suffix', () => {
      const files = getSliceFiles('page', 'dashboard')
      expect(files).toHaveProperty('ui/DashboardPage.tsx')
    })

    it('does NOT generate model or api', () => {
      const files = getSliceFiles('page', 'dashboard')
      expect(files).not.toHaveProperty('model/index.ts')
      expect(files).not.toHaveProperty('api/index.ts')
    })

    it('index.ts re-exports the Page component', () => {
      const files = getSliceFiles('page', 'dashboard')
      expect(files['index.ts']).toContain('DashboardPage')
    })
  })

  // -------------------------------------------------------------------------
  // component — pure UI atom (shared/ui)
  // Stateless, flat structure — no sub-directories
  // -------------------------------------------------------------------------
  describe('component', () => {
    it('returns index and a flat component file only', () => {
      const files = getSliceFiles('component', 'button')
      expect(Object.keys(files)).toEqual(['index.ts', 'Button.tsx'])
    })

    it('component is flat — no ui/ subdirectory', () => {
      const files = getSliceFiles('component', 'button')
      expect(files).toHaveProperty('Button.tsx')
      expect(files).not.toHaveProperty('ui/Button.tsx')
    })

    it('does NOT generate model or api', () => {
      const files = getSliceFiles('component', 'button')
      expect(files).not.toHaveProperty('model/index.ts')
      expect(files).not.toHaveProperty('api/index.ts')
    })

    it('index.ts re-exports the component and its props type', () => {
      const files = getSliceFiles('component', 'button')
      expect(files['index.ts']).toContain("export { Button } from './Button'")
      expect(files['index.ts']).toContain("export type { ButtonProps } from './Button'")
    })
  })

  // -------------------------------------------------------------------------
  // module — full vertical slice (Modular architecture)
  // Equivalent to feature in FSD
  // -------------------------------------------------------------------------
  describe('module', () => {
    it('returns index + ui + model + api (same shape as feature)', () => {
      const files = getSliceFiles('module', 'auth')
      expect(Object.keys(files)).toEqual([
        'index.ts',
        'ui/Auth.tsx',
        'model/index.ts',
        'api/index.ts',
      ])
    })

    it('index.ts re-exports the ui component', () => {
      const files = getSliceFiles('module', 'auth')
      expect(files['index.ts']).toContain("export { Auth } from './ui/Auth'")
    })
  })
})
