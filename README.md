# component-forge

🌐 English | [Русский](README.ru.md)

> Architecture-first CLI for scalable React projects.

A tool that enforces structural discipline through predefined architectural templates — Feature-Sliced Design (FSD) and Modular Architecture.

---

## Why

React gives you flexibility — but not structure.

In growing teams this often leads to:

- inconsistent folder structures
- unclear layer boundaries
- tight coupling between features
- architectural degradation over time

**component-forge** provides:

- standardized project structure
- enforced architectural layers
- public API boundaries via index files
- predictable scaling strategy

This is not just a scaffolding tool. It is an **architecture enforcement tool**.

---

## Target Audience

- React teams (3–10 developers)
- Growing startups
- Developers who have experienced architectural chaos
- Engineers who value structure and long-term maintainability

> Not designed for beginners learning React basics.

---

## Supported Architectures

### 1️⃣ Feature-Sliced Design (FSD)

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
```

Enforces:

- layer isolation
- public API via index files
- feature encapsulation
- predictable scaling rules

### 2️⃣ Modular Architecture

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

Focused on:

- domain separation
- internal module boundaries
- scalable team ownership

---

## Installation

```bash
# via npm
npm install -g component-forge

# via npx (no install required)
npx component-forge init --architecture fsd
```

---

## Commands

### Initialize project structure

```bash
component-forge init --architecture fsd
component-forge init --architecture modular
```

### Generate slice / module

```bash
component-forge generate feature auth
component-forge generate entity user
component-forge generate module profile
```

### Generate component

```bash
component-forge generate component Button
component-forge generate component forms/Input
```

---

## Philosophy

- **Opinionated > Flexible**
- **Structure > Freedom**
- **Predictability > Improvisation**
- **Scalability > Short-term speed**

This tool exists to reduce architectural entropy in React projects.

## Development

```bash
git clone https://github.com/vladislavprozorov/component-forge.git
cd component-forge
npm install
npm run build
```

> Node 20+ required.

---

## Project Status

Early development stage. Core architecture is being designed.

---

## Contributing

Contributions are welcome after MVP stabilization.
Please open an issue before submitting large changes.

---

## License

MIT
