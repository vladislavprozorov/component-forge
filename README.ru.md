# component-forge

[English](README.md) | [Русский](README.ru.md)

[![npm version](https://img.shields.io/npm/v/@xanahlight/component-forge.svg)](https://www.npmjs.com/package/@xanahlight/component-forge)
[![CI](https://github.com/vladislavprozorov/component-forge/actions/workflows/ci.yml/badge.svg)](https://github.com/vladislavprozorov/component-forge/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/node/v/@xanahlight/component-forge.svg)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> CLI с акцентом на архитектуру для масштабируемых React-проектов.

Обеспечивает структурную дисциплину через готовые архитектурные шаблоны — Feature-Sliced Design (FSD) и Модульную архитектуру.

---

## Зачем

React даёт гибкость — но не структуру.

В растущих командах это часто приводит к:

- несогласованным структурам папок
- размытым границам слоёв
- тесной связанности фич между собой
- архитектурной деградации со временем

**component-forge** решает это:

- стандартизированная структура с первого дня
- чёткие архитектурные слои
- публичные API через файлы `index.ts`
- команды, которые ловят нарушения до попадания в прод

> Это не просто инструмент генерации файлов. Это инструмент контроля архитектуры.

---

## Для кого

- React-команды (3–10 разработчиков)
- Растущие стартапы с общей кодовой базой
- Разработчики, уже столкнувшиеся с архитектурным хаосом
- Инженеры, ценящие структуру и долгосрочную поддерживаемость

---

## Поддерживаемые архитектуры

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

Строгая иерархия слоёв: app импортирует из pages, pages из widgets, и так далее вниз до shared. Кросс-слоевые и одноуровневые импорты запрещены. Публичный API только через `index.ts`.

### Модульная архитектура

```
src/
 ├─ modules/
 │   ├─ auth/
 │   ├─ profile/
 │   └─ dashboard/
 ├─ shared/
 └─ core/
```

Доменно-ориентированное разделение. Модули независимы; shared и core имеют ограниченные правила импортов.

---

## Установка

```bash
# Глобально
npm install -g @xanahlight/component-forge

# Без установки (для разовой настройки)
npx @xanahlight/component-forge init
```

---

## Команды

### init

Интерактивная настройка — если архитектура не передана, спрашивает в диалоге. Создаёт `forge.config.ts`.

```bash
component-forge init
component-forge init fsd
component-forge init modular
```

### generate

Генерирует слайс с готовыми файлами по типу. Поддерживает вложенные пути.

```bash
component-forge generate feature auth
component-forge generate entity user
component-forge generate widget Header
component-forge generate page dashboard
component-forge generate component Button
component-forge generate module profile

# Вложенный путь — слайс создаётся внутри поддиректории
component-forge generate feature auth/LoginForm
component-forge generate entity user/profile/Address

# Предпросмотр без записи файлов
component-forge generate feature auth --dry-run

# Короткий алиас
component-forge g feature auth
```

Что создаёт `generate feature auth`:

```
src/features/auth/
 ├─ index.ts
 ├─ ui/Auth.tsx
 ├─ model/index.ts
 └─ api/index.ts
```

Каждый тип слайса генерирует свой набор файлов. Полная таблица — `component-forge generate --help`.

### validate

Проверяет структуру папок на соответствие настроенной архитектуре.

```bash
component-forge validate
```

Сообщает о:

- Отсутствующих обязательных слоях (ошибка)
- Неизвестных слоях, не относящихся к архитектуре (предупреждение)
- Слайсах без публичного `index.ts` (предупреждение)

Завершается с кодом `1` при ошибках — подходит для CI.

### check

Сканирует исходные файлы и сообщает о нарушениях импортов через границы архитектурных слоёв.

```bash
component-forge check

# Watch-режим — перезапускается автоматически при изменении файлов
component-forge check --watch

# Авто-исправление — перезаписывает нарушающие импорты на shared/<slice>
component-forge check --fix
```

Каждое нарушение выводится с конкретной подсказкой о правильном исправлении. Завершается с кодом `1` при наличии нарушений.

### migrate

Анализирует текущую структуру проекта и составляет пошаговый план миграции.

```bash
# Только план без изменений
component-forge migrate --to fsd
component-forge migrate --to modular

# Применить — реально переместить файлы
component-forge migrate --to fsd --execute

# Применить с резервной копией
component-forge migrate --to fsd --execute --backup
```

После успешного `--execute` конфиг проекта обновляется автоматически.

### explain

Выводит документацию по архитектуре прямо в терминале.

```bash
component-forge explain fsd
component-forge explain modular
component-forge explain layers
component-forge explain slices
component-forge explain segments
```

---

## Конфигурация

`init` создаёт `forge.config.ts` в корне проекта:

```ts
import { defineConfig } from '@xanahlight/component-forge'

export default defineConfig({
  architecture: 'fsd',
  srcDir: 'src',
})
```

Все команды читают этот конфиг автоматически. Также поддерживается устаревший `.component-forge.json`.

### Кастомные шаблоны

Замените любой встроенный шаблон своим файлом [Handlebars](https://handlebarsjs.com/) (`.hbs`).

Добавьте поле `templates` в конфиг:

```ts
export default defineConfig({
  architecture: 'fsd',
  srcDir: 'src',
  templates: '.forge-templates',
})
```

Создайте `.hbs`-файлы, повторяя встроенную структуру:

```
.forge-templates/
 └─ feature/
      └─ index.ts.hbs
```

Доступные переменные: `{{name}}`, `{{Name}}` (PascalCase), `{{sliceType}}`.

Любой файл, не найденный в кастомной директории, автоматически берётся из встроенных шаблонов.

---

## Философия

- Строгие настройки по умолчанию исключают лишние решения
- Ограничения обеспечивают масштабирование
- Предсказуемость — каждый в команде знает, где что лежит
- Контроль ловит отклонения до того, как они становятся техдолгом

---

## Разработка

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

Требуется Node.js 20+.

---

## Статус проекта

Версия 1.6.0. Активная разработка.

- [x] `init` — интерактивный скаффолдинг FSD и Modular
- [x] `generate` — типизированные шаблоны, вложенные пути, dry-run, спиннер
- [x] `validate` — контроль архитектуры
- [x] `check` — нарушения импортов с подсказками
- [x] `check --watch` — файловый вотчер с diff-выводом
- [x] `check --fix` — автоматическая перезапись нарушающих импортов
- [x] `migrate` — анализ и выполнение структурных миграций
- [x] `explain` — документация по архитектуре в терминале
- [x] `forge.config.ts` — TypeScript-конфиг с `defineConfig`
- [ ] Расширение для VS Code

---

## Участие в проекте

См. [CONTRIBUTING.md](CONTRIBUTING.md).

Пожалуйста, открой issue перед отправкой крупных изменений.

---

## Лицензия

[MIT](LICENSE)
