import { describe, it, expect } from 'vitest'

import { getSliceFiles } from './files'

// ---------------------------------------------------------------------------
// getSliceFiles
// ---------------------------------------------------------------------------

describe('getSliceFiles', () => {
  describe('feature', () => {
    it('returns the correct file keys', () => {
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

    it('index.ts re-exports the component', () => {
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

  describe('entity', () => {
    it('returns the same structure as feature', () => {
      const files = getSliceFiles('entity', 'user')
      expect(Object.keys(files)).toEqual([
        'index.ts',
        'ui/User.tsx',
        'model/index.ts',
        'api/index.ts',
      ])
    })
  })

  describe('widget', () => {
    it('returns index, ui component, and model — no api', () => {
      const files = getSliceFiles('widget', 'header')
      expect(Object.keys(files)).toEqual(['index.ts', 'ui/Header.tsx', 'model/index.ts'])
      expect(files).not.toHaveProperty('api/index.ts')
    })
  })

  describe('page', () => {
    it('returns index and a Page-suffixed component', () => {
      const files = getSliceFiles('page', 'dashboard')
      expect(Object.keys(files)).toEqual(['index.ts', 'ui/DashboardPage.tsx'])
    })

    it('component filename has Page suffix', () => {
      const files = getSliceFiles('page', 'dashboard')
      expect(files).toHaveProperty('ui/DashboardPage.tsx')
    })

    it('index.ts re-exports the Page component', () => {
      const files = getSliceFiles('page', 'dashboard')
      expect(files['index.ts']).toContain('DashboardPage')
    })
  })

  describe('component', () => {
    it('returns index and a flat component file', () => {
      const files = getSliceFiles('component', 'button')
      expect(Object.keys(files)).toEqual(['index.ts', 'Button.tsx'])
    })

    it('component is flat — no ui/ subdirectory', () => {
      const files = getSliceFiles('component', 'button')
      expect(files).toHaveProperty('Button.tsx')
      expect(files).not.toHaveProperty('ui/Button.tsx')
    })

    it('index.ts re-exports the component', () => {
      const files = getSliceFiles('component', 'button')
      expect(files['index.ts']).toContain("export { Button } from './Button'")
    })
  })

  describe('module', () => {
    it('returns the same structure as feature', () => {
      const files = getSliceFiles('module', 'auth')
      expect(Object.keys(files)).toEqual([
        'index.ts',
        'ui/Auth.tsx',
        'model/index.ts',
        'api/index.ts',
      ])
    })
  })
})
