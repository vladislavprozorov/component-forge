# component-forge

🌐 English | [Русский](README.ru.md)

[![npm version](https://img.shields.io/npm/v/@xanahlight/component-forge.svg)](https://www.npmjs.com/package/@xanahlight/component-forge)
[![Node.js](https://img.shields.io/node/v/@xanahlight/component-forge.svg)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> Architecture-first CLI for scalable React projects.

A tool that enforces structural discipline through predefined architectural templates — Feature-Sliced Design (FSD) and Modular Architecture.

---

## Why

React gives you flexibility — but not structure.

In growing teams this often leads to:

- inconsistent folder structures across engineers
- unclear layer boundaries and ownership
- tight coupling between features
- architectural degradation over time

**component-forge** solves this by providing:

- standardized project structure from day one
- enforced architectural layers
- public API boundaries via `index.ts` files
- a `validate` command that catches violations before they ship

> This is not just a scaffolding tool. It is an **architecture enforcement tool**.

---

## Target Audience

- React teams (3–10 developers)
- Growing startups with shared codebases
- Developers who have experienced architectural chaos
- Engineers who value structure and long-term maintainability

> Not designed for beginners learning React basics.

---

## Supported Architectures

### 1. Feature-Sliced Design (FSD)

Generates a layered structure:

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

Enforces strict layer hierarchy — app → pages → widgets → features → entities → shared.
No deep imports. Public API only via `index.ts`.

### 2. Modular Architecture

Generates a domain-oriented structure:

```
src/
 ├─ modules/
 │   ├─ auth/
 │   ├─ profile/
 │   └─ dashboard/
 ├─ shared/
 └─ core/
```

Focused on domain separation and scalable team ownership.

---

## Installation

```bash
# Global install
npm install -g @xanahlight/component-forge

# No install required (recommended for one-time setup)
npx @xanahlight/component-forge init fsd
```

---

## Commands

### init

Creates the folder structure and writes `.component-forge.json`.

```bash
component-forge init fsd
component-forge init modular
```

### generate

Generates a slice with pre-populated files.

```bash
# FSD slices
component-forge generate feature auth
component-forge generate entity user
component-forge generate widget Header
component-forge generate page dashboard

# Components (placed in shared/ui)
component-forge generate component Button
component-forge generate component forms/Input

# Modular
component-forge generate module profile

# Short alias
component-forge g feature auth
```

What gets generated for `generate feature auth`:

```
src/features/auth/
 ├─ index.ts          <- public API
 ├─ ui/Auth.tsx       <- React component
 ├─ model/index.ts   <- state / hooks
 └─ api/index.ts     <- data fetching
```

### validate

Validates your project structure against the configured architecture.

```bash
component-forge validate
```

Checks:

- Required layers are present (error)
- Unknown layers that do not belong to the architecture (warning)
- Slices missing a public API `index.ts` (warning)

Exits with code `1` on errors — suitable for CI pipelines.

---

## Project Config

After `init`, a `.component-forge.json` is created:

```json
{
  "architecture": "fsd",
  "srcDir": "src"
}
```

All commands read this config automatically. No flags needed after init.

---

## Custom Templates

You can override any built-in file template with your own [Handlebars](https://handlebarsjs.com/) (`.hbs`) files.

**1. Add a `templates` field to `.component-forge.json`:**

```json
{
  "architecture": "fsd",
  "srcDir": "src",
  "templates": ".forge-templates"
}
```

**2. Create `.hbs` files mirroring the built-in structure:**

```
.forge-templates/
 └─ feature/
      └─ index.ts.hbs        ← overrides built-in index.ts for features
```

**Available template variables:**

| Variable | Description | Example |
| --- | --- | --- |
| `{{name}}` | Raw slice name | `auth` |
| `{{Name}}` | PascalCase name | `Auth` |
| `{{sliceType}}` | Slice type | `feature` |

**Example `.forge-templates/feature/index.ts.hbs`:**

```handlebars
// {{sliceType}} public API
export { {{Name}} } from './ui/{{Name}}'
export type { {{Name}}Props } from './ui/{{Name}}'
```

Any template file not found in your custom directory automatically falls back to the built-in default.

---

## Philosophy

- **Opinionated > Flexible** — strong defaults prevent decision fatigue
- **Structure > Freedom** — constraints enable scale
- **Predictability > Improvisation** — anyone on the team knows where things live
- **Enforcement > Convention** — `validate` catches drift before it becomes debt

---

## Development

```bash
git clone https://github.com/vladislavprozorov/component-forge.git
cd component-forge
npm install
npm run build
node dist/index.js init fsd
```

> Node.js 20+ required.

---

## Project Status

Active development. Core commands are functional. API may change before 1.0.

- [x] `init` — FSD and Modular scaffolding
- [x] `generate` — slices with file templates
- [x] `validate` — architecture enforcement
- [x] `generate --dry-run` — preview without writing
- [x] Custom templates via config
- [ ] VS Code extension

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Please open an issue before submitting large changes.

---

## License

[MIT](LICENSE)
