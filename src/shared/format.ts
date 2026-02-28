/**
 * Shared chalk formatting helpers used across CLI output.
 *
 * Keeping these in one place ensures visual consistency and
 * makes it easy to restyle the entire CLI from a single file.
 */
import chalk from 'chalk'

export const fmt = {
  /** Bold white section heading */
  h1: (text: string) => chalk.bold.white(`\n  ${text}\n`),

  /** Bold cyan sub-heading */
  h2: (text: string) => chalk.bold.cyan(`\n  ${text}`),

  /** Dim horizontal rule (58 chars) */
  rule: () => chalk.gray(`  ${'─'.repeat(58)}`),

  /** Indent a line by two spaces */
  line: (text: string) => `  ${text}`,

  /** Dim / secondary text */
  dim: (text: string) => chalk.gray(text),

  /** Inline tag badge (cyan background) */
  tag: (text: string) => chalk.bgCyan.black(` ${text} `),

  /** Green checkmark item */
  ok: (text: string) => `  ${chalk.green('✓')} ${text}`,

  /** Red cross item */
  no: (text: string) => `  ${chalk.red('✗')} ${text}`,

  /**
   * Renders a layer import-direction row.
   *
   * @param from    source layer name
   * @param to      target layer name
   * @param allowed true → green arrow, false → red cross
   */
  arrow: (from: string, to: string, allowed: boolean) =>
    `  ${chalk.cyan(from.padEnd(12))} ${allowed ? chalk.green('→') : chalk.red('✗')} ${chalk.white(to)}`,
} as const
