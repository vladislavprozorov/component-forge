# component-forge

🌐 [English](README.md) | Русский

> CLI инструмент для масштабируемых React проектов с акцентом на архитектуру.

Инструмент, обеспечивающий структурную дисциплину через готовые архитектурные шаблоны — Feature-Sliced Design (FSD) и Модульную архитектуру.

---

## Зачем это нужно

React даёт гибкость — но не структуру.

В растущих командах это часто приводит к:

- непоследовательным структурам папок
- размытым границам между слоями
- тесной связанности между фичами
- архитектурной деградации со временем

**component-forge** решает это:

- стандартизированная структура проекта с первого дня
- чёткие архитектурные слои
- публичные API через файлы `index.ts`
- команда `validate` ловит нарушения до попадания в прод

> Это не просто инструмент генерации файлов. Это **инструмент контроля архитектуры**.

---

## Целевая аудитория

- React команды (3–10 разработчиков)
- Растущие стартапы с общей кодовой базой
- Разработчики, уже сталкивавшиеся с архитектурным хаосом
- Инженеры, ценящие структуру и долгосрочную поддерживаемость

> Не предназначен для новичков, изучающих основы React.

---

## Поддерживаемые архитектуры

### 1. Feature-Sliced Design (FSD)

Генерирует слоистую структуру:

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

Обеспечивает строгую иерархию слоёв — app → pages → widgets → features → entities → shared.
Нет глубоких импортов. Только публичный API через `index.ts`.

### 2. Модульная архитектура

Генерирует доменно-ориентированную структуру:

```
src/
 ├─ modules/
 │   ├─ auth/
 │   ├─ profile/
 │   └─ dashboard/
 ├─ shared/
 └─ core/
```

Фокус на разделении по доменам и масштабируемом владении кодом.

---

## Установка

```bash
# Глобальная установка
npm install -g component-forge

# Без установки (рекомендуется для разового использования)
npx component-forge init fsd
```

---

## Команды

### init

Создаёт структуру папок и записывает `.component-forge.json`.

```bash
component-forge init fsd
component-forge init modular
```

### generate

Генерирует слайс с готовыми файлами.

```bash
# FSD слайсы
component-forge generate feature auth
component-forge generate entity user
component-forge generate widget Header
component-forge generate page dashboard

# Компоненты (размещаются в shared/ui)
component-forge generate component Button
component-forge generate component forms/Input

# Модульная архитектура
component-forge generate module profile

# Короткий алиас
component-forge g feature auth
```

Что генерируется для `generate feature auth`:

```
src/features/auth/
 ├─ index.ts          <- публичный API
 ├─ ui/Auth.tsx       <- React компонент
 ├─ model/index.ts   <- состояние / хуки
 └─ api/index.ts     <- запросы к данным
```

### validate

Проверяет структуру проекта на соответствие настроенной архитектуре.

```bash
component-forge validate
```

Проверяет:
- Обязательные слои присутствуют (ошибка)
- Неизвестные слои, не относящиеся к архитектуре (предупреждение)
- Слайсы без публичного API `index.ts` (предупреждение)

Завершается с кодом `1` при ошибках — подходит для CI.

---

## Конфигурация проекта

После `init` создаётся файл `.component-forge.json`:

```json
{
  "architecture": "fsd",
  "srcDir": "src"
}
```

Все команды читают этот конфиг автоматически. Флаги после init не нужны.

---

## Философия

- **Мнение > Гибкость** — строгие настройки по умолчанию исключают лишние решения
- **Структура > Свобода** — ограничения обеспечивают масштабирование
- **Предсказуемость > Импровизация** — каждый в команде знает где что лежит
- **Контроль > Соглашение** — `validate` ловит отклонения до того как они становятся долгом

---

## Разработка

```bash
git clone https://github.com/vladislavprozorov/component-forge.git
cd component-forge
npm install
npm run build
node dist/index.js init fsd
```

> Требуется Node.js 20+.

---

## Статус проекта

Активная разработка. Основные команды работают. API может измениться до версии 1.0.

- [x] `init` — скаффолдинг FSD и Modular
- [x] `generate` — слайсы с шаблонами файлов
- [x] `validate` — контроль архитектуры
- [ ] Флаг `generate --dry-run`
- [ ] Кастомные шаблоны через конфиг
- [ ] Расширение для VS Code

---

## Участие в проекте

См. [CONTRIBUTING.md](CONTRIBUTING.md).

Пожалуйста, открой issue перед отправкой крупных изменений.

---

## Лицензия

[MIT](LICENSE)
