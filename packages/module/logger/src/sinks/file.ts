import type {
  stat as Stat,
} from 'node:fs/promises';
import type {
  dirname as Dirname,
  join as Join,
} from 'node:path';

import type {
  LogRecord,
  Sink,
} from '../types.ts';

/** Cached `appendFile` from `node:fs/promises`, set during verification. */
// oxlint-disable-next-line typescript/consistent-type-imports -- typeof import() cannot use import type syntax
let appendFile: typeof import('node:fs/promises').appendFile | null = null;

/** Path to the current log file, set during verification. */
let filePath: string | null = null;

/**
 * Cached verification promise so concurrent callers all wait on the same
 * async work. Without this, a caller arriving between "start verification"
 * and "verification resolves" would see the initial `available = false`
 * because a naive `verified` flag gets set synchronously at entry.
 */
let verifyPromise: Promise<boolean> | null = null;

/** Whether file system backend is available for logging. */
let available = false;

/**
 * Walks up from `cwd` to find the nearest ancestor directory containing a
 * `node_modules` subdirectory, returning that subdirectory's absolute path.
 *
 * Using find-up rather than cwd-relative placement keeps log directories
 * anchored to the project the caller actually belongs to. Without this,
 * scripts invoked from build output (e.g. `dist/`) or other stray cwds
 * would create `node_modules/.monochromatic/` inside those trees, polluting
 * shipped artifacts.
 *
 * Exported primarily so `index.unit.test.ts` can exercise both the hit
 * and miss paths directly with an injected `stat`.
 *
 * @param cwd - starting directory for the upward search
 *
 * @param stat - `node:fs/promises` stat (injected so the dynamic
 * import stays in one place)
 *
 * @param dirname - `node:path` dirname
 *
 * @param join - `node:path` join
 *
 * @returns absolute path to the nearest ancestor `node_modules`, or
 * `undefined` when no ancestor contains one
 *
 * @example
 * ```ts
 * const dir = await findNodeModulesUp({ cwd: process.cwd(), stat, dirname, join });
 * ```
 */
export async function findNodeModulesUp(
  {
    cwd,
    stat,
    dirname,
    join,
  }: {
    cwd: string;
    stat: typeof Stat;
    dirname: typeof Dirname;
    join: typeof Join;
  },
): Promise<string | undefined> {
  let dir = cwd;

  // oxlint-disable-next-line no-constant-condition -- terminates when dirname(dir) === dir (filesystem root)
  while (true) {
    const candidate = join(
      dir,
      'node_modules',
    );
    try {
      // oxlint-disable-next-line eslint/no-await-in-loop -- sequential walk-up requires awaiting each level
      const entry = await stat(candidate,);
      if (entry.isDirectory())
        return candidate;
    }
    catch {
      /* ENOENT or similar -- keep walking up */
    }
    const parent = dirname(dir,);
    if (parent === dir)
      return undefined;
    dir = parent;
  }
}

/**
 * Actual verification work, invoked exactly once via the memoized
 * `verifyPromise`. All concurrent callers of `verify()` share this
 * single promise, so `available` is only observed after it settles.
 *
 * @returns whether file system logging is available
 */
async function runVerify(): Promise<boolean> {
  // Guard: skip dynamic import entirely outside Node.js to avoid
  // browser console errors from attempting to fetch node: URLs
  // oxlint-disable-next-line typescript/no-unnecessary-condition -- runtime guard for browser environments where process is undefined
  if (globalThis.process === undefined
    // oxlint-disable-next-line typescript/no-unnecessary-condition -- process.versions may be absent in non-Node polyfills
    || globalThis.process.versions?.node === undefined)
  {
    available = false;
    return false;
  }

  try {
    // Dynamic import for Node.js modules -- cache appendFile for use in fileSink.write
    const fs = await import('node:fs/promises');
    const {
      dirname,
      join,
    } = await import('node:path');

    ({ appendFile, } = fs);

    const nodeModulesDir = await findNodeModulesUp({
      cwd: process.cwd(),
      stat: fs.stat,
      dirname,
      join,
    },);

    if (nodeModulesDir === undefined) {
      // Unexpected in a Node environment: the process is running JS,
      // which almost always means there is a node_modules upward.
      // Surface this so a silently-missing file sink is diagnosable.
      console.warn(
        `logger fs sink disabled: no ancestor node_modules found from cwd ${process.cwd()}`,
      );
      available = false;
      return false;
    }

    const LOG_DIR = join(
      nodeModulesDir,
      '.monochromatic',
    );
    await fs.mkdir(
      LOG_DIR,
      { recursive: true, },
    );

    const timestamp = new Date().toISOString().replaceAll(
      ':',
      '-',
    );
    filePath = join(
      LOG_DIR,
      `${timestamp}.log.jsonl`,
    );

    // Verify by writing and reading test data
    const testData = `{"test":true,"timestamp":${Date.now()}}\n`;
    await appendFile(
      filePath,
      testData,
    );
    const content = await fs.readFile(
      filePath,
      'utf8',
    );
    available = content.includes('"test":true',);
  }
  catch {
    available = false;
  }

  return available;
}

/**
 * Verifies file system is available (Node.js) and can write/read data.
 * Short-circuits in non-Node environments to prevent browsers from
 * attempting to fetch `node:` protocol URLs (which triggers CORS errors
 * even though the resulting exception is caught).
 *
 * Memoized: concurrent calls share a single in-flight verification,
 * preventing a race where a second caller saw `available = false`
 * before the first call settled.
 *
 * @returns whether file system logging is available
 *
 * @example
 * ```ts
 * if (await verifyFile()) {
 *   await fileSink.write(logRecord);
 * }
 * ```
 */
export function verifyFile(): Promise<boolean> {
  if (verifyPromise !== null)
    return verifyPromise;

  verifyPromise = runVerify();
  return verifyPromise;
}

/**
 * Writes a single record as a JSONL line to the resolved log file.
 *
 * @param record - log record to write
 */
async function write(record: LogRecord,): Promise<void> {
  // oxlint-disable-next-line typescript/strict-boolean-expressions -- filePath is string|null, checking both conditions
  if (!available || !filePath || !appendFile)
    return;

  try {
    await appendFile(
      filePath,
      `${JSON.stringify(record,)}\n`,
    );
  }
  catch (error) {
    console.error(
      `logger internal error in fs sink ${
        (Error.isError(error,))
          ? error.message
          : 'unknown non-Error error'
      }`,
    );
  }
}

/**
 * File sink that writes log records to the nearest ancestor
 * `node_modules/.monochromatic/` (resolved once during verification).
 * No `flush` hook: each `write` awaits `appendFile` directly, so there
 * is no buffered state to drain.
 *
 * @example
 * ```ts
 * await fileSink.write({ level: 'error', message: 'unhandled rejection', timestamp: Date.now() });
 * ```
 */
export const fileSink: Sink = {
  write,
};
