# Changelog

All notable changes to this project will be documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

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
