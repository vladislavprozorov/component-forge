# Changelog

All notable changes to this project will be documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Added

- `--dry-run` flag for `generate` — preview files that would be created without writing to disk
- `init` command — scaffolds FSD and Modular architecture folder structure
- `generate` command — generates slices with file templates (index.ts, Component.tsx, model, api)
- `validate` command — checks structure against configured architecture; CI-friendly exit codes
- `.component-forge.json` project config — written by `init`, read by `generate` and `validate`
- Support for nested component paths: `generate component forms/Input`
- `g` alias for `generate`
- `src/utils/config.ts` — shared config loading utility
- `CONTRIBUTING.md` — contributor guidelines
- GitHub issue and PR templates

### Fixed

- `validate` error message incorrectly used directory name instead of architecture name

---
