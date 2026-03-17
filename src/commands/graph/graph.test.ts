import { describe, it, expect } from 'vitest'

import { getNodeName } from './index'

describe('getNodeName', () => {
  it('groups regular slices by layer and slice', () => {
    expect(getNodeName('features/auth/ui/Login.tsx')).toBe('features/auth')
    expect(getNodeName('entities/user/model/types.ts')).toBe('entities/user')
  })

  it('keeps app layer together', () => {
    expect(getNodeName('app/providers/index.ts')).toBe('app')
    expect(getNodeName('app/styles/global.css.ts')).toBe('app')
  })

  it('groups shared into segments', () => {
    expect(getNodeName('shared/ui/Button/ui.tsx')).toBe('shared/ui')
    expect(getNodeName('shared/api/client.ts')).toBe('shared/api')
    expect(getNodeName('shared/index.ts')).toBe('shared')
  })
})
