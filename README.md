# component-forge

[English](README.md) | [Русский](README.ru.md)

[![npm version](https://img.shields.io/npm/v/@xanahlight/component-forge.svg)](https://www.npmjs.com/package/@xanahlight/component-forge)
[![CI](https://github.com/vladislavprozorov/component-forge/actions/workflows/ci.yml/badge.svg)](https://github.com/vladislavprozorov/component-forge/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/node/v/@xanahlight/component-forge.svg)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> Architecture-first CLI for scalable React projects.

Enforces structural discipline through predefined architectural templates — Feature-Sliced Design (FSD) and Modular Architecture.

---

## Why

React gives you flexibility — but not structure.

In growing teams this often leads to:

- inconsistent folder structures across engineers
- unclear layer boundaries and ownership
- tight coupling between features
- architectural degradation over time

**component-forge** addresses this by providing:

- standardized project structure from day one
- enforced architectural layers
- public API boundaries via `index.ts` files
- commands that catch violations before they ship

> This is not just a scaffolding tool. It is an architecture enforcement tool.

---

## Target Audience

- React teams (3–10 developers)
- Growing startups with shared codebases
- Developers who have experienced architectural chaos
- Engineers who value structure and long-term maintainability

---

## Supported Architectures

### Feature-Sliced Design (FSD)

```
src/
 ├─ app/
 ├─ processes/
 ├─ pages/
 ├─ widgets/
 ├─ features/
 ├─ entities/
 └─ shared/
      ├─ ui/
      ├─ lib/
      ├─ api/
      └─ config/
```

Strict layer hierarchy: app imports from pages, pages from widgets, and so on down to shared. No cross-layer or same-layer imports. Public API only via `index.ts`.

### Modular Architecture

```
src/
 ├─ modules/
 │   ├─ auth/
 │   ├─ profile/
 │   └─ dashboard/
 ├─ shared/
 └─ core/
```

Domain-oriented separation. Modules are independent; shared and core have restricted import rules.

---

## Installation

```bash
# Global
npm install -g @xanahlight/component-forge

# Without installing (one-time setup)
npx @xanahlight/component-forge init
```

---

## Commands

### init

Interactive setup — prompts for architecture if not provided. Creates `forge.config.ts`.

```bash
component-forge init
component-forge init fsd
component-forge init modular
```

### generate

Generates a slice with pre-populated files based on slice type. Supports nested paths.

```bash
component-forge generate feature auth
component-forge generate entity user
component-forge generate widget Header
component-forge generate page dashboard
component-forge generate component Button
component-forge generate module profile

# Nested path — slice placed inside a subdirectory
component-forge generate feature auth/LoginForm
component-forge generate entity user/profile/Address

# Preview without writing files
component-forge generate feature auth --dry-run

# Short alias
component-forge g feature auth
```

What `generate feature auth` produces:

```
src/features/auth/
 ├─ index.ts
 ├─ ui/Auth.tsx
 ├─ model/index.ts
 └─ api/index.ts
```

Each slice type generates a different file set. Run `component-forge generate --help` for the full table.

### validate

Validates folder structure against the configured architecture.

```bash
component-forge validate
```

Reports:

- Missing required layers (error)
- Unknown layers not belonging to the architecture (warning)
- Slices missing a public API `index.ts` (warning)

Exits with code `1` on errors — suitable for CI.

### check

Scans source files and reports import violations across architectural layer boundaries.

```bash
component-forge check

# Watch mode — re-runs automatically on file changes
component-forge check --watch

# Auto-fix mode — rewrites violating imports to shared/<slice>
component-forge check --fix
```

Each violation is printed with a targeted hint explaining the correct fix. Exits with code `1` when violations are found.

### migrate

Analyses current project structure and produces a step-by-step migration plan.

```bash
# Dry run — print plan only
component-forge migrate --to fsd
component-forge migrate --to modular

# Apply — actually move the files
component-forge migrate --to fsd --execute

# Apply with backup
component-forge migrate --to fsd --execute --backup
```

After a successful `--execute`, the project config is updated automatically.

### explain

Prints architecture documentation directly in the terminal.

```bash
component-forge explain fsd
component-forge explain modular
component-forge explain layers
component-forge explain slices
component-forge explain segments
```

---

## Configuration

`init` creates a `forge.config.ts` in the project root:

```ts
import { defineConfig } from '@xanahlight/component-forge'

export default defineConfig({
  architecture: 'fsd',
  srcDir: 'src',
})
```

All commands read this config automatically. Legacy `.component-forge.json` is also supported.

### Custom templates

Override any built-in file template with your own [Handlebars](https://handlebarsjs.com/) (`.hbs`) files.

Add a `templates` field to the config:

```ts
export default defineConfig({
  architecture: 'fsd',
  srcDir: 'src',
  templates: '.forge-templates',
})
```

Create `.hbs` files mirroring the built-in structure:

```
.forge-templates/
 └─ feature/
      └─ index.ts.hbs
```

Available variables: `{{name}}`, `{{Name}}` (PascalCase), `{{sliceType}}`.

Any file not found in the custom directory falls back to the built-in default.

---

## Philosophy

- Opinionated defaults prevent decision fatigue
- Constraints enable scale
- Predictability means anyone on the team knows where things live
- Enforcement catches drift before it becomes debt

---

## Development

```bash
git clone https://github.com/vladislavprozorov/component-forge.git
cd component-forge
npm install
npm run build
node dist/index.js init fsd
```

```bash
npm test
npm run lint
```

Node.js 20+ required.

---

## Project Status

Version 1.6.0. Active development.

- [x] `init` — interactive FSD and Modular scaffolding
- [x] `generate` — typed slice templates, nested paths, dry-run, spinner
- [x] `validate` — architecture enforcement
- [x] `check` — import boundary violations with actionable hints
- [x] `check --watch` — file watcher with diff output
- [x] `check --fix` — auto-rewrite violating imports
- [x] `migrate` — analysis and execution of structural migrations
- [x] `explain` — inline architecture documentation
- [x] `forge.config.ts` — TypeScript config with `defineConfig`
- [ ] VS Code extension

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

Open an issue before submitting large changes.

---

## License

[MIT](LICENSE)
