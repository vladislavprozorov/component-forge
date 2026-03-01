# Changelog

All notable changes to this project will be documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

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
