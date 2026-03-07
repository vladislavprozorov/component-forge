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
  slices: renderSlices,
  segments: renderSegments,
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
// Slices
// ---------------------------------------------------------------------------

function renderSlices(): string {
  return [
    fmt.h1('Slices'),
    fmt.rule(),
    fmt.line(''),
    fmt.line('A ' + fmt.dim('slice') + ' is a self-contained unit of business logic inside a layer.'),
    fmt.line('Every slice owns exactly one responsibility and exposes a public API'),
    fmt.line('via a single ' + fmt.dim('index.ts') + ' barrel file.'),
    fmt.line(''),

    fmt.h2('Slice types by architecture'),
    fmt.line(''),
    fmt.line(`  ${fmt.tag('FSD')} slices live in layer directories:`),
    fmt.line(''),
    fmt.line(`    ${fmt.dim('features/')}   ${fmt.dim('auth')},  ${fmt.dim('search')},  ${fmt.dim('payment')}`),
    fmt.line(`    ${fmt.dim('entities/')}   ${fmt.dim('user')},  ${fmt.dim('order')},   ${fmt.dim('product')}`),
    fmt.line(`    ${fmt.dim('widgets/')}    ${fmt.dim('header')}, ${fmt.dim('sidebar')}, ${fmt.dim('productCard')}`),
    fmt.line(`    ${fmt.dim('pages/')}      ${fmt.dim('home')},  ${fmt.dim('profile')}, ${fmt.dim('checkout')}`),
    fmt.line(''),
    fmt.line(`  ${fmt.tag('Modular')} slices live in modules/:`),
    fmt.line(''),
    fmt.line(`    ${fmt.dim('modules/')}    ${fmt.dim('auth')},  ${fmt.dim('cart')},    ${fmt.dim('dashboard')}`),
    fmt.line(''),

    fmt.h2('Slice anatomy'),
    fmt.line(''),
    fmt.line(`  ${fmt.dim('features/auth/')}`),
    fmt.line(`    ${fmt.dim('index.ts')}      ← public API (only this file is imported by other layers)`),
    fmt.line(`    ${fmt.dim('ui/')}           ← React components`),
    fmt.line(`    ${fmt.dim('model/')}        ← state, stores, hooks, types`),
    fmt.line(`    ${fmt.dim('api/')}          ← server interaction`),
    fmt.line(''),

    fmt.h2('Public API rule'),
    fmt.line(''),
    fmt.ok('import { useAuth } from "@/features/auth"'),
    fmt.no('import { authStore } from "@/features/auth/model"'),
    fmt.line(''),
    fmt.line(fmt.dim('  Other layers must only import from the slice root (index.ts).')),
    fmt.line(fmt.dim('  Internal files (model, ui, api) are private implementation details.')),
    fmt.line(''),

    fmt.h2('Naming conventions'),
    fmt.line(''),
    fmt.line(`  ${fmt.dim('kebab-case')}     auth, user-profile, add-to-cart`),
    fmt.line(`  ${fmt.dim('camelCase')}      authStore, userProfile  (inside the slice)`),
    fmt.line(`  ${fmt.dim('PascalCase')}     AuthPage, UserCard       (React components)`),
    fmt.line(''),

    fmt.rule(),
    fmt.line(''),
    fmt.line('  component-forge generate feature auth   — scaffold a feature slice'),
    fmt.line('  component-forge list                    — show all existing slices'),
    fmt.line('  component-forge explain segments        — what goes inside a slice'),
    fmt.line(''),
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Segments
// ---------------------------------------------------------------------------

function renderSegments(): string {
  return [
    fmt.h1('Segments'),
    fmt.rule(),
    fmt.line(''),
    fmt.line('A ' + fmt.dim('segment') + ' is a technical sub-directory inside a slice or in shared/.'),
    fmt.line('Segments separate concerns within a slice by technical role.'),
    fmt.line(''),

    fmt.h2('Standard segments'),
    fmt.line(''),
    fmt.line(`  ${fmt.tag('ui')}      React components and styles`),
    fmt.line(fmt.dim('           Button.tsx, AuthForm.tsx, styles.module.css')),
    fmt.line(''),
    fmt.line(`  ${fmt.tag('model')}   State management, business logic, types`),
    fmt.line(fmt.dim('           store.ts, selectors.ts, types.ts, hooks.ts')),
    fmt.line(''),
    fmt.line(`  ${fmt.tag('api')}     Server communication — fetchers, mutations, DTOs`),
    fmt.line(fmt.dim('           authApi.ts, loginMutation.ts, dto.ts')),
    fmt.line(''),
    fmt.line(`  ${fmt.tag('lib')}     Utilities and helpers local to this slice`),
    fmt.line(fmt.dim('           formatDate.ts, validators.ts')),
    fmt.line(''),
    fmt.line(`  ${fmt.tag('config')}  Constants and configuration for this slice`),
    fmt.line(fmt.dim('           routes.ts, permissions.ts')),
    fmt.line(''),

    fmt.h2('Segments inside shared/'),
    fmt.line(''),
    fmt.line('  shared/ uses the same segments, but they serve the whole app:'),
    fmt.line(''),
    fmt.line(`  ${fmt.dim('shared/ui')}      — design system components (Button, Input, Modal)`),
    fmt.line(`  ${fmt.dim('shared/lib')}     — generic utilities (formatDate, debounce)`),
    fmt.line(`  ${fmt.dim('shared/api')}     — base HTTP client, interceptors`),
    fmt.line(`  ${fmt.dim('shared/config')}  — app-wide constants (routes, env vars)`),
    fmt.line(`  ${fmt.dim('shared/model')}   — shared types, global stores`),
    fmt.line(`  ${fmt.dim('shared/types')}   — TypeScript type definitions`),
    fmt.line(`  ${fmt.dim('shared/hooks')}   — generic reusable hooks`),
    fmt.line(''),

    fmt.h2('Which segments are required?'),
    fmt.line(''),
    fmt.line('  None are strictly required — use only what the slice needs.'),
    fmt.line('  component-forge generates the conventional set per slice type:'),
    fmt.line(''),
    fmt.line(`  ${fmt.dim('feature')}   → ui + model + api`),
    fmt.line(`  ${fmt.dim('entity')}    → model + api  (no UI)`),
    fmt.line(`  ${fmt.dim('widget')}    → ui + model   (no API)`),
    fmt.line(`  ${fmt.dim('page')}      → ui only`),
    fmt.line(`  ${fmt.dim('component')} → flat component file (no sub-segments)`),
    fmt.line(''),

    fmt.rule(),
    fmt.line(''),
    fmt.line('  component-forge explain slices   — what a slice is'),
    fmt.line('  component-forge generate --help  — full file table per slice type'),
    fmt.line(''),
  ].join('\n')
}

// ---------------------------------------------------------------------------
// All
// ---------------------------------------------------------------------------

function renderAll(): string {
  return [renderFsd(), renderModular(), renderLayers(), renderSlices(), renderSegments()].join('\n')
}
