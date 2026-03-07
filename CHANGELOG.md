# Changelog

All notable changes to this project will be documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [1.7.0] - 2026-03-06

### Added

#### `generate list` — scan existing slices

New command `component-forge list` (alias `ls`) scans `srcDir` and prints all existing slices grouped by architectural layer.

- Green `✓` = slice has a public API `index.ts`
- Yellow `!` = slice is missing `index.ts`
- `shared/ui` components are listed with a `ui/` prefix

#### `generate --dry-run` — file content preview

`--dry-run` now renders the full content of every file that would be created, using a `┌─ / │ / └─` box layout. Previously it only printed the target paths.

#### `check` — path alias support

`component-forge check` now detects violations in aliased imports — not just relative ones:

- Auto-detects `@/`, `~/src/`, and `~src/` conventions
- Reads `compilerOptions.paths` from `tsconfig.json` for custom aliases (e.g. `@features/*`)
- Both FSD and Modular architecture rules apply to resolved aliases

#### `validate` — empty barrel detection

`validate` now warns when a slice `index.ts` exists but contains no export statements. Catches forgotten stub files that would silently break public API contracts.

#### `validate` — `shared/` segment check

`validate` now warns when `shared/` contains directories that are not among the recognised segments: `ui`, `lib`, `api`, `config`, `model`, `types`, `hooks`, `assets`, `styles`.

### Changed

#### `init` — writes `forge.config.ts` directly

`init` now creates `forge.config.ts` immediately instead of writing `.component-forge.json` and showing a manual rename tip. The "already initialised" guard detects all config formats (`forge.config.ts`, `forge.config.js`, `.component-forge.json`).

### Fixed

- Removed legacy `src/commands/generate.ts` that caused 3 TypeScript errors (`CONFIG_FILENAME`, `listCommand`, argument count mismatch)

[1.7.0]: https://github.com/vladislavprozorov/component-forge/compare/v1.6.0...v1.7.0

---

## [1.2.0] - 2026-02-28

### Added

#### `forge.config.ts` — TypeScript config support

Projects can now use a **typed TypeScript config** instead of `.component-forge.json`:

```ts
// forge.config.ts
import { defineConfig } from '@xanahlight/component-forge'

export default defineConfig({
  architecture: 'fsd',
  srcDir: 'src',
})
```

- Full **IntelliSense** and compile-time validation in any TypeScript-aware editor
- Config is loaded at runtime via **jiti** (zero-config TS runner — no build step)
- `defineConfig()` helper exported from the package root for type-safety
- Resolution order: `forge.config.ts` → `forge.config.js` → `.component-forge.json`
- `.component-forge.json` is still fully supported — **100% backwards compatible**
- `init` command now prints a tip to migrate to `forge.config.ts` after scaffolding

[1.2.0]: https://github.com/vladislavprozorov/component-forge/compare/v1.1.0...v1.2.0

---

## [1.1.0] - 2026-02-28

### Changed

#### Smart templates for `generate` command

Each slice type now generates its own semantically correct file structure:

| Type        | Files generated                                                | Rationale                                  |
| ----------- | -------------------------------------------------------------- | ------------------------------------------ |
| `feature`   | `index.ts` + `ui/Name.tsx` + `model/index.ts` + `api/index.ts` | Full vertical slice (FSD)                  |
| `entity`    | `index.ts` + `model/index.ts` + `api/index.ts`                 | Data-layer slice — no UI of its own        |
| `widget`    | `index.ts` + `ui/Name.tsx` + `model/index.ts`                  | Composite UI block — no direct API         |
| `page`      | `index.ts` + `ui/NamePage.tsx`                                 | Route-level shell — thin composition layer |
| `component` | `index.ts` + `Name.tsx`                                        | Pure UI atom — flat, no sub-directories    |
| `module`    | `index.ts` + `ui/Name.tsx` + `model/index.ts` + `api/index.ts` | Modular-arch vertical slice                |

Previously `entity` incorrectly generated the same structure as `feature` (with `ui/`).
Now each type is strictly aligned with FSD and Modular architecture semantics.

- `entity/index.ts` re-exports model types and the fetch function (not a UI component)
- `generate --dry-run` now prints the slice type description alongside the file list
- `generate` success message includes the structure summary (e.g. "model + api (no UI)")

[1.1.0]: https://github.com/vladislavprozorov/component-forge/compare/v1.0.0...v1.1.0

---

## [1.0.0] - 2025-06-07

### Added

#### New commands

- **`init [architecture]`** — interactive mode (via `@inquirer/prompts`) when architecture
  argument is omitted: guides through architecture selection, optional custom `src/` path,
  and confirmation before writing.
- **`check`** — static import-boundary checker. Parses every `.ts` / `.tsx` source file
  and reports imports that violate FSD or Modular layer rules (e.g. `feature` → `feature`).
- **`explain <topic>`** — print architecture documentation in the terminal.
  Topics: `fsd`, `modular`, `layers`, `all`.
- **`migrate --to <architecture>`** — dry-run migration analyser. Scans top-level source
  directories, classifies each folder using 11 FSD heuristic rules, and prints a
  colour-coded move proposal with matched / unmatched / ambiguous summary.

### Changed

#### Architecture refactor

- Every command moved from a flat `src/commands/<cmd>.ts` to a dedicated subfolder
  `src/commands/<cmd>/index.ts` following the single-responsibility principle.
- Complex commands split into focused modules:
  - `migrate/` → `classifier.ts` · `plan-builder.ts` · `printer.ts` · `index.ts`
  - `explain/` → `topics.ts` · `index.ts`
- Shared Chalk formatting helpers extracted to `src/shared/format.ts`
  (`fmt.h1`, `fmt.h2`, `fmt.rule`, `fmt.tag`, `fmt.ok`, `fmt.no`, `fmt.arrow`, …).

#### Infrastructure

- GitHub Actions CI (`ci.yml`) — Node 20 + 22 matrix, lint + type-check + test on every
  push / pull-request.
- ESLint flat config with `eslint-import-resolver-typescript` and `import/order`
  enforcement.
- Vitest v4 test suite — **85 tests** across 6 test files.

[1.0.0]: https://github.com/vladislavprozorov/component-forge/compare/v0.1.0...v1.0.0

---

## [0.1.0] - 2026-02-28

### Added

- `init` command — scaffolds FSD and Modular architecture folder structure
- `generate` command — generates slices with file templates (index.ts, Component.tsx, model, api)
- `validate` command — checks structure against configured architecture; CI-friendly exit codes
- `generate --dry-run` flag — preview files that would be created without writing to disk
- Custom templates via `templates` field in `.component-forge.json` — override built-in templates per slice type with Handlebars `.hbs` files; missing files fall back to built-ins
- `.component-forge.json` project config — written by `init`, read by all commands
- Support for nested component paths: `generate component forms/Input`
- `g` alias for `generate`
- `src/utils/config.ts` — shared config loading utility
- `src/utils/template-resolver.ts` — custom Handlebars template resolution with built-in fallback
- `CONTRIBUTING.md` — contributor guidelines
- GitHub issue and PR templates

### Fixed

- `validate` error message incorrectly used directory name instead of architecture name

[0.1.0]: https://github.com/vladislavprozorov/component-forge/releases/tag/v0.1.0
