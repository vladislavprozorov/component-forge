import { describe, expect, it } from 'vitest'

import { AVAILABLE_TOPICS, renderTopic } from './explain'

describe('renderTopic', () => {
  it('renders fsd topic with key sections', () => {
    const output = renderTopic('fsd')
    expect(output).toContain('Feature-Sliced Design')
    expect(output).toContain('shared')
    expect(output).toContain('entities')
    expect(output).toContain('features')
    expect(output).toContain('widgets')
    expect(output).toContain('pages')
    expect(output).toContain('app')
    expect(output).toContain('Import rules')
  })

  it('renders modular topic with key sections', () => {
    const output = renderTopic('modular')
    expect(output).toContain('Modular Architecture')
    expect(output).toContain('modules')
    expect(output).toContain('core')
    expect(output).toContain('shared')
    expect(output).toContain('Import rules')
  })

  it('renders layers topic with FSD layer reference', () => {
    const output = renderTopic('layers')
    expect(output).toContain('FSD Layer Reference')
    expect(output).toContain('shared')
    expect(output).toContain('entities')
    expect(output).toContain('features')
  })

  it('renders all topic combining all sections', () => {
    const output = renderTopic('all')
    expect(output).toContain('Feature-Sliced Design')
    expect(output).toContain('Modular Architecture')
    expect(output).toContain('FSD Layer Reference')
  })

  it('returns error message for unknown topic', () => {
    const output = renderTopic('unknown-topic')
    expect(output).toContain('Unknown topic')
    expect(output).toContain('unknown-topic')
    expect(output).toContain('Available topics')
  })

  it('is case-insensitive', () => {
    const lower = renderTopic('fsd')
    const upper = renderTopic('FSD')
    // Same length means same content (ANSI codes are identical)
    expect(lower.length).toBe(upper.length)
  })

  it('AVAILABLE_TOPICS contains expected topics', () => {
    expect(AVAILABLE_TOPICS).toContain('fsd')
    expect(AVAILABLE_TOPICS).toContain('modular')
    expect(AVAILABLE_TOPICS).toContain('layers')
    expect(AVAILABLE_TOPICS).toContain('all')
  })
})
