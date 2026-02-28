import path from 'node:path'

import fs from 'fs-extra'
import Handlebars from 'handlebars'

import { getSliceFiles } from '../templates/files'
import type { SliceType } from '../types/folder-tree'

// ---------------------------------------------------------------------------
// Custom template resolver
//
// Looks for user-defined Handlebars templates in the configured directory.
// Structure mirrors the built-in layout:
//
//   <templatesDir>/
//     <sliceType>/
//       index.ts.hbs
//       ui/{{name}}.tsx.hbs
//       model/index.ts.hbs
//       api/index.ts.hbs
//
// Template variables available inside .hbs files:
//   {{name}}       — raw slice name as passed by the user (e.g. "auth")
//   {{Name}}       — PascalCase version (e.g. "Auth")
//   {{sliceType}}  — slice type (e.g. "feature")
//
// Any file missing from the custom directory falls back to the built-in default.
// ---------------------------------------------------------------------------

interface TemplateContext {
  name: string
  Name: string
  sliceType: string
}

/** "auth" → "Auth", "userProfile" → "UserProfile" */
function toPascalCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Compiles a single .hbs file against the given context.
 * Returns null if the file does not exist.
 */
function compileHbs(hbsPath: string, context: TemplateContext): string | null {
  if (!fs.existsSync(hbsPath)) {
    return null
  }

  const source = fs.readFileSync(hbsPath, 'utf-8')
  const compiled = Handlebars.compile(source)
  return compiled(context)
}

/**
 * Resolves the file map for a slice, merging custom templates over built-in defaults.
 *
 * @param sliceType  - The type of slice being generated
 * @param name       - The raw slice name (may include path segments like "forms/Input")
 * @param templatesDir - Absolute path to the custom templates directory (optional)
 *
 * @returns Record<relativeFilePath, fileContent>
 */
export function resolveSliceFiles(
  sliceType: SliceType,
  name: string,
  templatesDir?: string,
): Record<string, string> {
  // Start with built-in defaults
  const builtIn = getSliceFiles(sliceType, name)

  // No custom templates configured — use built-ins as-is
  if (!templatesDir) {
    return builtIn
  }

  const customDir = path.join(templatesDir, sliceType)

  if (!fs.existsSync(customDir)) {
    return builtIn
  }

  const context: TemplateContext = {
    name,
    Name: toPascalCase(path.basename(name)),
    sliceType,
  }

  // Override built-in entries with custom .hbs where available
  const resolved: Record<string, string> = { ...builtIn }

  for (const relPath of Object.keys(builtIn)) {
    const hbsPath = path.join(customDir, `${relPath}.hbs`)
    const customContent = compileHbs(hbsPath, context)

    if (customContent !== null) {
      resolved[relPath] = customContent
    }
  }

  return resolved
}
