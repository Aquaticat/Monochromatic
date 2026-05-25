import type { stat as Stat, } from 'node:fs/promises';
import type {
  dirname as Dirname,
  join as Join,
} from 'node:path';

import type {
  LogRecord,
  Sink,
} from '../types.ts';

/**
 * Module-local mutable state grouped in a `const` container so module-root
 * state stays out of a top-level `let` (`no-module-root-let` would otherwise
 * reject it). `appendFile` and `filePath` are populated during verification
 * and read by `write`; `verifyPromise` memoizes concurrent verification so a
 * caller arriving mid-flight shares the same async work and never sees the
 * initial `available = false`; `available` flips true once the test write
 * round-trips.
 */
const state: {
  // oxlint-disable-next-line typescript/consistent-type-imports -- typeof import() cannot use import type syntax
  appendFile: typeof import('node:fs/promises').appendFile | null;
  filePath: string | null;
  verifyPromise: Promise<boolean> | null;
  available: boolean;
} = {
  appendFile: null,
  available: false,
  filePath: null,
  verifyPromise: null,
};

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
    readonly cwd: string;
    readonly stat: typeof Stat;
    readonly dirname: typeof Dirname;
    readonly join: typeof Join;
  },
): Promise<string | undefined> {
  /** Directory being tested in this iteration; either resolves to a node_modules or triggers the walk to the parent. */
  const candidate = join(
    cwd,
    'node_modules',
  );
  try {
    /** Stat result for `candidate`; only directories count as a hit, guarding against a sibling file also named `node_modules`. */
    const entry = await stat(candidate,);
    if (entry.isDirectory())
      return candidate;
  }
  catch {
    /* ENOENT or similar; keep walking up */
  }
  /** Parent directory used by the next recursive step; equal to `cwd` only at the filesystem root, which terminates the walk. */
  const parent = dirname(cwd,);
  if (parent === cwd)
    return undefined;
  return await findNodeModulesUp({
    cwd: parent,
    stat,
    dirname,
    join,
  },);
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
  if ((globalThis.process
    === undefined)
    || (globalThis.process
      .versions
      ?.node
      === undefined))
  {
    state.available = false;
    return false;
  }

  try {
    // Dynamic import for Node.js modules: cache appendFile for use in fileSink.write
    /** Dynamically imported `node:fs/promises`; held in this scope so its members are reused without re-importing. */
    const fs = await import('node:fs/promises');
    /** Path utilities dynamically imported alongside `fs`; needed by the upward search for the closest node_modules. */
    const {
      dirname,
      join,
    } = await import('node:path');

    state.appendFile = fs.appendFile;

    /** Resolved absolute path of the closest ancestor `node_modules`, or undefined when none exists (e.g. a stray cwd). */
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
      // UPDATE: Will cause noise when the thing being ran is a bin,
      // and running for a different language ecosystem.
      // Disabled by default.
      // console.warn(
      //   `logger fs sink disabled: no ancestor node_modules found from cwd ${process.cwd()}`,
      // );
      state.available = false;
      return false;
    }

    /** Directory under the chosen `node_modules` where every monochromatic log file lands. */
    const LOG_DIR = join(
      nodeModulesDir,
      '.monochromatic',
    );
    await fs.mkdir(
      LOG_DIR,
      { recursive: true, },
    );

    /** ISO timestamp with colons replaced by dashes so it can be embedded in a cross-platform file name. */
    const timestamp = new Date().toISOString()
      .replaceAll(
      ':',
      '-',
    );
    state.filePath = join(
      LOG_DIR,
      `${timestamp}.log.jsonl`,
    );

    // Verify by writing and reading test data
    /** Probe record written and read back to confirm the chosen file path round-trips. */
    const testData = `{"test":true,"timestamp":${Date.now()}}\n`;
    await state.appendFile(
      state.filePath,
      testData,
    );
    /** Probe contents read back; matching the literal `"test":true` proves the append + read path works end-to-end. */
    const content = await fs.readFile(
      state.filePath,
      'utf8',
    );
    state.available = content.includes('"test":true',);
  }
  catch {
    state.available = false;
  }

  return state.available;
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
  if (state.verifyPromise
    !== null)
    return state.verifyPromise;

  state.verifyPromise = runVerify();
  return state.verifyPromise;
}

/**
 * Writes a single record as a JSONL line to the resolved log file.
 *
 * @param record - log record to write
 */
async function write(record: LogRecord,): Promise<void> {
  // oxlint-disable-next-line typescript/strict-boolean-expressions -- filePath is string|null, checking both conditions
  if ((!state.available) || (!state.filePath)
    || (!state.appendFile))
    return;

  try {
    await state.appendFile(
      state.filePath,
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
