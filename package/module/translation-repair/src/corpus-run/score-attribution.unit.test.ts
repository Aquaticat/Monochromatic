/**
 Tests for the `score-attribution` runner: the built command over a runs
 directory a case wrote.

 The runner reads settled artifacts and prints rates, so its as-built cases run
 to the end of the report on a fixture and read the whole of what it printed.
 Every child is started by `runBuiltScore`, whose environment carries no
 variable ending in `_API_KEY`.

 Fixtures are cat-themed invention. No corpus content appears here.

 @module
 */

import { join, } from 'node:path';

import {
  DEFAULT_CONCURRENCY,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { scratchDir, } from '../scratch-dir.test-fixture.ts';
import {
  builtCommand,
  builtPipelineDigest,
  runBuiltScore,
} from './score-built-command.test-fixture.ts';
import {
  ATTRIBUTED_CAT_ARTIFACTS,
  writeScoreArtifacts,
} from './score-artifacts.test-fixture.ts';

/**
 Exit code `reportingRefusals` sets for a stated refusal.
 */
const REFUSED_AS_STATED = 6;

/**
 Built command under test.
 */
const COMMAND = builtCommand({ name: 'score-attribution', },);

/**
 What the pool prints as the pipeline that read it.
 */
const POOL_STAMP = await builtPipelineDigest();

/**
 The report's closing note, printed whenever a population carries attribution.
 */
const SUPPORT_NOTE = 'NOTE sole means an accepted issue rested on exactly one critic, which is '
  + 'legitimate: the reference run had gpt-oss-120b as the sole finder of a planted seed. selfRepeated '
  + 'means one critic emitted the same claim twice, which must never read as agreement. That '
  + 'distinction is what issue 65 asks about duplicates.';

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: 'score-attribution as built',
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'REPORTS the population, each critic\'s rates and the support counts, and exits 0',
          fn: async () => {
            await using scratch = await scratchDir({ prefix: 'score-attribution-', },);
            await writeScoreArtifacts({
              runsDir: scratch.path,
              artifacts: ATTRIBUTED_CAT_ARTIFACTS,
            },);

            /**
             What the command wrote.
             */
            const run = await runBuiltScore({
              command: COMMAND,
              args: [],
              runsDir: scratch.path,
              setting: {},
            },);

            expect(run.code,).toBe(0,);
            expect(run.stderr,).toBe('',);
            expect(run.stdout,).toBe([
              `SOURCE ${scratch.path}/artifacts`,
              `POOL read by pipeline ${POOL_STAMP}`,
              'POOL 2 entries across 1 pipeline generation',
              'POPULATION eligible=1 ineligible=1 chunks=1',
              '',
              'CRITIC                                      heard  raised  emitted   hits  raised/ch   hits/ch',
              'hf:Qwen/Qwen3.8-27B                             1       1        1      1       1.00      1.00',
              'hf:openai/gpt-oss-120b                          1       2        3      2       2.00      2.00',
              '',
              'SUPPORT sole=1 multi=1 selfRepeated=1 unattributed=0 partialJoin=0',
              SUPPORT_NOTE,
              '',
            ].join('\n',),);
          },
        },),

        it({
          name: 'NAMES the artifact that could not be read and still reports the rest, exiting 0',
          fn: async () => {
            await using scratch = await scratchDir({ prefix: 'score-attribution-', },);
            await writeScoreArtifacts({
              runsDir: scratch.path,
              artifacts: {
                ...ATTRIBUTED_CAT_ARTIFACTS,
                'Biscuit.json': '{"id": "Bisc',
              },
            },);

            /**
             What the command wrote.
             */
            const run = await runBuiltScore({
              command: COMMAND,
              args: [],
              runsDir: scratch.path,
              setting: {},
            },);

            expect(run.code,).toBe(0,);
            expect(run.stderr,).toBe('',);
            expect(run.stdout,).toBe([
              `SOURCE ${scratch.path}/artifacts`,
              'POOL malformed Biscuit.json: could not read Biscuit.json as JSON (SyntaxError at byte 12)',
              `POOL read by pipeline ${POOL_STAMP}`,
              'POOL 2 entries across 1 pipeline generation',
              'POOL   1 artifact unreadable, passed through to be reported as malformed: Biscuit',
              'WARNING 1 artifact could not be read and is in NEITHER population this report counts, so '
              + 'every count is over the rest. Named rather than summarized, because a truncated artifact '
              + 'is a different problem from a malformed one:',
              '  Biscuit.json: could not read Biscuit.json as JSON (SyntaxError at byte 12)',
              'POPULATION eligible=1 ineligible=1 chunks=1',
              '',
              'CRITIC                                      heard  raised  emitted   hits  raised/ch   hits/ch',
              'hf:Qwen/Qwen3.8-27B                             1       1        1      1       1.00      1.00',
              'hf:openai/gpt-oss-120b                          1       2        3      2       2.00      2.00',
              '',
              'SUPPORT sole=1 multi=1 selfRepeated=1 unattributed=0 partialJoin=0',
              SUPPORT_NOTE,
              '',
            ].join('\n',),);
          },
        },),

        it({
          name: 'REFUSES a runs directory whose artifacts hold no entry, printing the source line first and exiting 6',
          fn: async () => {
            await using scratch = await scratchDir({ prefix: 'score-attribution-', },);
            await writeScoreArtifacts({
              runsDir: scratch.path,
              artifacts: {},
            },);

            /**
             What the command wrote.
             */
            const run = await runBuiltScore({
              command: COMMAND,
              args: [],
              runsDir: scratch.path,
              setting: {},
            },);

            expect(run.code,).toBe(REFUSED_AS_STATED,);
            expect(run.stdout,).toBe(`SOURCE ${scratch.path}/artifacts\n`,);
            expect(run.stderr,).toBe([
              'score-attribution: No entry has settled yet, so there is nothing to pool.',
              '',
              'This THROWS rather than returning an empty pool, because every caller',
              'of this function goes on to compute a rate. A rate over zero entries',
              'is this module\'s own failure mode taken to its limit: a denominator',
              'quietly shrunk, here all the way to nothing, while the number above it',
              'still renders. Accumulate entries under the required pipeline, or',
              'require an earlier commit that the settled entries actually contain.',
              '',
            ].join('\n',),);
          },
        },),

        it({
          name: 'REFUSES a runs directory with no artifacts directory in its own words, exiting 6 after the source line',
          fn: async () => {
            await using scratch = await scratchDir({ prefix: 'score-attribution-', },);

            /**
             Runs directory no pass ever wrote into.
             */
            const runsDir = join(
              scratch.path,
              'nowhere',
            );

            /**
             What the command wrote.
             */
            const run = await runBuiltScore({
              command: COMMAND,
              args: [],
              runsDir,
              setting: {},
            },);

            expect(run.code,).toBe(REFUSED_AS_STATED,);
            expect(run.stdout,).toBe(`SOURCE ${runsDir}/artifacts\n`,);
            expect(run.stderr,).toBe(
              `score-attribution: cannot list ${runsDir}/artifacts (ENOENT): name a runs directory that holds an `
                + '`artifacts` directory with TRANSLATION_REPAIR_RUNS_DIR\n',
            );
          },
        },),
      ],
    },),
  ],
},);
