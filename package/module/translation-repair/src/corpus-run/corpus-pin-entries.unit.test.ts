/**
 Tests that every built command reading the corpus pin reads it inside its
 refusal boundary, run as built: an unreadable
 `TRANSLATION_REPAIR_CORPUS_COMMIT` is a stated refusal at exit 6 naming the
 variable, with nothing on stdout, and a command that never reads the corpus
 runs past the variable.

 THE DEFECT (ledger B302, B381): `run-config.ts` resolved the pin in a module
 constant, so every command that loads it, whether it reads the corpus or
 not, exited 1 while it loaded, under Node's echo of the bundle's source
 line, before `reportingRefusals` ran.

 Every child runs through `runBuiltCommand`, which removes every variable
 whose name ends in `_API_KEY` and every variable whose name starts
 `TRANSLATION_REPAIR_` before the case adds the scratch locations it needs
 and the unreadable commit.

 Fixtures are cat-themed invention. No corpus content appears here.

 @module
 */

import {
  DEFAULT_CONCURRENCY,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { runBuiltCommand, } from '../child-environment.test-fixture.ts';
import { scratchDir, } from '../scratch-dir.test-fixture.ts';
import { scratchPlaces, } from './keyless-built-command.test-fixture.ts';

/**
 Commit setting no reader accepts: a cat's name, not a full lowercase
 hexadecimal commit name.
 */
const UNREADABLE_COMMIT = 'whiskers';

/**
 Each built command that reads the corpus pin, with arguments its command
 line accepts, so the run reaches the pin rather than a usage refusal.
 */
const PIN_READERS: readonly {
  readonly command: string;
  readonly args: readonly string[];
}[] = [
  {
    command: 'coverage-control-probe',
    args: [
      '--only',
      'Mittens',
    ],
  },
  {
    command: 'coverage-probe',
    args: [
      '--only',
      'Mittens',
      '--cap',
      '2',
    ],
  },
  {
    command: 'displacement-probe',
    args: [],
  },
  {
    command: 'draw-sample',
    args: [],
  },
  {
    command: 'editor-calibrate',
    args: [],
  },
  {
    command: 'editor-width-probe',
    args: [],
  },
  {
    command: 'judge-fidelity-probe',
    args: [],
  },
  {
    command: 'probe-relabel',
    args: [],
  },
  {
    command: 'probe-verify',
    args: [],
  },
  {
    command: 'producer-calibrate',
    args: [],
  },
  {
    command: 'recall-benchmark',
    args: [],
  },
  {
    command: 'rendering-audit-settled',
    args: [],
  },
  {
    command: 'roster-bench',
    args: [],
  },
  {
    command: 'sentinel-probe',
    args: ['mittens',],
  },
  {
    command: 'slice-census',
    args: [],
  },
  {
    command: 'translate-probe',
    args: [],
  },
  {
    command: 'window-trial-probe',
    args: [],
  },
];

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: 'corpus pin readers as built',
      concurrency: DEFAULT_CONCURRENCY,
      children: PIN_READERS.map(function refusalCase({
        command,
        args,
      },) {
        return it({
          name: `REFUSES AN UNREADABLE CORPUS COMMIT in ${command} at exit 6 with its line alone and nothing on stdout`,
          fn: async () => {
            await using scratch = await scratchDir({ prefix: 'corpus-pin-entries-', },);

            /**
             What the command wrote with the commit setting unreadable.
             */
            const run = await runBuiltCommand({
              command,
              args,
              env: {
                ...scratchPlaces({
                  runsDir: scratch.path,
                  scratchDir: scratch.path,
                },),
                TRANSLATION_REPAIR_CORPUS_COMMIT: UNREADABLE_COMMIT,
              },
            },);

            expect(run,).toEqual({
              code: 6,
              stdout: '',
              stderr: `${command}: TRANSLATION_REPAIR_CORPUS_COMMIT must be one full lowercase hexadecimal commit `
                + `name, and ${UNREADABLE_COMMIT} is not one\n`,
            },);
          },
        },);
      },),
    },),
    describe({
      name: 'commands that never read the corpus pin, as built',
      children: [
        it({
          name: 'RUNS PAST AN UNREADABLE CORPUS COMMIT in ledger-report, which never reads the corpus, and reports '
            + 'its empty runs directory',
          fn: async () => {
            await using scratch = await scratchDir({ prefix: 'corpus-pin-entries-', },);

            /**
             What the command wrote over an empty runs directory with the commit
             setting unreadable.
             */
            const run = await runBuiltCommand({
              command: 'ledger-report',
              args: [],
              env: {
                TRANSLATION_REPAIR_RUNS_DIR: scratch.path,
                TRANSLATION_REPAIR_CORPUS_COMMIT: UNREADABLE_COMMIT,
              },
            },);

            expect(run,).toEqual({
              code: 1,
              stdout: [
                `ledger-report: 0 contests under ${scratch.path}`,
                'NOTHING RECORDED. This run wrote no ledger, which is not the same as a run whose models '
                + 'wrote nothing: every run started before candidate-ledger.ts landed has none, and so does '
                + 'any run launched without TRANSLATION_REPAIR_RUNS_DIR set.',
                '',
              ].join('\n',),
              stderr: '',
            },);
          },
        },),
      ],
    },),
  ],
},);
