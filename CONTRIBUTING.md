# Contributing to component-forge

Thank you for your interest in contributing. This document outlines how to work with the project effectively.

---

## Before You Start

- Check existing [issues](https://github.com/vladislavprozorov/component-forge/issues) to avoid duplicates.
- For significant changes, **open an issue first** to discuss the approach.
- Small fixes (typos, docs) can go straight to a PR.

---

## Development Setup

```bash
git clone https://github.com/vladislavprozorov/component-forge.git
cd component-forge
npm install
npm run build
```

Test your changes locally:

```bash
node dist/index.js init fsd
node dist/index.js generate feature auth
node dist/index.js validate
```

---

## Branch Naming

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feature/<name>` | `feature/dry-run-flag` |
| Bug fix | `fix/<name>` | `fix/validate-message` |
| Refactor | `refactor/<name>` | `refactor/config-util` |
| Docs | `docs/<name>` | `docs/contributing` |
| Chore | `chore/<name>` | `chore/eslint-setup` |

---

## Commit Message Format

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>

[optional body]
```

Types: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`

Examples:
```
feat(generate): add --dry-run flag
fix(validate): use architecture name in unknown layer message
docs(readme): sync commands with actual CLI
```

---

## Code Style

- TypeScript strict mode — no `any`, no `@ts-ignore`
- All functions must have explicit return types
- Section dividers (`// ---`) for logical blocks within a file
- Comments in English

Run linter before committing:

```bash
npm run lint
npm run format
```

---

## Pull Request Checklist

- [ ] Branch created from `main`
- [ ] `npm run build` passes without errors
- [ ] `npm run lint` passes
- [ ] Commit messages follow Conventional Commits
- [ ] PR description explains *what* and *why*

---

## Project Philosophy

This tool is **opinionated by design**. When in doubt:

- Prefer fewer options over more flexibility
- Enforce constraints rather than document conventions
- Keep the CLI surface small and predictable

Changes that go against the architecture enforcement philosophy will not be merged.
