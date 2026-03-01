import chalk from 'chalk'

import { fmt } from '../../shared/format'

import { TOPICS } from './topics'

export { TOPICS }
export const AVAILABLE_TOPICS = Object.keys(TOPICS) as readonly string[]

/**
 * Renders the requested topic to a string.
 * Pure function — no stdout side-effects — making it fully testable.
 */
export function renderTopic(topic: string): string {
  const renderer = TOPICS[topic.toLowerCase()]

  if (!renderer) {
    return [
      chalk.red(`\n  Unknown topic: "${topic}"\n`),
      fmt.line(`  Available topics: ${chalk.cyan(AVAILABLE_TOPICS.join(', '))}`),
      fmt.line(''),
      fmt.line(`  Example: component-forge explain fsd`),
      fmt.line(''),
    ].join('\n')
  }

  return renderer()
}

/**
 * CLI entry point — writes the rendered topic to stdout.
 */
export function explainCommand(topic: string): void {
  process.stdout.write(renderTopic(topic))
}
