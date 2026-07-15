/**
 * Minimal `process` global shim for browser environments.
 *
 * PostCSS and Bun's node:path polyfill reference `process.env` and
 * `process.cwd()` without `typeof` guards. This module must be imported
 * before any code that depends on `process` (e.g. postcss, node:path polyfill).
 *
 * Side-effect-only import: sets `globalThis.process` if missing.
 */
/**
 * Returns the root directory as the current working directory.
 *
 * @returns Root path string
 */
function stubCwd(): string {
  return '/';
}

if (globalThis.process
  === undefined) {
  (globalThis as Record<string, unknown>).process = {
    env: {},
    cwd: stubCwd,
    versions: {},
  };
}

export {};
