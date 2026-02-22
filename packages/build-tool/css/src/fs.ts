/**
 * Environment-adaptive file reading.
 *
 * Checks the in-memory {@link fsRegistry} first (browser path),
 * then falls back to `node:fs` when running under Node/Bun.
 * This lets the same build pipeline work on the server (disk I/O)
 * and in the browser (pre-populated memory Map).
 */
import { fsRegistry, } from './fs-registry.ts';

/**
 * Whether the current runtime has Node-compatible `fs` APIs.
 * Bun and Node both set `process.versions.node`.
 */
const hasNodeFs = typeof process !== 'undefined' && process.versions?.node !== undefined;

/**
 * Eagerly loaded `node:fs` module, or undefined in browser.
 * Uses top-level await with a computed specifier (`'node' + ':fs'`)
 * so browser bundlers cannot statically resolve the import.
 * Loaded eagerly (not lazily) because sync functions like
 * {@link readCssFileSync} and {@link existsSync} cannot await.
 */
const nodeFs: typeof import('node:fs') | undefined = hasNodeFs
  ? await import('node' + ':fs') as typeof import('node:fs')
  : undefined;

/**
 * Reads a CSS file by absolute path.
 * Looks in {@link fsRegistry} first; falls back to `node:fs/promises`
 * when running server-side.
 * @param absolutePath - Absolute file path to read
 * @returns File contents as a UTF-8 string
 * @throws When the file is missing from both the registry and disk
 */
export async function readCssFile(absolutePath: string): Promise<string> {
  const cached = fsRegistry.get(absolutePath);
  if (cached !== undefined) {
    return cached;
  }

  if (nodeFs !== undefined) {
    const { readFile, } = await import('node:fs/promises');
    return readFile(absolutePath, 'utf-8');
  }

  throw new Error(`File not found in registry and no filesystem available: ${absolutePath}`);
}

/**
 * Synchronous variant of {@link readCssFile} for contexts that cannot be async
 * (e.g. inside PostCSS plugin walkers that don't support promises).
 * @param absolutePath - Absolute file path to read
 * @returns File contents as a UTF-8 string
 * @throws When the file is missing from both the registry and disk
 */
export function readCssFileSync(absolutePath: string): string {
  const cached = fsRegistry.get(absolutePath);
  if (cached !== undefined) {
    return cached;
  }

  if (nodeFs !== undefined) {
    return nodeFs.readFileSync(absolutePath, 'utf-8');
  }

  throw new Error(`File not found in registry and no filesystem available: ${absolutePath}`);
}

/**
 * Checks whether a file exists at the given absolute path.
 * Checks {@link fsRegistry} first, then disk.
 * @param absolutePath - Absolute file path to check
 * @returns Whether the file exists
 */
export function existsSync(absolutePath: string): boolean {
  if (fsRegistry.has(absolutePath)) {
    return true;
  }

  if (nodeFs !== undefined) {
    return nodeFs.existsSync(absolutePath);
  }

  return false;
}
