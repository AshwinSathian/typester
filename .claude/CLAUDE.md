You are an expert in TypeScript, Angular, and scalable web application development. You write functional, maintainable, performant, and accessible code following Angular and TypeScript best practices.

## TypeScript Best Practices

- Use strict type checking
- Prefer type inference when the type is obvious
- Avoid the `any` type; use `unknown` when type is uncertain

## Angular Best Practices

- Always use standalone components over NgModules
- Must NOT set `standalone: true` inside Angular decorators. It's the default in Angular v20+.
- Do NOT set `changeDetection: ChangeDetectionStrategy.OnPush` explicitly. `OnPush` is the default in Angular v22+.
- Use signals for state management
- Implement lazy loading for feature routes
- Do NOT use the `@HostBinding` and `@HostListener` decorators. Put host bindings inside the `host` object of the `@Component` or `@Directive` decorator instead
- Use `NgOptimizedImage` for all static images.
  - `NgOptimizedImage` does not work for inline base64 images.

## Accessibility Requirements

- It MUST pass all AXE checks.
- It MUST follow all WCAG AA minimums, including focus management, color contrast, and ARIA attributes.

### Components

- Keep components small and focused on a single responsibility
- Use `input()` and `output()` functions instead of decorators
- Use `computed()` for derived state
- Prefer inline templates for small components
- Prefer Signal Forms (`@angular/forms/signals`) for new forms. They are stable in Angular v22+ and provide signal-based state, type-safe field access, and schema-based validation
- When not using Signal Forms, prefer Reactive forms instead of Template-driven ones
- Do NOT use `ngClass`, use `class` bindings instead
- Do NOT use `ngStyle`, use `style` bindings instead
- When using external templates/styles, use paths relative to the component TS file.

## State Management

- Use signals for local component state
- Use `computed()` for derived state
- Keep state transformations pure and predictable
- Do NOT use `mutate` on signals, use `update` or `set` instead

## Templates

- Keep templates simple and avoid complex logic
- Use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`
- Use the async pipe to handle observables
- Do not assume globals like (`new Date()`) are available.

## Services

- Design services around a single responsibility
- Use the `providedIn: 'root'` option for singleton services
- Prefer the `@Service` decorator over `@Injectable({providedIn: 'root'})` for new singleton services (Angular v22+)
- Use the `inject()` function instead of constructor injection

## Project-specific conventions (Typester)

Read [PLAN-typester.md](../PLAN-typester.md) and [DESIGN-typester.md](../DESIGN-typester.md)
before implementing any feature — they contain the phase-by-phase task list,
acceptance criteria, and full design-token/component spec this project holds
itself to. In particular:

- **No NgRx / no external state library.** All state is plain signal-based
  services under `core/services`. Do not introduce `@ngrx/*` — the RFC
  explicitly rejected it for this project's scope (see PLAN §D1).
- **Game config lives in the route**, not in a shared mutable service. The
  route is `/play/:mode/:difficulty/:duration`; a functional guard in
  `core/guards` validates it. Never reintroduce a boolean-flag service
  (`accessGame`-style) to gate navigation — this was the legacy app's core
  defect (PLAN §Background, defect #2).
- **`core/services/game-engine.ts` must have zero Angular imports.** It is
  pure TypeScript, unit-tested with plain Vitest (no `TestBed`). Angular
  components/services wrap it reactively via signals — they do not
  reimplement its logic.
- **No DOM manipulation for the timer or any other reactive value.** The
  legacy app's `timer.component.ts` used `getElementById`/`setInterval`
  directly — replaced by `TimerRing`, driven entirely by a `computed()`
  signal (PLAN §D4, DESIGN §Shared UI primitives).
- **No third-party UI kit** (no Angular Material, PrimeNG, Bootstrap).
  Styling is Tailwind CSS v4 utility classes plus the CSS custom-property
  design tokens defined in `DESIGN-typester.md` §Tokens — every color/
  spacing/motion value must trace back to a token, never a hardcoded literal.
- **No shipped audio or word-list assets fetched at runtime.** Sound is
  synthesized via Web Audio API (`core/services/sound.service.ts`); the word
  bank is a bundled static TS module (`shared/data/word-bank.ts`). Do not add
  a runtime fetch to a dictionary/audio API — this was a deliberate RFC
  decision (PLAN §D5, §D7) to keep the PWA fully offline-capable and avoid
  any future paid-API dependency.
- **Persistence is `localStorage` via `core/services/storage.service.ts`**,
  versioned and falling back to defaults on corrupted data — not IndexedDB
  (PLAN §D8).
- Before adding any new runtime npm dependency, confirm it doesn't assume
  `zone.js` is present — this app is zoneless.
