/**
 Tests the guard of the built commands at the boundary: a child that holds a
 provider key and does not name the command as the one it means to start
 refuses, and the same child naming it (as the command's task does), or a
 child that holds no key, goes on to what each command did before the guard.

 THE KEY IS INVENTED. `WHISKER_API_KEY` is no provider's variable, so a child
 holding it passes the guard's key test and still builds no client; nothing
 here can reach a provider. Every child is started by `runBuiltCommand` of the
 shared child fixture, whose `startedBy` says who the marker names, and the
 cases in this file name a runs directory, a lookup cache and a corpus clone
 under a scratch directory.

 Three commands stand for the three kinds: one that would build a client
 (`probe-sensitivity`), one report (`spend-report`) and one census
 (`cap-census`). The verdict's own cases are in `task-runner-guard.unit.test.ts`.

 Fixtures are cat-themed invention. No corpus content appears here.

 @module
 */

import {
  mkdir,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

import {
  DEFAULT_CONCURRENCY,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type ChildRun,
  runBuiltCommand,
  type StartedBy,
} from '../child-environment.test-fixture.ts';
import { scratchDir, } from '../scratch-dir.test-fixture.ts';
import {
  noKeyRefusal,
  scratchPlaces,
} from './keyless-built-command.test-fixture.ts';
import { HYPER_CHEAP, } from './spend-report.test-fixture.ts';

/**
 Exit code `reportingRefusals` sets for a stated refusal.
 */
const REFUSED_AS_STATED = 6;

/**
 What one command is shown to do: the arguments it is given under a scratch
 directory, and the whole result it leaves when the guard lets it go on.
 */
type GuardedCommand = {
  /**
   Name of the built command.
   */
  readonly command: string;

  /**
   Writes what the command reads under a scratch directory.

   @param directory - scratch directory the case owns

   @returns The command's arguments
   */
  readonly prepare: (directory: string,) => Promise<readonly string[]>;

  /**
   Everything the command leaves once the guard lets it go on.
   */
  readonly before: ChildRun;
};

/**
 The three commands the cases run.
 */
const COMMANDS: readonly GuardedCommand[] = [
  {
    command: 'probe-sensitivity',
    prepare: async function noArguments(): Promise<readonly string[]> {
      return [];
    },
    before: {
      code: REFUSED_AS_STATED,
      stdout: '',
      stderr: noKeyRefusal({ command: 'probe-sensitivity', },),
    },
  },
  {
    command: 'spend-report',
    prepare: async function oneLog(directory: string,): Promise<readonly string[]> {
      /**
       Log of one call.
       */
      const log = join(
        directory,
        'run.log',
      );
      await writeFile(
        log,
        `${HYPER_CHEAP}\n`,
      );
      return [log,];
    },
    before: {
      code: 0,
      stdout: [
        'spend-report: 1 log, 1 line, 1 seat',
        'metered seats, priced at rates read 2026-09-11:',
        '  gemma-4-26b-a4b-it: 10.84 credits (100.0%) over 1 call, in 1000000=2.44 out 1000000=8.40',
        'metered run total: 10.84 credits',
        '',
      ].join('\n',),
      stderr: '',
    },
  },
  {
    command: 'cap-census',
    prepare: async function emptyDirectory(directory: string,): Promise<readonly string[]> {
      /**
       Directory holding no log.
       */
      const logs = join(
        directory,
        'logs',
      );
      await mkdir(logs,);
      return [logs,];
    },
    before: {
      code: 0,
      stdout: [
        'cap-census: 0 logs, 0 pass-run logs, 0 completed calls, 0 on ids no card names, 0 paths unreadable; '
        + 'lines left out for a stamp the logger did not write: 0',
        'A rule reading can differ from a card for reasons that are not the model: a narrower log scope than the '
        + '2026-09-09 table, calls from before the caps, or calls the cap itself cut. Read each provider\'s cut '
        + 'columns before moving a cap; completion-cap.ts records the 2026-09-28 reading.',
        '',
      ].join('\n',),
      stderr: '',
    },
  },
];

/**
 The whole stderr of the guard's refusal for a child that holds one key.

 @param command - the command the child ran

 @returns The line `reportingRefusals` prints, with its newline

 @example
 ```ts
 expect(run.stderr,).toBe(guardRefusal({ command: 'spend-report', },),);
 ```
 */
function guardRefusal({ command, }: { readonly command: string; },): string {
  return `${command}: will not run in a process that holds provider keys `
    + '(1 variable whose name ends in _API_KEY has a value) unless that process names this command as the one it '
    + 'means to start. '
    + `The command's task does that: mise run //package/module/translation-repair:${command} `
    + '(the task builds the package first). '
    + 'To start the built file without building, as when a pass is running and nothing may rebuild, '
    + `set TRANSLATION_REPAIR_STARTED_BY=${command} for that one start. `
    + 'A process that holds no provider key needs neither.\n';
}

/**
 Runs one command of the table in a child under a scratch directory.

 @param guarded - the command and what it reads

 @param holdsKey - whether the child holds the invented key

 @param startedBy - who the child's marker says started it

 @returns What the child wrote and how it exited

 @example
 ```ts
 const run = await runGuarded({ guarded: COMMANDS[1], holdsKey: true, startedBy: 'nothing', },);
 ```
 */
async function runGuarded(
  {
    guarded,
    holdsKey,
    startedBy,
  }: {
    readonly guarded: GuardedCommand;
    readonly holdsKey: boolean;
    readonly startedBy: StartedBy;
  },
): Promise<ChildRun> {
  await using scratch = await scratchDir({ prefix: 'task-runner-guard-', },);
  return await runBuiltCommand({
    command: guarded.command,
    args: await guarded.prepare(scratch.path,),
    env: {
      ...scratchPlaces({
        runsDir: scratch.path,
        scratchDir: scratch.path,
      },),
      ...(holdsKey ? { WHISKER_API_KEY: 'purr', } : {}),
    },
    startedBy,
  },);
}

await describe({
  name: '',
  concurrency: 1,
  children: [
    ...COMMANDS.map(function guardedSuite(guarded,) {
      return describe({
        name: `${guarded.command} guarded as built`,
        concurrency: DEFAULT_CONCURRENCY,
        children: [
          it({
            name: `REFUSES as stated and exits 6 when the process holds a key and names no command, `
              + `before ${guarded.command} prints anything`,
            fn: async () => {
              expect(await runGuarded({ guarded, holdsKey: true, startedBy: 'nothing', },),).toEqual({
                code: REFUSED_AS_STATED,
                stdout: '',
                stderr: guardRefusal({ command: guarded.command, },),
              },);
            },
          },),

          it({
            name: `GOES ON to what ${guarded.command} did before when the process holds a key and names the `
              + 'command, as its own task does',
            fn: async () => {
              expect(await runGuarded({ guarded, holdsKey: true, startedBy: 'its own task', },),)
                .toEqual(guarded.before,);
            },
          },),

          it({
            name: `GOES ON to what ${guarded.command} did before when the process holds no key and names no command`,
            fn: async () => {
              expect(await runGuarded({ guarded, holdsKey: false, startedBy: 'nothing', },),)
                .toEqual(guarded.before,);
            },
          },),
        ],
      },);
    },),

    describe({
      name: 'guard order as built',
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'REFUSES a process that holds a key and carries another command\'s marker, naming that command, '
            + 'before it reads an argument it would refuse',
          fn: async () => {
            await using scratch = await scratchDir({ prefix: 'task-runner-guard-', },);
            expect(await runBuiltCommand({
              command: 'probe-sensitivity',
              args: ['--bogus',],
              env: {
                ...scratchPlaces({
                  runsDir: scratch.path,
                  scratchDir: scratch.path,
                },),
                WHISKER_API_KEY: 'purr',
              },
              startedBy: { otherCommand: 'spend-report', },
            },),).toEqual({
              code: REFUSED_AS_STATED,
              stdout: '',
              stderr: `${guardRefusal({ command: 'probe-sensitivity', },).trimEnd()} `
                + 'TRANSLATION_REPAIR_STARTED_BY is set in this process to spend-report, which names another '
                + 'command.\n',
            },);
          },
        },),
      ],
    },),
  ],
},);
