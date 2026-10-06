/**
 Tests for the procedure a corpus pass runs, over everything a process would
 hand it: the environment, the clock, the git tip, the client and the
 settlement of one entry are all scripted, and the corpus is a throwaway
 repository of invented pages, so no case reads the operator's clone, runs
 directory or cache, or reaches a network.

 THE ORDER IS WHAT THESE HOLD: the lock before anything is read, the guards
 before anything is printed, the START line and the launch notes before the
 required providers are asked, the client built once and only after them, the
 plan returning before any page is written, and the pages republished before
 the first entry runs.

 Fixtures are cat-themed invention. No corpus content appears here.

 @module
 */

import {
  mkdir,
  readdir,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type CorpusPassInput,
  digestPipeline,
  type EntryOutcome,
  lockRunsDir,
  prepareRunsLayout,
  RunsDirectoryBusyError,
  runClientFrom,
  runCorpusPassOver,
  StatedRefusalError,
  writeDeclinedEntry,
} from '../../dist/final/node/index.mjs';
import {
  scratchDir,
  scratchDirWith,
} from '../scratch-dir.test-fixture.ts';
import { lineOf, } from './command-line.test-fixture.ts';
import { relayingConsoleLog, } from './console-log-capture.test-fixture.ts';
import { makeCorpusPassClone, } from './corpus-pass-clone.test-fixture.ts';
import { NO_OUTSIDE_READS, } from './pass-outside-reads.test-fixture.ts';
import { NO_PICTURE_SOURCES, } from './pass-picture-sources.test-fixture.ts';

/**
 Tip the scripted git read answers.
 */
const TIP = 'f'.repeat(40,);

/**
 Key a case hands the run's environment, which belongs to no provider.
 */
const INVENTED_KEY = 'a-key-no-provider-issued';

/**
 Instant the scripted clock keeps reading once its list is spent.
 */
const LAST_INSTANT = 1_042;

/**
 What a case watched the procedure do.
 */
type Watched = {
  /**
   Entries handed to the settlement, in order.
   */
  readonly settled: string[];

  /**
   Prompt payload directories the client was asked for, in order.
   */
  readonly clients: string[];

  /**
   What was on disk the moment the first entry was settled.
   */
  readonly atFirstSettle: { stalePageThere: boolean; };
};

/**
 The fields of the procedure's input a case may set itself.
 */
type Overrides = {
  /**
   Note naming the straggler window.
   */
  readonly graceNote?: string;

  /**
   Note naming the writer rounds' window.
   */
  readonly writerNote?: string;

  /**
   Environment the required providers' keys are read from.
   */
  readonly env?: CorpusPassInput['env'];

  /**
   HTTP the required providers' meters are read over.
   */
  readonly transport?: CorpusPassInput['transport'];
};

/**
 Transport a case must never reach, since no model is asked.

 @returns Never

 @throws Error always
 */
async function unreachedTransport(): ReturnType<CorpusPassInput['transport']> {
  throw new Error('the pass reached a transport this case never answers',);
}

/**
 Runs the procedure over a throwaway runs directory, corpus and build, with
 every effect scripted, and reports what it printed and did.

 @param typed - arguments after the command
 @param clone - throwaway corpus clone and its commit
 @param runsDir - throwaway runs directory
 @param pipelineDir - throwaway directory standing for the built pipeline
 @param watched - where to note what the procedure did
 @param overrides - fields of the procedure's input a case sets itself

 @returns What the procedure was handed back, once it ends

 @example
 ```ts
 await runPass({ typed: [], clone, runsDir, pipelineDir, watched, overrides: {}, },);
 ```
 */
async function runPass(
  {
    typed,
    clone,
    runsDir,
    pipelineDir,
    watched,
    overrides,
  }: {
    readonly typed: readonly string[];
    readonly clone: {
      readonly cloneDir: string;
      readonly commitSha: string;
    };
    readonly runsDir: string;
    readonly pipelineDir: string;
    readonly watched: Watched;
    readonly overrides: Overrides;
  },
): Promise<void> {
  /**
   Instants the scripted clock reads, then reads for ever.
   */
  const instants = [
    1_000,
    1_000,
    1_042,
  ];

  await runCorpusPassOver({
    line: lineOf({
      command: 'corpus-pass',
      typed,
    },),
    runsDir,
    graceNote: '',
    writerNote: '',
    pinSetting: {
      pin: clone,
      cloneDirSource: 'fallback',
      commitSource: 'fallback',
    },
    hardCapMs: 25_200_000,
    spendCeilingUsd: 20,
    driftAllowed: false,
    pipelineDir,
    readTip: async function readTip() {
      return TIP;
    },
    env: {},
    transport: unreachedTransport,
    newClient: function newClient({ promptPayloadDir, },) {
      watched.clients.push(promptPayloadDir,);
      return runClientFrom({
        env: { TRANSLATION_REPAIR_SYNTHETIC_API_KEY: INVENTED_KEY, },
        transport: unreachedTransport,
      },);
    },
    settle: async function settle({
      entry,
      artifactsDir,
      publishDir,
    },): Promise<EntryOutcome> {
      if (watched.settled.length === 0) {
        watched.atFirstSettle.stalePageThere = (await readdir(
          publishDir,
          { recursive: true, },
        )).includes(join(
          'people',
          'mittens',
          'page.en.md',
        ),);
      }
      watched.settled.push(entry.id,);
      await writeFile(
        join(
          artifactsDir,
          `${entry.id}.json`,
        ),
        '{}',
      );
      return { kind: 'settled', };
    },
    outsideReads: NO_OUTSIDE_READS,
    pictureSources: NO_PICTURE_SOURCES,
    now: function now() {
      return instants.shift() ?? LAST_INSTANT;
    },
    ...overrides,
  },);
}

/**
 Throwaway directory standing for the built pipeline, holding one built file.

 @returns The directory and the digest taken over it

 @example
 ```ts
 const { dir, digest, fileCount, } = await builtPipeline();
 ```
 */
async function builtPipeline(): Promise<{
  readonly dir: string;
  readonly digest: string;
  readonly fileCount: number;
} & AsyncDisposable> {
  return await scratchDirWith({
    prefix: 'corpus-pass-build-',
    setup: async function built({ path, },): Promise<{
      readonly dir: string;
      readonly digest: string;
      readonly fileCount: number;
    }> {
      await writeFile(
        join(
          path,
          'naps.mjs',
        ),
        'export const naps = 1;\n',
      );
      /**
       Digest and file count the procedure takes over it.
       */
      const stamp = await digestPipeline({ dir: path, },);
      return {
        dir: path,
        digest: stamp.digest,
        fileCount: stamp.fileCount,
      };
    },
  },);
}

/**
 Fresh record of what a case watches.

 @returns Nothing seen yet

 @example
 ```ts
 const watched = nothingWatched();
 ```
 */
function nothingWatched(): Watched {
  return {
    settled: [],
    clients: [],
    atFirstSettle: { stalePageThere: true, },
  };
}

await describe({
  name: runCorpusPassOver.name,
  concurrency: 1,
  children: [
    it({
      name: 'RUNS EVERY PENDING ENTRY ONCE and closes on what it finished of what it set out to run, over the '
        + 'build and the tip it was handed',
      fn: async (ctx) => {
        using printed = relayingConsoleLog({ sinon: ctx.sinon, },);
        await using clone = await makeCorpusPassClone({ entries: [{
          id: 'tabby',
          sourceText: '猫睡觉。\n',
          targetText: 'The cat naps.\n',
        },], },);
        await using runs = await scratchDir({ prefix: 'corpus-pass-run-', },);
        await using built = await builtPipeline();
        /**
         What the procedure did.
         */
        const watched = nothingWatched();

        await runPass({
          typed: [],
          clone,
          runsDir: runs.path,
          pipelineDir: built.dir,
          watched,
          overrides: {},
        },);

        expect(printed.lines,).toEqual([
          `START tip=${TIP} pipeline=${built.digest} files=${String(built.fileCount,)} pending=1 done=0 `
          + 'soft=259200000ms hard=25200000ms',
          'DONE processed=1 of pending=1; artifacts=1/92 elapsed=42ms',
        ],);
        expect(watched.settled,).toEqual(['tabby',],);
        expect(watched.clients,).toEqual([
          join(
            runs.path,
            'prompt-payloads',
          ),
        ],);
      },
    },),
    it({
      name: 'PRINTS EVERY LAUNCH NOTE it was handed after the START line, and the providers found wet',
      fn: async (ctx) => {
        using printed = relayingConsoleLog({ sinon: ctx.sinon, },);
        await using clone = await makeCorpusPassClone({ entries: [], },);
        await using runs = await scratchDir({ prefix: 'corpus-pass-run-', },);
        await using built = await builtPipeline();

        await runPass({
          typed: [
            '--require-providers',
            'hyper',
          ],
          clone,
          runsDir: runs.path,
          pipelineDir: built.dir,
          watched: nothingWatched(),
          overrides: {
            graceNote: 'a straggler note',
            writerNote: 'a writer note',
            env: { TRANSLATION_REPAIR_CHARM_HYPER_API_KEY: INVENTED_KEY, },
            transport: async function answerCredits() {
              return {
                status: 200,
                bodyText: '{"balance":243}',
              };
            },
          },
        },);

        expect(printed.lines,).toEqual([
          `START tip=${TIP} pipeline=${built.digest} files=${String(built.fileCount,)} pending=0 done=0 `
          + 'soft=259200000ms hard=25200000ms',
          'a straggler note',
          'a writer note',
          'REQUIRED-PROVIDERS hyper status=wet',
          'DONE processed=0 of pending=0; artifacts=0/92 elapsed=0ms',
        ],);
      },
    },),
    it({
      name: 'ENDS ON THE PLAN LINE under --plan, with the client built and no entry settled',
      fn: async (ctx) => {
        using printed = relayingConsoleLog({ sinon: ctx.sinon, },);
        await using clone = await makeCorpusPassClone({ entries: [{
          id: 'tabby',
          sourceText: '猫睡觉。\n',
          targetText: 'The cat naps.\n',
        },], },);
        await using runs = await scratchDir({ prefix: 'corpus-pass-run-', },);
        await using built = await builtPipeline();
        /**
         What the procedure did.
         */
        const watched = nothingWatched();

        await runPass({
          typed: ['--plan',],
          clone,
          runsDir: runs.path,
          pipelineDir: built.dir,
          watched,
          overrides: {},
        },);

        expect(printed.lines,).toEqual([
          `START tip=${TIP} pipeline=${built.digest} files=${String(built.fileCount,)} pending=1 done=0 `
          + 'soft=259200000ms hard=25200000ms',
          `PLAN ok tip=${TIP} pipeline=${built.digest} client=constructed pending=1 first=tabby`,
        ],);
        expect(watched.settled,).toEqual([],);
        expect(watched.clients.length,).toBe(1,);
      },
    },),
    it({
      name: 'REMOVES THE PAGE OF A DECLINED ENTRY BEFORE THE FIRST ENTRY RUNS, and counts the decline among those '
        + 'finished before it',
      fn: async (ctx) => {
        using printed = relayingConsoleLog({ sinon: ctx.sinon, },);
        await using clone = await makeCorpusPassClone({ entries: [{
          id: 'tabby',
          sourceText: '猫睡觉。\n',
          targetText: 'The cat naps.\n',
        },], },);
        await using runs = await scratchDir({ prefix: 'corpus-pass-run-', },);
        await using built = await builtPipeline();
        /**
         Paths the procedure keeps under the runs directory.
         */
        const layout = await prepareRunsLayout({ runsDir: runs.path, },);
        await writeDeclinedEntry({
          declinedDir: layout.declinedDir,
          record: {
            id: 'mittens',
            tip: TIP,
            pipelineDigest: built.digest,
            corpusSha: clone.commitSha,
            timestamp: '2026-09-08T21:00:00.000Z',
            reason: 'archive-original',
            note: 'The cat wrote this herself.',
          },
        },);
        await mkdir(
          join(
            layout.publishDir,
            'people',
            'mittens',
          ),
          { recursive: true, },
        );
        await writeFile(
          join(
            layout.publishDir,
            'people',
            'mittens',
            'page.en.md',
          ),
          'A page an earlier crash left.\n',
        );
        /**
         What the procedure did.
         */
        const watched = nothingWatched();

        await runPass({
          typed: [],
          clone,
          runsDir: runs.path,
          pipelineDir: built.dir,
          watched,
          overrides: {},
        },);

        expect(watched.atFirstSettle.stalePageThere,).toBe(false,);
        expect(printed.lines[0],).toBe(
          `START tip=${TIP} pipeline=${built.digest} files=${String(built.fileCount,)} pending=1 done=1 `
          + 'soft=259200000ms hard=25200000ms',
        );
      },
    },),
    it({
      name: 'REFUSES A RUNS DIRECTORY ANOTHER PASS HOLDS before it prints or reads anything',
      fn: async (ctx) => {
        using printed = relayingConsoleLog({ sinon: ctx.sinon, },);
        await using clone = await makeCorpusPassClone({ entries: [], },);
        await using runs = await scratchDir({ prefix: 'corpus-pass-run-', },);
        await using built = await builtPipeline();
        await using _held = await lockRunsDir({ runsDir: runs.path, },);
        /**
         What the procedure did.
         */
        const watched = nothingWatched();

        await expect(runPass({
          typed: [],
          clone,
          runsDir: runs.path,
          pipelineDir: built.dir,
          watched,
          overrides: {},
        },),).rejects.toBeInstanceOf(RunsDirectoryBusyError,);
        expect(printed.lines,).toEqual([],);
        expect(watched.clients,).toEqual([],);
      },
    },),
    it({
      name: 'REFUSES AN ARTIFACT NOTHING CAN PLACE before it prints, builds a client or settles anything',
      fn: async (ctx) => {
        using printed = relayingConsoleLog({ sinon: ctx.sinon, },);
        await using clone = await makeCorpusPassClone({ entries: [{
          id: 'tabby',
          sourceText: '猫睡觉。\n',
          targetText: 'The cat naps.\n',
        },], },);
        await using runs = await scratchDir({ prefix: 'corpus-pass-run-', },);
        await using built = await builtPipeline();
        /**
         Paths the procedure keeps under the runs directory.
         */
        const layout = await prepareRunsLayout({ runsDir: runs.path, },);
        await writeFile(
          join(
            layout.artifactsDir,
            'mittens.json',
          ),
          '{}',
        );
        /**
         What the procedure did.
         */
        const watched = nothingWatched();

        await expect(runPass({
          typed: [],
          clone,
          runsDir: runs.path,
          pipelineDir: built.dir,
          watched,
          overrides: {},
        },),).rejects.toBeInstanceOf(StatedRefusalError,);
        expect(printed.lines,).toEqual([
          'POOL mittens.json records an id that is not its file name (absent); treating it as unplaceable',
        ],);
        expect(watched.clients,).toEqual([],);
        expect(watched.settled,).toEqual([],);
      },
    },),
    it({
      name: 'REFUSES A REQUIRED PROVIDER THAT HAS NO KEY after the START line and before any client is built',
      fn: async (ctx) => {
        using printed = relayingConsoleLog({ sinon: ctx.sinon, },);
        await using clone = await makeCorpusPassClone({ entries: [], },);
        await using runs = await scratchDir({ prefix: 'corpus-pass-run-', },);
        await using built = await builtPipeline();
        /**
         What the procedure did.
         */
        const watched = nothingWatched();

        await expect(runPass({
          typed: [
            '--require-providers',
            'hyper',
          ],
          clone,
          runsDir: runs.path,
          pipelineDir: built.dir,
          watched,
          overrides: {},
        },),).rejects.toThrow('required provider hyper is not ready: key missing',);
        expect(printed.lines,).toEqual([
          `START tip=${TIP} pipeline=${built.digest} files=${String(built.fileCount,)} pending=0 done=0 `
          + 'soft=259200000ms hard=25200000ms',
        ],);
        expect(watched.clients,).toEqual([],);
      },
    },),
  ],
},);
