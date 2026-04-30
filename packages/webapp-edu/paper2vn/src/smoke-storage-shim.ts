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
type StorageLike = {
  getItem(key: string,): string | null;
  setItem(key: string, value: string,): void;
  removeItem(key: string,): void;
  clear(): void;
  readonly length: number;
  key(index: number,): string | null;
};

if (globalThis.localStorage === undefined) {
  const store = new Map<string, string>();
  const shim: StorageLike = {
    getItem(key,): string | null {
      return store.has(key,) ? store.get(key,)! : null;
    },
    setItem(
      key,
      value,
    ): void {
      store.set(
        key,
        String(value,),
      );
    },
    removeItem(key,): void {
      store.delete(key,);
    },
    clear(): void {
      store.clear();
    },
    get length(): number {
      return store.size;
    },
    key(index,): string | null {
      const keys = [...store.keys()];
      return keys[index] ?? null;
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
 */
if (globalThis.location === undefined) {
  /*
   * A real `Location` has many fields the smoke does not need; we only
   * implement the subset the adapters reference. Cast at the seam.
   */
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
  globalThis.location = {
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
}
