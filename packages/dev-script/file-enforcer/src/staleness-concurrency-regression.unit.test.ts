import {
  access,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import {
  join,
  resolve,
} from 'node:path';
import { setTimeout as wait, } from 'node:timers/promises';
import { pathToFileURL, } from 'node:url';

import spawn from 'nano-spawn';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

//region Concurrency fixture helpers

/**
 * Source public entry imported by generated config fixtures.
 */
const SOURCE_INDEX_URL = pathToFileURL(join(
  import.meta.dirname,
  'index.ts',
),).href;

/**
 * Poll delay while coordinating child-process regression fixtures.
 */
const WAIT_POLL_MS = 10;

/**
 * Maximum polls before a child-process coordination fixture fails.
 */
const WAIT_ATTEMPTS = 200;

/**
 * Creates an isolated temp directory for concurrency regression tests.
 *
 * @returns Temp directory path.
 *
 * @example
 * ```ts
 * const tempDir = await setup();
 * ```
 */
async function setup(): Promise<string> {
  return await mkdtemp(join(
    tmpdir(),
    'file-enforcer-concurrency-regression-',
  ),);
}

/**
 * Removes an isolated temp directory.
 *
 * @param tempDir - Directory returned by {@link setup}.
 *
 * @example
 * ```ts
 * await teardown(tempDir);
 * ```
 */
async function teardown(tempDir: string,): Promise<void> {
  await rm(
    tempDir,
    {
      recursive: true,
      force: true,
    },
  );
}

/**
 * Returns JSON text for a generated TypeScript string literal.
 *
 * @param value - Value to quote.
 *
 * @returns JavaScript string literal source.
 *
 * @example
 * ```ts
 * const literal = jsString('/tmp/path');
 * ```
 */
function jsString(value: string,): string {
  return JSON.stringify(value,);
}

/**
 * Waits for every path to exist, throwing if child processes never signal ready.
 *
 * @param paths - Paths that must exist before returning.
 *
 * @example
 * ```ts
 * await waitForPaths([readyA, readyB]);
 * ```
 */
async function waitForPaths(paths: readonly string[],): Promise<void> {
  for (let attempt = 0; attempt < WAIT_ATTEMPTS; attempt += 1) {
    /**
     * Existence check results for every path in this poll.
     */
    // oxlint-disable-next-line no-await-in-loop -- polling must wait for each latest existence snapshot.
    const existing = await Promise.all(paths.map(async function pathExists(path,): Promise<boolean> {
      try {
        await access(path,);
        return true;
      }
      catch {
        return false;
      }
    },),);
    if (existing.every(function isPresent(value,): boolean {
      return value;
    },))
      return;
    // oxlint-disable-next-line no-await-in-loop -- polling delay is intentionally sequential between snapshots.
    await wait(WAIT_POLL_MS,);
  }

  throw new Error(`Timed out waiting for paths: ${paths.join(', ',)}`,);
}

//endregion Concurrency fixture helpers

await describe({
  name: 'file-enforcer staleness concurrency regressions',
  concurrency: 1,
  children: [
    it({
      name: 'concurrent manifest writers preserve both entries',
      timeout: 10_000,
      fn: async function concurrentManifestWritersMergeEntries(): Promise<void> {
        const tempDir = await setup();
        await using _cleanup = {
          [Symbol.asyncDispose](): Promise<void> {
            return teardown(tempDir,);
          },
        };
        const manifestPath = join(
          tempDir,
          'manifest.json',
        );
        const releasePath = join(
          tempDir,
          'release',
        );
        const readyAPath = join(
          tempDir,
          'ready-a',
        );
        const readyBPath = join(
          tempDir,
          'ready-b',
        );
        const configAPath = join(
          tempDir,
          'config-a.ts',
        );
        const configBPath = join(
          tempDir,
          'config-b.ts',
        );

        /**
         * Creates one child config that records a manifest entry, signals readiness,
         * then waits so both children flush at the same time.
         *
         * @param dest - Destination path managed by child config.
         *
         * @param content - Content child config writes.
         *
         * @param readyPath - Marker path written after manifest entry is staged.
         *
         * @returns TypeScript source for child config.
         *
         * @example
         * ```ts
         * const source = childConfig({ dest: './a.txt', content: 'a', readyPath });
         * ```
         */
        function childConfig(
          {
            dest,
            content,
            readyPath,
          }: {
            readonly content: string;
            readonly dest: string;
            readonly readyPath: string;
          },
        ): string {
          return `
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { setTimeout as wait } from 'node:timers/promises';
import { overwrite } from ${jsString(SOURCE_INDEX_URL,)};

await overwrite({
  dest: ${jsString(dest,)},
  content: ${jsString(content,)},
  manifestPath: ${jsString(manifestPath,)},
});
await writeFile(${jsString(readyPath,)}, 'ready');
while (!existsSync(${jsString(releasePath,)})) {
  await wait(${String(WAIT_POLL_MS,)});
}
`;
        }
        await writeFile(
          configAPath,
          childConfig({
            dest: './a.txt',
            content: 'alpha',
            readyPath: readyAPath,
          },),
        );
        await writeFile(
          configBPath,
          childConfig({
            dest: './b.txt',
            content: 'bravo',
            readyPath: readyBPath,
          },),
        );

        const childRuns = Promise.all([
          spawn('node', [configAPath,], { cwd: tempDir, },),
          spawn('node', [configBPath,], { cwd: tempDir, },),
        ],);
        await waitForPaths([readyAPath, readyBPath,],);
        await writeFile(
          releasePath,
          'go',
        );
        await childRuns;

        const manifest = JSON.parse(await readFile(manifestPath, 'utf8',),) as {
          readonly entries?: Record<string, unknown>;
        };
        expect(Object.keys(manifest.entries ?? {},).toSorted(),).toEqual([
          `single:${resolve(tempDir, 'a.txt',)}`,
          `single:${resolve(tempDir, 'b.txt',)}`,
        ],);
      },
    },),
  ],
},);
