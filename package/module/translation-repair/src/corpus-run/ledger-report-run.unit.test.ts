/**
 Tests for the ledger report's procedure: what it reads, what it prints and
 which exit code each state leaves.

 EACH STATE LEAVES ITS OWN EXIT CODE. A run that wrote no ledger, a run whose
 ledger was read in part and a run whose every file refused answer a roster
 question differently, and a gate reading the code must tell them apart, so
 every case here asserts the code beside the whole of what was printed.

 THE RUNS DIRECTORY IS HANDED IN. Every case writes its own ledger under a
 scratch directory and names it, so nothing here reads a real run.

 Fixtures are cat-themed invention. No corpus content appears here.

 @module
 */

import { mkdir, } from 'node:fs/promises';
import { join, } from 'node:path';

import {
  describe,
  type DisposableSandbox,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  LEDGER_DIR,
  reportLedger,
} from '../../dist/final/node/index.mjs';
import { scratchDir, } from '../scratch-dir.test-fixture.ts';
import { lineOf, } from './command-line.test-fixture.ts';
import {
  NAP_CONTEST,
  PURR_CONTEST,
  SHORTFALL_SENTENCE,
  SUMMARY_POINTER,
  writeContest,
} from './ledger-report.test-fixture.ts';
import {
  captureReport,
  type ReportCapture,
} from './report-run-capture.test-fixture.ts';

/**
 Name of the first contest file a case writes.
 */
const FIRST_NAME = '2026-08-25T01-00-00.000Z-p1-000001.json';

/**
 Name of the second contest file a case writes.
 */
const SECOND_NAME = '2026-08-25T01-00-00.000Z-p1-000002.json';

/**
 What the report says when the run recorded no contest at all.
 */
const NOTHING_RECORDED_LINE = 'NOTHING RECORDED. This run wrote no ledger, which is not the same as a run whose '
  + 'models wrote nothing: every run started before candidate-ledger.ts landed has none, and so does any run '
  + 'launched without TRANSLATION_REPAIR_RUNS_DIR set.';

/**
 Runs the report over the logs named, with its printing diverted and its exit
 code held.

 @param sinon - calling case's own sandbox (`ctx.sinon`)

 @param typed - arguments typed after the runner

 @param runsDir - runs directory the report reads

 @returns What it printed and the exit code it left

 @example
 ```ts
 const captured = await reportedByLedger({ sinon: ctx.sinon, typed: [], runsDir, },);
 ```
 */
async function reportedByLedger(
  {
    sinon,
    typed,
    runsDir,
  }: {
    readonly sinon: DisposableSandbox;
    readonly typed: readonly string[];
    readonly runsDir: string;
  },
): Promise<ReportCapture> {
  return await captureReport({
    sinon,
    run: async function reportedByLedgerRun(): Promise<void> {
      await reportLedger({
        line: lineOf({
          command: 'ledger-report',
          typed,
        },),
        runsDir,
      },);
    },
  },);
}

await describe({
  name: reportLedger.name,
  concurrency: 1,
  children: [
    it({
      name: 'SAYS NOTHING WAS RECORDED and leaves exit code 1 when the run has no ledger directory',
      fn: async (ctx) => {
        await using scratch = await scratchDir({ prefix: 'ledger-report-run-', },);

        /**
         What the report printed and the code it left.
         */
        const captured = await reportedByLedger({
          sinon: ctx.sinon,
          typed: [],
          runsDir: scratch.path,
        },);

        expect(captured,).toEqual({
          lines: [
            `ledger-report: 0 contests under ${scratch.path}`,
            NOTHING_RECORDED_LINE,
          ],
          exitCode: 1,
        },);
      },
    },),

    it({
      name: 'SAYS NOTHING WAS RECORDED and leaves exit code 1 when the ledger directory holds no contest file',
      fn: async (ctx) => {
        await using scratch = await scratchDir({ prefix: 'ledger-report-run-', },);
        await mkdir(join(
          scratch.path,
          LEDGER_DIR,
        ),);

        /**
         What the report printed and the code it left.
         */
        const captured = await reportedByLedger({
          sinon: ctx.sinon,
          typed: [],
          runsDir: scratch.path,
        },);

        expect(captured,).toEqual({
          lines: [
            `ledger-report: 0 contests under ${scratch.path}`,
            NOTHING_RECORDED_LINE,
          ],
          exitCode: 1,
        },);
      },
    },),

    it({
      name: 'SAYS NOTHING WAS COUNTED and leaves exit code 2 when every ledger file refused to read',
      fn: async (ctx) => {
        await using scratch = await scratchDir({ prefix: 'ledger-report-run-', },);
        await writeContest({
          runsDir: scratch.path,
          name: FIRST_NAME,
          contest: { task: 'render the nap passage', },
        },);

        /**
         What the report printed and the code it left.
         */
        const captured = await reportedByLedger({
          sinon: ctx.sinon,
          typed: [],
          runsDir: scratch.path,
        },);

        expect(captured,).toEqual({
          lines: [
            `ledger-report: 0 contests under ${scratch.path}`,
            `  UNREADABLE ${FIRST_NAME}: ledger file ${FIRST_NAME} has no usable at`,
            `  1 of 1 ledger file could not be read. ${SHORTFALL_SENTENCE}`,
            'NOTHING COUNTED. Every ledger file this run wrote refused to read, so this is a run whose '
            + 'record was lost rather than a run that recorded nothing.',
          ],
          exitCode: 2,
        },);
      },
    },),

    it({
      name: 'PRINTS the summary of one contest in the singular and leaves no exit code when every file read',
      fn: async (ctx) => {
        await using scratch = await scratchDir({ prefix: 'ledger-report-run-', },);
        await writeContest({
          runsDir: scratch.path,
          name: FIRST_NAME,
          contest: PURR_CONTEST,
        },);

        /**
         What the report printed and the code it left.
         */
        const captured = await reportedByLedger({
          sinon: ctx.sinon,
          typed: [],
          runsDir: scratch.path,
        },);

        expect(captured,).toEqual({
          lines: [
            `ledger-report: 1 contest under ${scratch.path}`,
            '0 ballots named nothing, 1 named a candidate the slate did not have',
            '  tabby-1: 1 candidate, 0 chosen, 0.0% of 1 disinterested ballot, 0 self-votes',
            '  calico-2: 1 candidate, 0 chosen, 0.0% of 1 disinterested ballot, 0 self-votes',
            `\n${SUMMARY_POINTER}`,
          ],
          exitCode: 'unset',
        },);
      },
    },),

    it({
      name: 'PRINTS the summary over the files that read and leaves exit code 2 when another file refused',
      fn: async (ctx) => {
        await using scratch = await scratchDir({ prefix: 'ledger-report-run-', },);
        await writeContest({
          runsDir: scratch.path,
          name: FIRST_NAME,
          contest: NAP_CONTEST,
        },);
        await writeContest({
          runsDir: scratch.path,
          name: SECOND_NAME,
          contest: { task: 'render the purr passage', },
        },);

        /**
         What the report printed and the code it left.
         */
        const captured = await reportedByLedger({
          sinon: ctx.sinon,
          typed: [],
          runsDir: scratch.path,
        },);

        expect(captured,).toEqual({
          lines: [
            `ledger-report: 1 contest under ${scratch.path}`,
            `  UNREADABLE ${SECOND_NAME}: ledger file ${SECOND_NAME} has no usable at`,
            `  1 of 2 ledger files could not be read. ${SHORTFALL_SENTENCE}`,
            '1 ballot named nothing, 0 named a candidate the slate did not have',
            '  tabby-1: 1 candidate, 1 chosen, 50.0% of 2 disinterested ballots, 1 self-vote',
            '  calico-2: 1 candidate, 0 chosen, 0.0% of 3 disinterested ballots, 0 self-votes',
            `\n${SUMMARY_POINTER}`,
          ],
          exitCode: 2,
        },);
      },
    },),

    it({
      name: 'PRINTS the named seat\'s candidates instead of the summary and leaves no exit code',
      fn: async (ctx) => {
        await using scratch = await scratchDir({ prefix: 'ledger-report-run-', },);
        await writeContest({
          runsDir: scratch.path,
          name: FIRST_NAME,
          contest: NAP_CONTEST,
        },);

        /**
         What the report printed and the code it left.
         */
        const captured = await reportedByLedger({
          sinon: ctx.sinon,
          typed: ['--model', 'calico-2',],
          runsDir: scratch.path,
        },);

        expect(captured,).toEqual({
          lines: [
            `ledger-report: 1 contest under ${scratch.path}`,
            'calico-2 wrote 1 candidate, 0 chosen',
            '\n--- 1 --- not chosen --- render the nap passage',
            'A cat sleeps where the sun is.',
            '  (no disinterested judge named this candidate)',
          ],
          exitCode: 'unset',
        },);
      },
    },),

    it({
      name: 'PRINTS the named seat\'s candidates and leaves exit code 2 when another file refused',
      fn: async (ctx) => {
        await using scratch = await scratchDir({ prefix: 'ledger-report-run-', },);
        await writeContest({
          runsDir: scratch.path,
          name: FIRST_NAME,
          contest: NAP_CONTEST,
        },);
        await writeContest({
          runsDir: scratch.path,
          name: SECOND_NAME,
          contest: [],
        },);

        /**
         What the report printed and the code it left.
         */
        const captured = await reportedByLedger({
          sinon: ctx.sinon,
          typed: ['--model', 'tabby-1',],
          runsDir: scratch.path,
        },);

        expect(captured,).toEqual({
          lines: [
            `ledger-report: 1 contest under ${scratch.path}`,
            `  UNREADABLE ${SECOND_NAME}: ledger file ${SECOND_NAME} has no usable task`,
            `  1 of 2 ledger files could not be read. ${SHORTFALL_SENTENCE}`,
            'tabby-1 wrote 1 candidate, 1 chosen',
            '\n--- 1 --- CHOSEN --- render the nap passage',
            'The cat naps in the sun.',
            '  siamese-3: keeps the sun and the nap',
          ],
          exitCode: 2,
        },);
      },
    },),
  ],
},);
