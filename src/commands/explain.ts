import chalk from 'chalk'

// ---------------------------------------------------------------------------
// Content registry
// Each topic is a function returning formatted string — lazy, testable, pure.
// ---------------------------------------------------------------------------

type TopicRenderer = () => string

const TOPICS: Record<string, TopicRenderer> = {
  fsd: renderFsd,
  modular: renderModular,
  layers: renderLayers,
  all: renderAll,
}

export const AVAILABLE_TOPICS = Object.keys(TOPICS) as readonly string[]

// ---------------------------------------------------------------------------
// Rendering helpers
// ---------------------------------------------------------------------------

const h1 = (text: string) => chalk.bold.white(`\n  ${text}\n`)
const h2 = (text: string) => chalk.bold.cyan(`\n  ${text}`)
const rule = () => chalk.gray(`  ${'─'.repeat(58)}`)
const line = (text: string) => `  ${text}`
const dim = (text: string) => chalk.gray(text)
const tag = (text: string) => chalk.bgCyan.black(` ${text} `)
const ok = (text: string) => `  ${chalk.green('✓')} ${text}`
const no = (text: string) => `  ${chalk.red('✗')} ${text}`
const arrow = (from: string, to: string, allowed: boolean) =>
  `  ${chalk.cyan(from.padEnd(12))} ${allowed ? chalk.green('→') : chalk.red('✗')} ${chalk.white(to)}`

// ---------------------------------------------------------------------------
// FSD topic
// ---------------------------------------------------------------------------

function renderFsd(): string {
  return [
    h1('Feature-Sliced Design (FSD)'),
    rule(),
    line(''),
    line(
      'FSD is an architectural methodology for frontend applications that organises',
    ),
    line('code by ' + chalk.bold('business features') + ' instead of technical roles.'),
    line(''),

    h2('Layer hierarchy  (low → high)'),
    line(''),
    line(`  ${tag('shared')}   ${dim('Reusable UI, utilities, constants — no business logic')}`),
    line(`  ${tag('entities')} ${dim('Business entities: User, Order, Product')}`),
    line(`  ${tag('features')} ${dim('User actions: auth, search, payment')}`),
    line(`  ${tag('widgets')}  ${dim('Composite blocks assembled from entities + features')}`),
    line(`  ${tag('pages')}    ${dim('Full application screens')}`),
    line(`  ${tag('app')}      ${dim('App-wide: router, providers, global styles')}`),
    line(''),

    h2('Import rules'),
    line(''),
    arrow('features', 'entities', true),
    arrow('features', 'shared', true),
    arrow('features', 'features', false),
    arrow('entities', 'features', false),
    arrow('shared', 'entities', false),
    line(''),
    line(dim('  A layer may only import from layers below it.')),
    line(''),

    h2('Public API rule'),
    line(''),
    line('  Each slice must expose its interface through a single ' + chalk.cyan('index.ts') + ':'),
    line(''),
    line(chalk.gray('    features/auth/index.ts  ← public API')),
    line(chalk.gray('    features/auth/model.ts  ← private implementation')),
    line(''),
    line(ok('import { useAuth } from "@/features/auth"')),
    line(no('import { authStore } from "@/features/auth/model"')),
    line(''),

    rule(),
    line(''),
    line(`  ${chalk.bold('component-forge init fsd')}   — scaffold FSD structure`),
    line(`  ${chalk.bold('component-forge check')}       — validate FSD boundaries`),
    line(''),
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Modular topic
// ---------------------------------------------------------------------------

function renderModular(): string {
  return [
    h1('Modular Architecture'),
    rule(),
    line(''),
    line('Modular architecture organises code into self-contained ' + chalk.bold('modules')),
    line('that encapsulate a business domain end-to-end.'),
    line(''),

    h2('Structure'),
    line(''),
    line(`  ${tag('core')}    ${dim('App-wide infra: routing, DI, config')}`),
    line(`  ${tag('modules')} ${dim('Business domains: AuthModule, CartModule')}`),
    line(`  ${tag('shared')}  ${dim('Design system, utilities, types')}`),
    line(''),

    h2('Import rules'),
    line(''),
    arrow('modules', 'modules', true),
    arrow('modules', 'shared', true),
    arrow('shared', 'modules', false),
    arrow('core', 'modules', false),
    line(''),
    line(dim('  shared and core must not depend on modules — they are foundational.')),
    line(''),

    h2('When to choose Modular vs FSD'),
    line(''),
    line(`  ${chalk.cyan('FSD')}     — large teams, complex domain, strict layer isolation`),
    line(`  ${chalk.cyan('Modular')} — medium apps, clear domain boundaries, less ceremony`),
    line(''),

    rule(),
    line(''),
    line(`  ${chalk.bold('component-forge init modular')} — scaffold modular structure`),
    line(`  ${chalk.bold('component-forge check')}        — validate modular boundaries`),
    line(''),
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Layers topic
// ---------------------------------------------------------------------------

function renderLayers(): string {
  const fsdLayers = [
    ['shared', 'Reusable: UI kit, utils, constants, types, API clients'],
    ['entities', 'Business objects with their data model and UI: User, Product'],
    ['features', 'User-facing use cases: LoginForm, AddToCart, SearchBar'],
    ['widgets', 'Complex composites: Header, Sidebar, ProductCard'],
    ['pages', 'Application routes/screens assembled from widgets'],
    ['app', 'Bootstrap: router, global providers, themes'],
  ] as const

  return [
    h1('FSD Layer Reference'),
    rule(),
    line(''),
    ...fsdLayers.flatMap(([name, desc]) => [
      `  ${chalk.bold.cyan(name)}`,
      line(chalk.gray(`    ${desc}`)),
      line(chalk.gray(`    Allowed imports: ${getAllowedBelow(name)}`)),
      '',
    ]),

    rule(),
    line(''),
    line(`  ${chalk.bold('component-forge explain fsd')} — full FSD overview`),
    line(`  ${chalk.bold('component-forge check')}       — detect boundary violations`),
    line(''),
  ].join('\n')
}

function getAllowedBelow(layer: string): string {
  const order = ['shared', 'entities', 'features', 'widgets', 'pages', 'app']
  const idx = order.indexOf(layer)
  if (idx <= 0) return idx === 0 ? 'none (bottom layer)' : 'unknown'
  return order.slice(0, idx).join(', ')
}

// ---------------------------------------------------------------------------
// All topics
// ---------------------------------------------------------------------------

function renderAll(): string {
  return [renderFsd(), renderModular(), renderLayers()].join('\n')
}

// ---------------------------------------------------------------------------
// Command entry point
// ---------------------------------------------------------------------------

/**
 * Renders and prints the requested topic to stdout.
 * Returns the rendered string so it can be tested without console output.
 */
export function renderTopic(topic: string): string {
  const renderer = TOPICS[topic.toLowerCase()]

  if (!renderer) {
    return [
      chalk.red(`\n  Unknown topic: "${topic}"\n`),
      line(`  Available topics: ${chalk.cyan(AVAILABLE_TOPICS.join(', '))}`),
      line(''),
      line(`  Example: ${chalk.bold('component-forge explain fsd')}`),
      line(''),
    ].join('\n')
  }

  return renderer()
}

export function explainCommand(topic: string): void {
  process.stdout.write(renderTopic(topic))
}
