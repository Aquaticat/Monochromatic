/**
 * Bun localStorage polyfill for the paper2vn smoke test.
 *
 * Plain Bun script mode does not expose `globalThis.localStorage`.
 * The page modules (`state.ts` etc.) read it at module load to
 * hydrate provider/settings/saves, so the shim has to be installed
 * **before** any of them is imported.
 *
 * Importing this module for its side effect runs the install before
 * the imports in the consumer's body are evaluated, since ES module
 * imports are evaluated in source order at module-load time.
 */
export {};

/**
 * Web Storage-compatible surface implemented by the in-memory shim.
 *
 * Mirrors the subset of the DOM `Storage` interface that the page modules
 * call into; the actual `Storage` type is part of the DOM lib and cannot
 * be implemented directly, so the shim is cast at the install seam.
 */
type StorageLike = {
  getItem(key: string,): string | null;
  setItem(
    key: string,
    value: string,
  ): void;
  removeItem(key: string,): void;
  clear(): void;
  readonly length: number;
  key(index: number,): string | null;
};

if (globalThis.localStorage
  === undefined) {
  /**
   * In-memory backing map used by the polyfilled storage methods.
   */
  const store = new Map<string, string>();
  /**
   * Web Storage-shaped facade over {@link store} for the smoke harness.
   */
  const shim: StorageLike = {
    getItem(key,): string | null {
      return store.get(key,)
        ?? null;
    },
    setItem(
      key,
      value,
    ): void {
      store.set(
        key,
        value,
      );
    },
    removeItem(key,): void {
      store.delete(key,);
    },
    clear(): void {
      store.clear();
    },
    /**
     * Web Storage `length` getter mirroring the backing map size.
     */
    get length(): number {
      return store.size;
    },
    key(index,): string | null {
      /**
       * Insertion-ordered snapshot of keys for the by-index lookup.
       */
      const keys = [...store.keys(),];
      return keys[index]
        ?? null;
    },
  };
  /*
   * The shim implements the Web Storage interface but does not
   * extend the DOM lib's `Storage` class. Cast at this seam.
   */
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
  globalThis.localStorage = shim as unknown as Storage;
}

/*
 * `openrouter.ts` reads `globalThis.location.origin` to populate the
 * `HTTP-Referer` header. In Bun script mode there is no `location`,
 * so the bundled call would crash before fetch. Stub a minimal
 * `Location`-shaped object so the adapter sees a stable origin string.
 *
 * A real `Location` has many fields the smoke does not need; only the
 * subset the adapters reference is populated, then cast at the seam.
 */
// oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
globalThis.location ??= {
  origin: 'http://localhost.paper2vn.smoke',
  href: 'http://localhost.paper2vn.smoke/',
  protocol: 'http:',
  host: 'localhost.paper2vn.smoke',
  hostname: 'localhost.paper2vn.smoke',
  port: '',
  pathname: '/',
  search: '',
  hash: '',
} as unknown as Location;
