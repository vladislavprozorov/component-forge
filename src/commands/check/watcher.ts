import chokidar from 'chokidar'
import chalk from 'chalk'

import type { Architecture } from '../../types/folder-tree'
import { runCheck } from './index'
import type { CheckViolation } from './index'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WatchRunResult {
  violations: CheckViolation[]
  checkedFiles: number
  /** Violations that appeared since the previous run (new problems). */
  added: CheckViolation[]
  /** Violations that disappeared since the previous run (fixed). */
  resolved: CheckViolation[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEBOUNCE_MS = 300

/** Stable key for deduplicating violations across runs. */
function violationKey(v: CheckViolation): string {
  return `${v.file}||${v.importPath}`
}

function diffViolations(
  prev: CheckViolation[],
  next: CheckViolation[],
): { added: CheckViolation[]; resolved: CheckViolation[] } {
  const prevKeys = new Set(prev.map(violationKey))
  const nextKeys = new Set(next.map(violationKey))

  return {
    added: next.filter((v) => !prevKeys.has(violationKey(v))),
    resolved: prev.filter((v) => !nextKeys.has(violationKey(v))),
  }
}

function clearLine(): void {
  if (process.stdout.isTTY) {
    process.stdout.write('\x1Bc') // clear terminal screen
  }
}

function printWatchHeader(srcPath: string, architecture: Architecture): void {
  console.log(
    chalk.bold.cyan('\n  component-forge check --watch\n'),
  )
  console.log(chalk.gray(`  Watching: ${srcPath}`))
  console.log(chalk.gray(`  Architecture: ${architecture}`))
  console.log(chalk.gray(`  Press Ctrl+C to stop.\n`))
  console.log(chalk.gray(`  ${'─'.repeat(58)}\n`))
}

function printWatchResult(result: WatchRunResult, timestamp: string): void {
  if (result.violations.length === 0) {
    console.log(
      chalk.green(`  ✓ No violations in ${result.checkedFiles} file(s).`) +
      chalk.gray(` [${timestamp}]`),
    )
    return
  }

  console.log(
    chalk.red(`  ✖ ${result.violations.length} violation(s) in ${result.checkedFiles} file(s)`) +
    chalk.gray(` [${timestamp}]\n`),
  )

  for (const v of result.violations) {
    const isNew = result.added.some((a) => violationKey(a) === violationKey(v))
    const prefix = isNew ? chalk.bgRed.white(' NEW ') + ' ' : '       '
    console.log(`  ${prefix}${chalk.bold.white(v.file)}`)
    console.log(`         ${chalk.gray(`import "${v.importPath}"`)}`)
    console.log(`         ${chalk.red(`✗ ${v.message}`)}`)
    console.log(`         ${chalk.yellow(`→ Fix: ${v.hint}`)}\n`)
  }
}

function printDiff(result: WatchRunResult, timestamp: string): void {
  if (result.added.length === 0 && result.resolved.length === 0) return

  if (result.resolved.length > 0) {
    console.log(
      chalk.green(`  ✓ Fixed ${result.resolved.length} violation(s)`) +
      chalk.gray(` [${timestamp}]`),
    )
    for (const v of result.resolved) {
      console.log(chalk.green(`    ✓ ${v.file} — import "${v.importPath}"`))
    }
    console.log()
  }

  if (result.added.length > 0) {
    console.log(
      chalk.red(`  ✖ ${result.added.length} new violation(s)`) +
      chalk.gray(` [${timestamp}]`),
    )
    for (const v of result.added) {
      console.log(chalk.red(`    ✗ ${v.file} — import "${v.importPath}"`))
      console.log(chalk.yellow(`      → Fix: ${v.hint}`))
    }
    console.log()
  }
}

// ---------------------------------------------------------------------------
// Core watch logic — exported for testing
// ---------------------------------------------------------------------------

/**
 * Runs a check and computes the diff relative to the previous violations.
 * Pure function — no side effects other than reading the filesystem.
 */
export function runWatchCheck(
  srcPath: string,
  architecture: Architecture,
  previous: CheckViolation[],
): WatchRunResult {
  const { violations, checkedFiles } = runCheck(srcPath, architecture)
  const { added, resolved } = diffViolations(previous, violations)
  return { violations, checkedFiles, added, resolved }
}

// ---------------------------------------------------------------------------
// Watch command — long-running process
// ---------------------------------------------------------------------------

/**
 * Starts a file watcher and re-runs the check on every change.
 * Returns the chokidar watcher instance so callers can close it
 * (useful in tests or programmatic use).
 */
export function watchCheck(
  srcPath: string,
  architecture: Architecture,
): ReturnType<typeof chokidar.watch> {
  let previousViolations: CheckViolation[] = []
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let isFirstRun = true

  const runAndPrint = (): void => {
    const timestamp = new Date().toLocaleTimeString()
    const result = runWatchCheck(srcPath, architecture, previousViolations)

    if (isFirstRun) {
      clearLine()
      printWatchHeader(srcPath, architecture)
      printWatchResult(result, timestamp)
      isFirstRun = false
    } else {
      // On subsequent runs: only show diff, not full list (less noise)
      if (result.added.length > 0 || result.resolved.length > 0) {
        printDiff(result, timestamp)
      } else {
        // No change in violations — silently update count
        process.stdout.write(
          `\r  ${result.violations.length === 0 ? chalk.green('✓') : chalk.red('✖')} ` +
          `${result.violations.length} violation(s) — ${result.checkedFiles} file(s) ` +
          chalk.gray(`[${timestamp}]`) +
          '  ',
        )
      }
    }

    previousViolations = result.violations
  }

  const watcher = chokidar.watch(`${srcPath}/**/*.{ts,tsx}`, {
    ignoreInitial: false,
    ignored: [/node_modules/, /\.test\.ts$/, /dist\//],
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
  })

  const scheduleRun = (): void => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(runAndPrint, DEBOUNCE_MS)
  }

  watcher
    .on('ready', runAndPrint)
    .on('change', scheduleRun)
    .on('add', scheduleRun)
    .on('unlink', scheduleRun)
    .on('error', (err) => {
      console.error(chalk.red(`\n  Watcher error: ${err instanceof Error ? err.message : String(err)}`))
    })

  // Graceful shutdown on Ctrl+C
  process.on('SIGINT', () => {
    console.log(chalk.gray('\n\n  Stopping watcher…'))
    void watcher.close().then(() => process.exit(0))
  })

  return watcher
}
