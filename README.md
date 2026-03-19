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

With `--dry-run`, the full content of every file that would be created is printed inline — no files are written:

```
  Dry run — feature "auth"  (full vertical slice — ui + model + api)
  Target: src/features/auth/

  ┌─ src/features/auth/index.ts
  │  export { Auth } from './ui/Auth'
  └─

  ┌─ src/features/auth/ui/Auth.tsx
  │  export function Auth() {
  │    return null
  │  }
  └─

  3 file(s) would be created.  Run without --dry-run to generate.
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

### list

Lists all existing slices in the project, grouped by layer.

```bash
component-forge list

# Short alias
component-forge ls
```

Output example:

```
features/
  ✓ auth          (index.ts present)
  ! search        (missing index.ts)

entities/
  ✓ user
  ✓ product

shared/
  ✓ ui/Button
  ✓ ui/Input
```

Green `✓` means the slice has a public API `index.ts`. Yellow `!` means it is missing.

### validate

Validates folder structure against the configured architecture.

```bash
component-forge validate
```

Reports:

- Missing required layers (error)
- Unknown layers not belonging to the architecture (warning)
- Slices missing a public API `index.ts` (warning)
- Empty barrel files — `index.ts` exists but has no exports (warning)
- Unknown directories inside `shared/` — only `ui`, `lib`, `api`, `config`, `model`, `types`, `hooks`, `assets`, `styles` are recognised (warning)

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

**Path alias support** — `check` understands aliased imports and checks them against the same layer rules as relative imports:

```ts
// All of these are analysed correctly:
import { Button } from '@/shared/ui/Button'
import { useAuth } from '~/src/features/auth'
import { User } from '@entities/user' // via tsconfig paths
```

Aliases are resolved automatically from `tsconfig.json` (`compilerOptions.paths`) plus the widely-used conventions `@/` and `~/src/`.

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

Version 1.7.0. Active development.

- [x] `init` — interactive FSD and Modular scaffolding, writes `forge.config.ts` directly
- [x] `generate` — typed slice templates, nested paths, dry-run with file content preview, spinner
- [x] `generate list` — scan and display all existing slices grouped by layer
- [x] `validate` — architecture enforcement, barrel content check, shared/ segment check
- [x] `check` — import boundary violations with actionable hints
- [x] `check --watch` — file watcher with diff output
- [x] `check --fix` — auto-rewrite violating imports
- [x] `check` — path alias support (`@/`, `~/src/`, tsconfig `paths`)
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
