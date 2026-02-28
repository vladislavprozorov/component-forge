import { fmt } from '../../shared/format'

// ---------------------------------------------------------------------------
// Topic renderers — each is a pure function () => string
// Adding a new topic = add one entry here, zero changes elsewhere.
// ---------------------------------------------------------------------------

type TopicRenderer = () => string

export const TOPICS: Record<string, TopicRenderer> = {
  fsd: renderFsd,
  modular: renderModular,
  layers: renderLayers,
  all: renderAll,
}

// ---------------------------------------------------------------------------
// FSD
// ---------------------------------------------------------------------------

function renderFsd(): string {
  return [
    fmt.h1('Feature-Sliced Design (FSD)'),
    fmt.rule(),
    fmt.line(''),
    fmt.line(
      'FSD is an architectural methodology for frontend applications that organises',
    ),
    fmt.line('code by ' + fmt.dim('business features') + ' instead of technical roles.'),
    fmt.line(''),

    fmt.h2('Layer hierarchy  (low → high)'),
    fmt.line(''),
    fmt.line(`  ${fmt.tag('shared')}   ${fmt.dim('Reusable UI, utilities, constants — no business logic')}`),
    fmt.line(`  ${fmt.tag('entities')} ${fmt.dim('Business entities: User, Order, Product')}`),
    fmt.line(`  ${fmt.tag('features')} ${fmt.dim('User actions: auth, search, payment')}`),
    fmt.line(`  ${fmt.tag('widgets')}  ${fmt.dim('Composite blocks assembled from entities + features')}`),
    fmt.line(`  ${fmt.tag('pages')}    ${fmt.dim('Full application screens')}`),
    fmt.line(`  ${fmt.tag('app')}      ${fmt.dim('App-wide: router, providers, global styles')}`),
    fmt.line(''),

    fmt.h2('Import rules'),
    fmt.line(''),
    fmt.arrow('features', 'entities', true),
    fmt.arrow('features', 'shared', true),
    fmt.arrow('features', 'features', false),
    fmt.arrow('entities', 'features', false),
    fmt.arrow('shared', 'entities', false),
    fmt.line(''),
    fmt.line(fmt.dim('  A layer may only import from layers below it.')),
    fmt.line(''),

    fmt.h2('Public API rule'),
    fmt.line(''),
    fmt.line('  Each slice must expose its interface through a single index.ts:'),
    fmt.line(''),
    fmt.line(fmt.dim('    features/auth/index.ts  ← public API')),
    fmt.line(fmt.dim('    features/auth/model.ts  ← private implementation')),
    fmt.line(''),
    fmt.ok('import { useAuth } from "@/features/auth"'),
    fmt.no('import { authStore } from "@/features/auth/model"'),
    fmt.line(''),

    fmt.rule(),
    fmt.line(''),
    fmt.line('  component-forge init fsd   — scaffold FSD structure'),
    fmt.line('  component-forge check       — validate FSD boundaries'),
    fmt.line(''),
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Modular
// ---------------------------------------------------------------------------

function renderModular(): string {
  return [
    fmt.h1('Modular Architecture'),
    fmt.rule(),
    fmt.line(''),
    fmt.line('Modular architecture organises code into self-contained modules'),
    fmt.line('that encapsulate a business domain end-to-end.'),
    fmt.line(''),

    fmt.h2('Structure'),
    fmt.line(''),
    fmt.line(`  ${fmt.tag('core')}    ${fmt.dim('App-wide infra: routing, DI, config')}`),
    fmt.line(`  ${fmt.tag('modules')} ${fmt.dim('Business domains: AuthModule, CartModule')}`),
    fmt.line(`  ${fmt.tag('shared')}  ${fmt.dim('Design system, utilities, types')}`),
    fmt.line(''),

    fmt.h2('Import rules'),
    fmt.line(''),
    fmt.arrow('modules', 'modules', true),
    fmt.arrow('modules', 'shared', true),
    fmt.arrow('shared', 'modules', false),
    fmt.arrow('core', 'modules', false),
    fmt.line(''),
    fmt.line(fmt.dim('  shared and core must not depend on modules — they are foundational.')),
    fmt.line(''),

    fmt.h2('When to choose Modular vs FSD'),
    fmt.line(''),
    fmt.line('  FSD     — large teams, complex domain, strict layer isolation'),
    fmt.line('  Modular — medium apps, clear domain boundaries, less ceremony'),
    fmt.line(''),

    fmt.rule(),
    fmt.line(''),
    fmt.line('  component-forge init modular — scaffold modular structure'),
    fmt.line('  component-forge check        — validate modular boundaries'),
    fmt.line(''),
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Layers
// ---------------------------------------------------------------------------

const FSD_LAYERS = [
  ['shared', 'Reusable: UI kit, utils, constants, types, API clients'],
  ['entities', 'Business objects with their data model and UI: User, Product'],
  ['features', 'User-facing use cases: LoginForm, AddToCart, SearchBar'],
  ['widgets', 'Complex composites: Header, Sidebar, ProductCard'],
  ['pages', 'Application routes/screens assembled from widgets'],
  ['app', 'Bootstrap: router, global providers, themes'],
] as const

function getAllowedBelow(layer: string): string {
  const order = ['shared', 'entities', 'features', 'widgets', 'pages', 'app']
  const idx = order.indexOf(layer)
  if (idx <= 0) return idx === 0 ? 'none (bottom layer)' : 'unknown'
  return order.slice(0, idx).join(', ')
}

function renderLayers(): string {
  return [
    fmt.h1('FSD Layer Reference'),
    fmt.rule(),
    fmt.line(''),
    ...FSD_LAYERS.flatMap(([name, desc]) => [
      `  ${fmt.dim(name)}`,
      fmt.line(fmt.dim(`    ${desc}`)),
      fmt.line(fmt.dim(`    Allowed imports: ${getAllowedBelow(name)}`)),
      '',
    ]),

    fmt.rule(),
    fmt.line(''),
    fmt.line('  component-forge explain fsd — full FSD overview'),
    fmt.line('  component-forge check       — detect boundary violations'),
    fmt.line(''),
  ].join('\n')
}

// ---------------------------------------------------------------------------
// All
// ---------------------------------------------------------------------------

function renderAll(): string {
  return [renderFsd(), renderModular(), renderLayers()].join('\n')
}
