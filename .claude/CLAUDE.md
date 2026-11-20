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

Read [ARCHITECTURE.md](../ARCHITECTURE.md) and [DESIGN-typester.md](../DESIGN-typester.md)
before changing a feature. In particular:

- **No NgRx or other state library.** State is signals: `core/store.ts` for
  anything persisted, component signals for the rest.
- **Game rules live only in `core/engine.ts` and `core/words.ts`**, which
  have zero Angular imports and are tested with plain Vitest. Time is passed
  in (`press(char, now)`, `tick(now)`); never put timers or `Date.now()`
  inside them. Components render `Run.view()` and add sound and effects;
  they never re-implement scoring, clocks or word choice.
- **Mode lives in the route** (`/play/:mode`, checked by `modeGuard`). Never
  gate navigation with a mutable flag service.
- **No DOM writes for reactive values.** Clocks, bars and keycaps render from
  signals. The confetti canvas in `ui/burst.ts` is the one imperative
  drawing surface.
- **Words are bundled** (`shared/data/words.ts`); the app makes no runtime
  network requests. The Daily must stay deterministic: seeded RNG over the
  bundled list, supply called in index order.
- **Sound is synthesized** with Web Audio (`core/sound.ts`); ship no audio files.
- **Persistence is one versioned localStorage entry** via `Store`, falling back
  to defaults on unreadable data. Bump `version` and migrate if the shape changes.
- **No third-party UI kit.** Tailwind plus the tokens in `src/styles.css`;
  every colour, size and duration traces to a token. Interactive keycaps use
  `.key`.
- **Every transition uses a `--d-*` duration token** so reduced motion works
  without per-component code.
- Before adding a runtime npm dependency, confirm it works without `zone.js`.
