/**
 * Heuristic rules for classifying existing directory names
 * into their FSD / modular equivalents.
 *
 * Patterns are evaluated in order — first match wins.
 * This file owns all classification knowledge; plan-builder.ts is pure logic.
 */

export interface LayerHeuristic {
  pattern: RegExp
  layer: string
  /** Optional sub-directory inside the layer, e.g. "ui" → shared/ui */
  subdir?: string
}

export const FSD_HEURISTICS: LayerHeuristic[] = [
  // ── App / bootstrap ─────────────────────────────────────────────────────
  { pattern: /^(app|bootstrap|main|root|providers?|router|store)$/i, layer: 'app' },

  // ── Pages / routes ──────────────────────────────────────────────────────
  { pattern: /^(pages?|routes?|screens?|views?)$/i, layer: 'pages' },

  // ── Widgets (composite blocks) ──────────────────────────────────────────
  { pattern: /^(widgets?|layouts?|containers?|blocks?)$/i, layer: 'widgets' },

  // ── Features (user actions) ─────────────────────────────────────────────
  { pattern: /^(features?|use-?cases?|actions?|mutations?)$/i, layer: 'features' },

  // ── Entities (domain models) ────────────────────────────────────────────
  { pattern: /^(entities|models?|domain|types?|interfaces?)$/i, layer: 'entities' },

  // ── Shared UI ───────────────────────────────────────────────────────────
  { pattern: /^(ui|components?|elements?|atoms?|molecules?)$/i, layer: 'shared', subdir: 'ui' },

  // ── Shared utilities ────────────────────────────────────────────────────
  { pattern: /^(utils?|helpers?|lib|libs?|common|shared)$/i, layer: 'shared' },

  // ── Shared API ──────────────────────────────────────────────────────────
  { pattern: /^(api|services?|http|clients?|fetchers?)$/i, layer: 'shared', subdir: 'api' },

  // ── Shared hooks ────────────────────────────────────────────────────────
  { pattern: /^(hooks?)$/i, layer: 'shared', subdir: 'hooks' },

  // ── Shared config ───────────────────────────────────────────────────────
  { pattern: /^(constants?|config|configs?|settings?)$/i, layer: 'shared', subdir: 'config' },

  // ── Assets (shared but no rename needed) ────────────────────────────────
  { pattern: /^(assets?|images?|icons?|fonts?|static)$/i, layer: 'shared', subdir: 'assets' },
]

/**
 * Returns the FSD destination for a given directory name,
 * or `null` if no heuristic matches.
 */
export function classifyDir(
  dirName: string,
): { layer: string; subdir?: string } | null {
  for (const h of FSD_HEURISTICS) {
    if (h.pattern.test(dirName)) {
      return { layer: h.layer, subdir: h.subdir }
    }
  }
  return null
}
