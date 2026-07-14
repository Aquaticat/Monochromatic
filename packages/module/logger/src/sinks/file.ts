import type { stat as Stat, } from 'node:fs/promises';
import type {
  dirname as Dirname,
  join as Join,
} from 'node:path';

import { reportLoggerInternalError, } from '../error-format.ts';

import type { Sink, } from '../types.ts';

/**
 * Sentinel returned by {@link findNodeModulesUp} when no ancestor directory
 * contains a `node_modules`. A unique symbol so it never collides with a real
 * path string the walk might otherwise return, keeping the result free of a
 * banned `string | undefined` union.
 *
 * @example
 * ```ts
 * const dir = await findNodeModulesUp({ cwd, stat, dirname, join });
 * if (dir === NO_NODE_MODULES_FOUND) {
 *   // no ancestor project root
 * }
 * ```
 */
export const NO_NODE_MODULES_FOUND: unique symbol = Symbol('logger:no-node-modules-found',);

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
 * @param reportError - logger fault reporter injected for deterministic tests
 *
 * @returns absolute path to the nearest ancestor `node_modules`, or
 * {@link NO_NODE_MODULES_FOUND} when no ancestor contains one
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
    reportError = reportLoggerInternalError,
  }: {
    readonly cwd: string;
    readonly stat: typeof Stat;
    readonly dirname: typeof Dirname;
    readonly join: typeof Join;
    readonly reportError?: typeof reportLoggerInternalError;
  },
): Promise<string | typeof NO_NODE_MODULES_FOUND> {
  /**
   * Directory being tested in this iteration; either resolves to a node_modules or triggers the walk to the parent.
   */
  const candidate = join(
    cwd,
    'node_modules',
  );
  try {
    /**
     * Stat result for `candidate`; only directories count as a hit, guarding against a sibling file also named `node_modules`.
     */
    const entry = await stat(candidate,);
    if (entry.isDirectory())
      return candidate;
  }
  catch (error: unknown) {
    // Missing candidate is expected while walking ancestors; only unexpected stat failures are logger faults.
    if (!(Error.isError(error,)
      && ('code' in error)
      && (error.code === 'ENOENT'))) {
      reportError({
        context: `node_modules candidate ${candidate} unavailable during file sink search`,
        error,
      },);
    }
  }
  /**
   * Parent directory used by the next recursive step; equal to `cwd` only at the filesystem root, which terminates the walk.
   */
  const parent = dirname(cwd,);
  if (parent === cwd)
    return NO_NODE_MODULES_FOUND;
  return await findNodeModulesUp({
    cwd: parent,
    stat,
    dirname,
    join,
    reportError,
  },);
}

/**
 * Builds a file sink that appends JSONL records to the nearest ancestor
 * `node_modules/.monochromatic/{timestamp}.log.jsonl` (resolved once during
 * verification). The resolved path, the cached `appendFile`, and the
 * verification memo live in this instance's closure (no module-global state),
 * so independent loggers and tests never share a log file or need a reset
 * hook. No `flush` hook: each `write` awaits `appendFile` directly, so there
 * is no buffered state to drain.
 *
 * @returns Sink backed by `node:fs/promises`.
 *
 * @example
 * ```ts
 * const { logger } = createLogger({ sinks: [createFileSink()] });
 * logger.error('unhandled rejection');
 * await logger.flush();
 * ```
 */
export function createFileSink(): Sink {
  /**
   * Instance-local file-sink resources. `appendFile` and `filePath` are
   * populated during verification and read by `write`; `verifyPromise`
   * memoizes concurrent verification so a caller arriving mid-flight shares
   * the same async work rather than starting a second probe.
   */
  const state: {
    // oxlint-disable-next-line typescript/consistent-type-imports -- typeof import() cannot use import type syntax
    appendFile?: typeof import('node:fs/promises').appendFile;
    filePath?: string;
    verifyPromise?: Promise<boolean>;
  } = {};

  /**
   * Actual verification work, invoked exactly once via the memoized
   * `verifyPromise`. Resolves the log path and caches `appendFile`, marking
   * the sink unavailable when the upward search yields
   * {@link NO_NODE_MODULES_FOUND}. The logger owns the resulting
   * availability, so no flag is kept here.
   *
   * @returns Whether file system logging is available.
   */
  async function runVerify(): Promise<boolean> {
    // Guard: skip dynamic import entirely outside Node.js to avoid
    // browser console errors from attempting to fetch node: URLs.
    if ((globalThis.process
      === undefined)
      || (globalThis.process
        .versions
        ?.node
        === undefined))
      return false;

    try {
      // Dynamic import for Node.js modules: cache appendFile for use in write.
      /**
       * Dynamically imported `node:fs/promises`; held in this scope so its members are reused without re-importing.
       */
      const fs = await import('node:fs/promises');
      /**
       * Path utilities dynamically imported alongside `fs`; needed by the upward search for the closest node_modules.
       */
      const {
        dirname,
        join,
      } = await import('node:path');

      state.appendFile = fs.appendFile;

      /**
       * Resolved absolute path of the closest ancestor `node_modules`, or the sentinel when none exists (e.g. a stray cwd).
       */
      const nodeModulesDir = await findNodeModulesUp({
        cwd: process.cwd(),
        stat: fs.stat,
        dirname,
        join,
      },);

      if (nodeModulesDir === NO_NODE_MODULES_FOUND)
        // Unexpected in a Node environment: the process is running JS, which
        // almost always means there is a node_modules upward. Marking the sink
        // unavailable (rather than creating one at a stray cwd) keeps stray log
        // directories out of build output.
        return false;

      /**
       * Directory under the chosen `node_modules` where every monochromatic log file lands.
       */
      const LOG_DIR = join(
        nodeModulesDir,
        '.monochromatic',
      );
      await fs.mkdir(
        LOG_DIR,
        { recursive: true, },
      );

      /**
       * ISO timestamp with colons replaced by dashes so it can be embedded in a cross-platform file name.
       */
      const timestamp = new Date().toISOString()
        .replaceAll(
        ':',
        '-',
      );
      state.filePath = join(
        LOG_DIR,
        `${timestamp}.log.jsonl`,
      );

      // Verify by writing and reading test data.
      /**
       * Probe record written and read back to confirm the chosen file path round-trips.
       */
      const testData = `{"test":true,"timestamp":${Date.now()}}\n`;
      await state.appendFile(
        state.filePath,
        testData,
      );
      /**
       * Probe contents read back; matching the literal `"test":true` proves the append + read path works end-to-end.
       */
      const content = await fs.readFile(
        state.filePath,
        'utf8',
      );
      return content.includes('"test":true',);
    }
    catch (error: unknown) {
      reportLoggerInternalError({
        context: 'file sink verification failed',
        error,
      },);
      return false;
    }
  }

  /**
   * Verifies file system availability via {@link runVerify}, memoizing
   * concurrent calls so a second caller never starts a duplicate probe.
   *
   * @returns Whether file system logging is available.
   */
  function verify(): Promise<boolean> {
    if (state.verifyPromise
      !== undefined)
      return state.verifyPromise;

    state.verifyPromise = runVerify();
    return state.verifyPromise;
  }

  /**
   * Writes a single record as a JSONL line to the resolved log file.
   *
   * @param record - Log record to write.
   *
   * @mutates record - `JSON.stringify` may invoke `toJSON`, getters, or proxy traps.
   */
  async function write(record: object,): Promise<void> {
    // oxlint-disable-next-line typescript/strict-boolean-expressions -- filePath/appendFile are optional (unset before verification); checking presence
    if ((!state.filePath) || (!state.appendFile))
      return;

    try {
      await state.appendFile(
        state.filePath,
        `${JSON.stringify(record,)}\n`,
      );
    }
    catch (error: unknown) {
      reportLoggerInternalError({
        context: 'file sink record append failed',
        error,
      },);
    }
  }

  return {
    verify,
    write,
  };
}
