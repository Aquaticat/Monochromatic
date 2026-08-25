/**
 * Tests that every place reporting a caught failure names it rather than
 * repeating what it said.
 *
 * SEPARATE FROM `message-names-only.unit.test.ts`, which asks the other half of
 * the same question. That one reads the CLASSES and decides which may repeat
 * their message. This one reads the SINKS: the four places that catch a failure
 * while reading an artifact, a lock file or a run file, and print or record a
 * reason for it. A marked class is only safe if the sink actually asks.
 *
 * WHY AN UNREADABLE FILE AND NOT A MALFORMED ONE. A malformed file reaches
 * every sink through `parseRunJson`, which already wraps it in a marked class,
 * so `refusalText` and a bare `error.message` return the same string and no
 * case here could tell them apart. Reverting all four sinks to the bare message
 * and running the whole suite proved exactly that: 686 of 686 still passed.
 *
 * A file that will not OPEN is the case that separates them. It used to arrive
 * as an ordinary `Error` reading
 *
 *   EACCES: permission denied, open '/tmp/attribution-read-XXXX/Basket.json'
 *
 * and a run directory path names the run, while under `artifacts/` a file's own
 * stem is a person's entry id. So these cases mode a fixture to `000` and pin
 * what comes back.
 *
 * EACH CASE CHECKS ITS OWN FIXTURE FIRST. A run as root opens a mode-`000` file
 * regardless, which would leave every assertion below testing the happy path
 * while reporting a pass, so the helper reads the file back and refuses if it
 * succeeded.
 *
 * Fixtures are cat-themed invention. No corpus content appears here.
 *
 * @module
 */

import { spawnSync, } from 'node:child_process';
import {
  chmod,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  gatherAttributionEntries,
  lockRunsDir,
  readPlacement,
} from '../../dist/final/node/index.mjs';

//region Sink naming tests

/**
 * What a command left on its two streams.
 */
type CommandStreams = {
  /**
   * Everything the command wrote to stdout.
   */
  readonly stdout: string;

  /**
   * Everything the command wrote to stderr.
   */
  readonly stderr: string;
};

/**
 * Runs one command and returns both its streams, whatever it exited with.
 *
 * A NON-ZERO EXIT IS NOT A FAILURE TO RUN HERE. `editor-standing-read` exits 1
 * on a fixture that recorded no judged rounds, which is its own verdict and has
 * nothing to do with the refusal these cases read. `spawnSync` reports a status
 * rather than throwing on one, which is why it is used instead of a promisified
 * `execFile`: that one rejects on any non-zero exit and hides the streams on the
 * rejection.
 *
 * @param args - argv the command receives, entry point first
 *
 * @returns Both streams as the command left them
 *
 * @throws Error where the command never started at all
 *
 * @example
 * ```ts
 * const { stderr, } = streamsOf({ args: [STANDING_ENTRY, dir,], },);
 * ```
 */
function streamsOf(
  { args, }: { readonly args: readonly string[]; },
): CommandStreams {
  /**
   * Command as it finished, or why it never started.
   */
  const finished = spawnSync(
    process.execPath,
    [...args,],
    { encoding: 'utf8', },
  );

  // A SPAWN FAULT IS NOT AN EMPTY REPORT. Reading past it would leave every
  // assertion below searching two empty strings and passing on a build that is
  // not there.
  if (finished.error !== undefined)
    throw new Error(
      `the command never started, so nothing here was exercised (${finished.error.name})`,
    );

  return {
    stdout: finished.stdout,
    stderr: finished.stderr,
  };
}

/**
 * Artifact file every case makes unreadable.
 */
const UNREADABLE = 'Basket.json';

/**
 * Lock file name `lockRunsDir` competes for, which it does not take as input.
 */
const LOCK_FILE = 'pass.lock';

/**
 * Command whose sink the CLI case exercises.
 */
const STANDING_COMMAND = 'editor-standing-read';

/**
 * Built entry point for {@link STANDING_COMMAND}.
 *
 * The module exports nothing, so its sink is reachable only by running it,
 * which is also how an operator meets it.
 */
const STANDING_ENTRY = join(
  import.meta.dirname,
  '..',
  '..',
  'dist',
  'final',
  'node',
  `${STANDING_COMMAND}.mjs`,
);

/**
 * Opening a filesystem error used to print, which must appear nowhere.
 *
 * Kept as its own constant so each case asserts against the exact shape that
 * leaked rather than against a paraphrase of it.
 */
const LEAKED_OPENING = "permission denied, open '";

/**
 * Refusal every sink is expected to report for a file that will not open.
 *
 * BUILT PER FILE rather than shared as one constant, because the lock case
 * cannot choose its file name: `lockRunsDir` competes for `pass.lock` and takes
 * only the directory.
 *
 * @param file - base name the sink should report, never a path
 *
 * @returns Sentence the guarded reader builds for an unopenable file
 *
 * @example
 * ```ts
 * expect(reason,).toBe(namedRefusal({ file: UNREADABLE, },),);
 * ```
 */
function namedRefusal(
  { file, }: { readonly file: string; },
): string {
  return `could not read ${file} as JSON (EACCES)`;
}

/**
 * Pipeline commit the sound fixture records.
 */
const SHARED_TIP = 'f'.repeat(40,);

/**
 * Built pipeline the sound fixture records.
 */
const SHARED_GENERATION = `sha256-tree-v1:${'f'.repeat(64,)}`;

/**
 * One artifact that parses, so a reader has a pool to place it in.
 *
 * The attribution reader throws rather than returning an empty pool, so a
 * directory holding only the broken fixture never reaches the sink at all.
 */
const SOUND_ARTIFACT = JSON.stringify({
  tip: SHARED_TIP,
  pipelineDigest: SHARED_GENERATION,
  artifactSchemaVersion: 1,
  id: 'Whiskers',
  chunkCritics: [
    {
      sliceIndex: 0,
      heardCriticIds: ['hf:openai/gpt-oss-120b',],
      claimAttributions: [],
    },
  ],
  issues: [],
},);

/**
 * Makes a throwaway directory that removes itself, whatever a case leaves in it.
 *
 * @param prefix - what to call it, so a leaked directory names its case
 *
 * @returns Directory path, disposable
 *
 * @example
 * ```ts
 * await using scratch = await throwaway({ prefix: 'sink-placement-', },);
 * ```
 */
async function throwaway(
  { prefix, }: { readonly prefix: string; },
): Promise<{ readonly dir: string; } & AsyncDisposable> {
  /**
   * Throwaway directory, never a real runs directory.
   */
  const dir = await mkdtemp(join(
    tmpdir(),
    prefix,
  ),);

  return {
    dir,
    async [Symbol.asyncDispose](): Promise<void> {
      // Removing a file needs write permission on its DIRECTORY rather than on
      // the file, so a mode-000 fixture comes out without being chmoded back.
      await rm(
        dir,
        {
          recursive: true,
          force: true,
        },
      );
    },
  };
}

/**
 * Writes a file nothing may open, and proves it cannot be opened.
 *
 * @param dir - directory to write into
 *
 * @param name - file to write
 *
 * @param body - contents, which no case should ever get to see
 *
 * @returns Path written
 *
 * @throws Error where the file opened anyway, which a run as root would do
 *
 * @example
 * ```ts
 * const path = await unopenable({ dir, name: UNREADABLE, body: '{}', },);
 * ```
 */
async function unopenable(
  {
    dir,
    name,
    body,
  }: {
    readonly dir: string;
    readonly name: string;
    readonly body: string;
  },
): Promise<string> {
  /**
   * Path of the fixture.
   */
  const path = join(
    dir,
    name,
  );

  await writeFile(
    path,
    body,
    'utf8',
  );
  await chmod(
    path,
    0o000,
  );

  try {
    await readFile(
      path,
      'utf8',
    );
  } catch (refused) {
    // THE REFUSAL IS THE PROOF, so it is read rather than discarded. A file
    // that declined for some other reason would send a different class to the
    // sink, and every assertion below would be about a case nobody chose.
    if (Error.isError(refused,)
      && ('code' in refused)
      && (refused.code === 'EACCES'))
      return path;

    throw new Error(
      `${name} declined to open, but not for want of permission, so this case `
        + 'would exercise a refusal it was not written for',
      { cause: refused, },
    );
  }

  throw new Error(
    `${name} opened at mode 000, so this case would test a readable file while `
      + 'reporting a pass. Run the suite as an ordinary user rather than as root.',
  );
}

/**
 * Collects what would have gone to stdout, restoring the real one on disposal.
 *
 * @param lines - collector the caller reads afterwards
 *
 * @returns Collected lines, and the restore that disposal runs
 *
 * @example
 * ```ts
 * using printed = collectingLogs({ lines: [], },);
 * ```
 */
function collectingLogs(
  { lines, }: { readonly lines: string[]; },
): { readonly lines: readonly string[]; } & Disposable {
  /**
   * Real reporter, put back on disposal.
   */
  const reported = console.log;

  console.log = (...parts: readonly unknown[]) => {
    lines.push(parts.map(String,)
      .join(' ',),);
  };
  return {
    lines,
    [Symbol.dispose]: () => {
      console.log = reported;
    },
  };
}

await describe({
  name: 'a sink reporting a failure names it',
  children: [
    it({
      name: 'NAMES the code where an artifact will not open, in the reason it '
        + 'hands its caller, since that reason travels into a report',
      fn: async () => {
        await using scratch = await throwaway({ prefix: 'sink-attribution-', },);

        await writeFile(
          join(
            scratch.dir,
            'Whiskers.json',
          ),
          SOUND_ARTIFACT,
          'utf8',
        );
        await unopenable({
          dir: scratch.dir,
          name: UNREADABLE,
          body: SOUND_ARTIFACT,
        },);

        // The census prints its own POOL lines, which are not what this case
        // reads, and letting them through would bury the runner's output.
        using swallowed = collectingLogs({ lines: [], },);

        /**
         * What the directory yielded.
         */
        const { malformed, } = await gatherAttributionEntries({
          artifactsDir: scratch.dir,
        },);

        expect(malformed,).toHaveLength(1,);
        expect(malformed[0]?.name,).toBe(UNREADABLE,);
        expect(malformed[0]?.reason,).toBe(namedRefusal({ file: UNREADABLE, },),);
        expect(swallowed.lines.length,).toBeGreaterThan(0,);
      },
    },),
    it({
      name: 'REFUSES to put the path in the reason, which is the whole point: a '
        + "run directory names the run and an artifact's stem is a person",
      fn: async () => {
        await using scratch = await throwaway({ prefix: 'sink-attribution-', },);

        await writeFile(
          join(
            scratch.dir,
            'Whiskers.json',
          ),
          SOUND_ARTIFACT,
          'utf8',
        );
        await unopenable({
          dir: scratch.dir,
          name: UNREADABLE,
          body: SOUND_ARTIFACT,
        },);

        using swallowed = collectingLogs({ lines: [], },);

        /**
         * What the directory yielded.
         */
        const { malformed, } = await gatherAttributionEntries({
          artifactsDir: scratch.dir,
        },);

        /**
         * Everything the reader said, its own report included.
         */
        const said = [
          ...swallowed.lines,
          ...malformed.map(function reasonOf(one,): string {
            return one.reason;
          },),
        ].join('\n',);

        expect(said.includes(scratch.dir,),).toBe(false,);
        expect(said.includes(LEAKED_OPENING,),).toBe(false,);
      },
    },),
    it({
      name: 'NAMES the code on the POOL line where a placement will not open, '
        + 'rather than printing the path the filesystem error carried',
      fn: async () => {
        await using scratch = await throwaway({ prefix: 'sink-placement-', },);

        await unopenable({
          dir: scratch.dir,
          name: UNREADABLE,
          body: SOUND_ARTIFACT,
        },);

        using printed = collectingLogs({ lines: [], },);

        /**
         * How the unreadable artifact placed.
         */
        const placement = await readPlacement({
          artifactsDir: scratch.dir,
          name: UNREADABLE,
        },);

        expect(placement.kind,).toBe('malformed',);
        expect(printed.lines,).toHaveLength(1,);
        expect(printed.lines[0],).toBe(
          `POOL malformed ${UNREADABLE}: ${namedRefusal({ file: UNREADABLE, },)}`,
        );
      },
    },),
    it({
      name: 'NAMES the code on the LOCK line where the lock file will not open, '
        + 'and still takes the lock over, since an unreadable lock holds nobody',
      fn: async () => {
        await using scratch = await throwaway({ prefix: 'sink-lock-', },);

        /**
         * Lock file naming a live holder that nothing can read.
         */
        const lockPath = await unopenable({
          dir: scratch.dir,
          name: LOCK_FILE,
          body: JSON.stringify({
            pid: process.pid,
            startedAt: new Date().toISOString(),
          },),
        },);

        using printed = collectingLogs({ lines: [], },);

        await using _held = await lockRunsDir({ runsDir: scratch.dir, },);

        /**
         * Everything the claim said.
         */
        const said = printed.lines.join('\n',);

        expect(said.includes(
          `LOCK ${lockPath} unreadable (${namedRefusal({ file: LOCK_FILE, },)})`,
        ),).toBe(true,);
        expect(said.includes(LEAKED_OPENING,),).toBe(false,);
      },
    },),
    it({
      name: 'NAMES the code where a standing artifact will not open, run as an '
        + 'operator runs it, since the module exports nothing to call directly',
      fn: async () => {
        await using scratch = await throwaway({ prefix: 'sink-standing-', },);

        /**
         * Artifact the command will meet and fail to open.
         */
        const path = await unopenable({
          dir: scratch.dir,
          name: UNREADABLE,
          body: SOUND_ARTIFACT,
        },);

        /**
         * What the command printed, on both streams.
         */
        const { stderr, } = streamsOf({
          args: [
            STANDING_ENTRY,
            scratch.dir,
          ],
        },);

        expect(stderr.includes(
          `${STANDING_COMMAND}: ${path} refused, ${namedRefusal({ file: UNREADABLE, },)}`,
        ),).toBe(true,);
        expect(stderr.includes(LEAKED_OPENING,),).toBe(false,);
      },
    },),
  ],
  concurrency: 1,
},);

//endregion Sink naming tests
