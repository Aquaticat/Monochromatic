/**
 Tests for the cap census's report and for the built command at its boundary.

 The built command is run as a child process whose environment carries no
 provider key, over logs the cases write into a scratch directory, so nothing
 here reads a real run log and nothing can spend.

 Fixtures are cat-themed invention. No corpus content appears here.

 @module
 */

import {
  chmod,
  mkdir,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  COMPLETION_CAP,
  MODEL_CARDS,
  reportCapCensus,
} from '../../dist/final/node/index.mjs';
import { SEAT_HYPER_OPENROUTER_UNMEASURED, } from '../roster-seats.test-fixture.ts';
import { scratchDir, } from '../scratch-dir.test-fixture.ts';
import { runBuiltWithoutKeys, } from './built-command-without-keys.test-fixture.ts';
import {
  CAP_CENSUS_CLOSING_NOTE,
  spendLine,
  streamLine,
} from './cap-census-log.test-fixture.ts';
import { lineOf, } from './command-line.test-fixture.ts';
import { divertingConsoleLog, } from './console-log-capture.test-fixture.ts';

/**
 Exit code `reportingRefusals` sets for a stated refusal.
 */
const REFUSED_AS_STATED = 6;

/**
 Seat the fixture calls went to.
 */
const SEAT = SEAT_HYPER_OPENROUTER_UNMEASURED;

/**
 The seat's Hyper id, as its lines name it.
 */
const HYPER_ID = MODEL_CARDS[SEAT].hyper?.id ?? 'no hyper block';

/**
 Lines of a pass-run log holding two completed Hyper calls of the seat, one
 far under its cap and one at it, whose stream delivered content.

 @returns The log's lines, opened by the marker a pass run opens with

 @example
 ```ts
 await writeFile(path, `${passRunLines().join('\n',)}\n`,);
 ```
 */
function passRunLines(): readonly string[] {
  return [
    'START tip=tabby0001',
    streamLine({ stamp: '2026-09-28T10:00:00.000Z', label: HYPER_ID, outcome: 'completed', content: 7, },),
    spendLine({
      stamp: '2026-09-28T10:00:00.020Z',
      tail: `provider=hyper model=${HYPER_ID} prompt=10 completion=100`,
    },),
    streamLine({ stamp: '2026-09-28T10:01:00.000Z', label: HYPER_ID, outcome: 'completed', content: 9, },),
    spendLine({
      stamp: '2026-09-28T10:01:00.020Z',
      tail: `provider=hyper model=${HYPER_ID} prompt=10 completion=${String(COMPLETION_CAP[SEAT],)}`,
    },),
  ];
}

/**
 Writes a named log of the given lines into a scratch directory.

 @param directory - scratch directory

 @param name - file name

 @param lines - the log's lines

 @example
 ```ts
 await writeLog({ directory: scratch.path, name: 'nap.log', lines: ['START tip=tabby',], },);
 ```
 */
async function writeLog(
  {
    directory,
    name,
    lines,
  }: {
    readonly directory: string;
    readonly name: string;
    readonly lines: readonly string[];
  },
): Promise<void> {
  await writeFile(
    join(
      directory,
      name,
    ),
    `${lines.join('\n',)}\n`,
    'utf8',
  );
}

await describe({
  name: 'cap-census report',
  concurrency: 1,
  children: [
    describe({
      name: reportCapCensus.name,
      children: [
        it({
          name: 'PRINTS THE CENSUS OF EVERY PASS-RUN LOG under a named directory, the calls of all of them together, '
            + 'and leaves a log with no run marker out of the count of calls',
          fn: async (ctx) => {
            using printed = divertingConsoleLog({ sinon: ctx.sinon, },);
            await using scratch = await scratchDir({ prefix: 'cap-census-report-', },);
            await writeLog({
              directory: scratch.path,
              name: 'first.log',
              lines: passRunLines(),
            },);
            await writeLog({
              directory: scratch.path,
              name: 'second.log',
              lines: [
                'START tip=tabby0002',
                streamLine({ stamp: '2026-09-29T10:00:00.000Z', label: HYPER_ID, outcome: 'completed', content: 3, },),
                spendLine({
                  stamp: '2026-09-29T10:00:00.020Z',
                  tail: `provider=hyper model=${HYPER_ID} prompt=10 completion=50`,
                },),
                streamLine({ stamp: '2026-09-29T10:01:00.000Z', label: HYPER_ID, outcome: 'completed', content: 4, },),
                spendLine({
                  stamp: '2026-09-29T10:01:00.020Z',
                  tail: `provider=hyper model=${HYPER_ID} prompt=10 completion=60`,
                },),
              ],
            },);
            await writeLog({
              directory: scratch.path,
              name: 'suite.log',
              lines: [passRunLines()[1] ?? '',],
            },);

            await reportCapCensus({ line: lineOf({ command: 'cap-census', typed: [scratch.path,], },), },);

            expect(printed.lines,).toEqual([
              'cap-census: 3 logs, 2 pass-run logs, 4 completed calls, 0 on ids no card names, 0 paths unreadable; '
              + 'lines left out for a stamp the logger did not write: 0',
              `${SEAT}: card cap ${String(COMPLETION_CAP[SEAT],)}, rule reads nothing (too few calls)`,
              `  hyper: 4 calls, p99 ${String(COMPLETION_CAP[SEAT],)}; since the caps 4 calls, 1 at the cap (25.00%): `
              + '1 with content, 0 with none, 0 unpaired',
              CAP_CENSUS_CLOSING_NOTE,
            ],);
          },
        },),
        it({
          name: 'COUNTS A LOG IT CANNOT READ as an unreadable path and says so on stderr, rather than stopping the '
            + 'census of the logs it can',
          fn: async (ctx) => {
            using printed = divertingConsoleLog({ sinon: ctx.sinon, },);
            const stderr = ctx.sinon.stub(
              console,
              'error',
            );
            await using scratch = await scratchDir({ prefix: 'cap-census-report-', },);
            await writeLog({
              directory: scratch.path,
              name: 'first.log',
              lines: passRunLines(),
            },);
            await writeLog({
              directory: scratch.path,
              name: 'sealed.log',
              lines: passRunLines(),
            },);

            /**
             The log nobody may read.
             */
            const sealed = join(
              scratch.path,
              'sealed.log',
            );
            await chmod(
              sealed,
              0,
            );
            await using _reopened = {
              [Symbol.asyncDispose]: async function reopen(): Promise<void> {
                await chmod(
                  sealed,
                  0o600,
                );
              },
            };

            await reportCapCensus({ line: lineOf({ command: 'cap-census', typed: [scratch.path,], },), },);

            expect({
              header: printed.lines[0],
              stderr: stderr.args,
            },).toEqual({
              header: 'cap-census: 2 logs, 1 pass-run log, 2 completed calls, 0 on ids no card names, 1 path unreadable; '
                + 'lines left out for a stamp the logger did not write: 0',
              stderr: [[
                `cap-census: cannot read ${sealed}: Error: EACCES: permission denied, open '${sealed}'`,
              ],],
            },);
          },
        },),
        it({
          name: 'COUNTS THE LINES A LOG LEFT OUT for a stamp the logger did not write, and prints a lone log and a '
            + 'lone call in the singular',
          fn: async (ctx) => {
            using printed = divertingConsoleLog({ sinon: ctx.sinon, },);
            await using scratch = await scratchDir({ prefix: 'cap-census-report-', },);
            await writeLog({
              directory: scratch.path,
              name: 'only.log',
              lines: [
                'START tip=tabby0003',
                ...passRunLines().slice(1, 3),
                `SPEND provider=hyper model=${HYPER_ID} prompt=10 completion=13`,
              ],
            },);

            await reportCapCensus({ line: lineOf({ command: 'cap-census', typed: [scratch.path,], },), },);

            expect(printed.lines[0],).toBe(
              'cap-census: 1 log, 1 pass-run log, 1 completed call, 0 on ids no card names, 0 paths unreadable; '
              + 'lines left out for a stamp the logger did not write: 1',
            );
          },
        },),
        it({
          name: 'PRINTS NO SEAT ROW where no log is a pass run, and counts the logs it passed over',
          fn: async (ctx) => {
            using printed = divertingConsoleLog({ sinon: ctx.sinon, },);
            await using scratch = await scratchDir({ prefix: 'cap-census-report-', },);
            await writeLog({
              directory: scratch.path,
              name: 'suite.log',
              lines: ['a suite log',],
            },);

            await reportCapCensus({ line: lineOf({ command: 'cap-census', typed: [scratch.path,], },), },);

            expect(printed.lines,).toEqual([
              'cap-census: 1 log, 0 pass-run logs, 0 completed calls, 0 on ids no card names, 0 paths unreadable; '
              + 'lines left out for a stamp the logger did not write: 0',
              CAP_CENSUS_CLOSING_NOTE,
            ],);
          },
        },),
      ],
    },),

    describe({
      name: 'cap-census as built',
      children: [
        it({
          name: 'PRINTS THE CENSUS of the pass-run logs under the named paths and exits 0, leaving out a log '
            + 'with no run marker, a file that is no log, a skipped directory and counting the path it cannot read',
          fn: async () => {
            await using scratch = await scratchDir({ prefix: 'cap-census-built-', },);
            await using runs = await scratchDir({ prefix: 'cap-census-built-runs-', },);
            await writeFile(
              join(
                scratch.path,
                'pass.log',
              ),
              `${passRunLines().join('\n',)}\n`,
              'utf8',
            );
            await writeFile(
              join(
                scratch.path,
                'suite.log',
              ),
              'a suite log\n',
              'utf8',
            );
            await writeFile(
              join(
                scratch.path,
                'notes.txt',
              ),
              'START tip=tabby0002\n',
              'utf8',
            );
            await mkdir(join(
              scratch.path,
              'slice-cache',
            ),);
            await writeFile(
              join(
                scratch.path,
                'slice-cache',
                'skipped.log',
              ),
              `${passRunLines().join('\n',)}\n`,
              'utf8',
            );

            /**
             A path the walk cannot read.
             */
            const missing = join(
              scratch.path,
              'no-such-nest',
            );

            /**
             What the command wrote.
             */
            const run = await runBuiltWithoutKeys({
              command: 'cap-census',
              args: [
                scratch.path,
                missing,
              ],
              env: { TRANSLATION_REPAIR_RUNS_DIR: runs.path, },
            },);

            expect(run.code,).toBe(0,);
            expect(run.stderr,).toBe(
              `cap-census: cannot read ${missing}: Error: ENOENT: no such file or directory, stat '${missing}'\n`,
            );
            expect(run.stdout,).toBe([
              'cap-census: 2 logs, 1 pass-run log, 2 completed calls, 0 on ids no card names, 1 path unreadable; '
              + 'lines left out for a stamp the logger did not write: 0',
              `${SEAT}: card cap ${String(COMPLETION_CAP[SEAT],)}, rule reads nothing (too few calls)`,
              `  hyper: 2 calls, p99 ${String(COMPLETION_CAP[SEAT],)}; since the caps 2 calls, 1 at the cap (50.00%): `
              + '1 with content, 0 with none, 0 unpaired',
              CAP_CENSUS_CLOSING_NOTE,
              '',
            ].join('\n',),);
          },
        },),
        it({
          name: 'REFUSES A COMMAND LINE NAMING NO PATH as stated and exits 6 with its line, before reading anything',
          fn: async () => {
            await using runs = await scratchDir({ prefix: 'cap-census-built-runs-', },);

            /**
             What the command wrote.
             */
            const run = await runBuiltWithoutKeys({
              command: 'cap-census',
              args: [],
              env: { TRANSLATION_REPAIR_RUNS_DIR: runs.path, },
            },);

            expect(run.code,).toBe(REFUSED_AS_STATED,);
            expect(run.stdout,).toBe('',);
            expect(run.stderr,).toBe(
              'cap-census: this command needs <log file or directory>. '
              + 'Usage: cap-census <log file or directory> [<log file or directory> ...]\n',
            );
          },
        },),
        it({
          name: 'REFUSES A FLAG IT DOES NOT DECLARE as stated and exits 6 with its line',
          fn: async () => {
            await using runs = await scratchDir({ prefix: 'cap-census-built-runs-', },);

            /**
             What the command wrote.
             */
            const run = await runBuiltWithoutKeys({
              command: 'cap-census',
              args: ['--tabby',],
              env: { TRANSLATION_REPAIR_RUNS_DIR: runs.path, },
            },);

            expect(run.code,).toBe(REFUSED_AS_STATED,);
            expect(run.stdout,).toBe('',);
            expect(run.stderr,).toBe(
              'cap-census: --tabby is not a flag this command reads; this command needs <log file or directory>. '
              + 'Usage: cap-census <log file or directory> [<log file or directory> ...]\n',
            );
          },
        },),
      ],
    },),
  ],
},);
