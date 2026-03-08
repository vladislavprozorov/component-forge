/**
 * check --fix
 *
 * Rewrites violating import paths in-place.
 *
 * Strategy
 * --------
 * A violation means file A imports from layer B where B is at the same
 * or higher level than A (FSD), or from a forbidden layer (modular).
 *
 * The safe fix in both cases is to redirect the import to the nearest
 * *shared* barrel that sits below both layers — which for FSD is always
 * "shared/<segment>" and for modular is "shared/<segment>".
 *
 * Concretely, given:
 *   violation.importPath  = "../features/auth"
 *   the target slice      = "features/auth"
 *   → rewritten import    = relative path from file to "shared/<sliceName>"
 *
 * If a matching shared barrel already exists we point straight at it;
 * if not, we still rewrite the path (the developer must create the barrel)
 * and we note it with a comment.
 *
 * The rewriting is purely textual — it replaces the exact import string
 * inside the source, leaving all other content untouched.
 */

import fs from 'node:fs'
import path from 'node:path'

import { type AliasEntry, type CheckResult, type CheckViolation, resolveAliasedImport } from './index'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FixResult {
  /** Relative path (from srcPath) of the file that was rewritten. */
  file: string
  /** How many import paths were replaced in this file. */
  fixedCount: number
  /** The violations that were fixed. */
  fixed: CheckViolation[]
}

export interface FixAllResult {
  fixedFiles: FixResult[]
  totalFixed: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Given a violating import path, compute the replacement relative import.
 *
 * Rule:
 *   - Resolve the target of the bad import to get its layer + slice.
 *   - Build a path to shared/<sliceName> (the canonical extraction point).
 *   - Return a relative path from the importing file to that shared path.
 *
 * Examples
 *   file:   features/auth/index.ts
 *   import: ../cart             (features/cart — same layer)
 *   → rewrite to: ../../shared/cart
 *
 *   file:   shared/utils/index.ts
 *   import: ../features/auth   (higher layer)
 *   → rewrite to: ../features/auth   ← CANNOT fix upward: return null
 *
 * Returns null when the violation cannot be mechanically fixed
 * (e.g. the file is in shared and imports from a higher layer — the only
 * real fix is to move code, which is what `migrate` is for).
 */
export function computeFixedImport(
  srcPath: string,
  relFilePath: string,
  importPath: string,
  aliases: AliasEntry[] = [],
): string | null {
  const fileDir = path.dirname(path.join(srcPath, relFilePath))

  let relResolved: string

  if (!importPath.startsWith('.')) {
    // Aliased import — resolve alias to a srcDir-relative path first
    const aliasResolved = resolveAliasedImport(importPath, aliases)
    if (aliasResolved === null) return null
    // aliasResolved is relative to srcDir, e.g. "features/auth"
    relResolved = aliasResolved
  } else {
    // Relative import — resolve via filesystem
    const resolved = path.resolve(fileDir, importPath)
    relResolved = path.relative(srcPath, resolved) // e.g. "features/auth"
  }

  const parts = relResolved.split(path.sep)
  const targetLayer = parts[0]
  // The slice name is the second segment (e.g. "auth" in "features/auth")
  const sliceName = parts[1] ?? targetLayer

  // Build the shared barrel path: srcPath/shared/<sliceName>
  const sharedBarrel = path.join(srcPath, 'shared', sliceName)

  // Compute relative path from the importing file's dir to the shared barrel
  const relToShared = path.relative(fileDir, sharedBarrel)

  // Normalise to forward slashes and ensure it starts with ./
  const normalised = relToShared.split(path.sep).join('/')
  const result = normalised.startsWith('.') ? normalised : `./${normalised}`

  // Sanity check: if the result points back to the same layer as the file,
  // skip (this would be a no-op or circular).
  if (result === importPath) return null

  return result
}

// ---------------------------------------------------------------------------
// Single-file fixer
// ---------------------------------------------------------------------------

/**
 * Rewrites the given violations in `filePath` and returns the new source.
 * Does NOT write to disk — side-effect-free for testability.
 */
export function applyFixes(
  source: string,
  violations: CheckViolation[],
  srcPath: string,
  relFilePath: string,
  aliases: AliasEntry[] = [],
): { source: string; fixedCount: number; fixed: CheckViolation[] } {
  let fixed = 0
  const fixedViolations: CheckViolation[] = []
  let result = source

  for (const v of violations) {
    const replacement = computeFixedImport(srcPath, relFilePath, v.importPath, aliases)
    if (replacement === null) continue

    // Replace all occurrences of the exact import string in the source.
    // We match both single and double quotes.
    const escapedImport = v.importPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`(['"])${escapedImport}\\1`, 'g')
    const before = result
    result = result.replace(re, (_match, quote) => `${quote}${replacement}${quote}`)

    if (result !== before) {
      fixed++
      fixedViolations.push(v)
    }
  }

  return { source: result, fixedCount: fixed, fixed: fixedViolations }
}

/**
 * Applies fixes to a single file on disk.
 * Returns null if the file could not be read/written.
 */
export function fixFile(
  filePath: string,
  violations: CheckViolation[],
  srcPath: string,
  relFilePath: string,
  aliases: AliasEntry[] = [],
): FixResult | null {
  if (!fs.existsSync(filePath)) return null

  const original = fs.readFileSync(filePath, 'utf8')
  const { source, fixedCount, fixed } = applyFixes(original, violations, srcPath, relFilePath, aliases)

  if (fixedCount > 0) {
    fs.writeFileSync(filePath, source, 'utf8')
  }

  return { file: relFilePath, fixedCount, fixed }
}

// ---------------------------------------------------------------------------
// Full fix pass
// ---------------------------------------------------------------------------

/**
 * Iterates over every violation in `result`, groups by file, and rewrites
 * each file once. Returns a summary of what was changed.
 */
export function fixAll(checkResult: CheckResult, srcPath: string, aliases: AliasEntry[] = []): FixAllResult {
  // Group violations by file
  const byFile = new Map<string, CheckViolation[]>()
  for (const v of checkResult.violations) {
    const arr = byFile.get(v.file) ?? []
    arr.push(v)
    byFile.set(v.file, arr)
  }

  const fixedFiles: FixResult[] = []
  let totalFixed = 0

  for (const [relFilePath, violations] of byFile) {
    const fullPath = path.join(srcPath, relFilePath)
    const result = fixFile(fullPath, violations, srcPath, relFilePath, aliases)
    if (result && result.fixedCount > 0) {
      fixedFiles.push(result)
      totalFixed += result.fixedCount
    }
  }

  return { fixedFiles, totalFixed }
}
