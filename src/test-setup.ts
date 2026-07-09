/**
 * Vitest-only setup (wired via angular.json's `test.options.setupFiles`).
 * The Angular CLI's Node+jsdom unit-test environment doesn't expose a
 * working `localStorage` global (Node 22+'s own experimental Web Storage
 * global shadows it, warning "--localstorage-file was not provided"
 * instead of falling through to jsdom's implementation) - this polyfills
 * an in-memory Storage so storage.service.spec.ts can exercise the real
 * code path. Never included in the production build.
 */
class MemoryStorage implements Storage {
  private readonly store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

if (!globalThis.localStorage) {
  Object.defineProperty(globalThis, 'localStorage', {
    value: new MemoryStorage(),
    configurable: true,
    writable: true,
  });
}
