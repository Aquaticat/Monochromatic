/**
 Tests for the editor width probe runner: the built command, run in a child
 process with every provider key withheld, so it can only refuse before any
 model is asked.

 THE CHILD'S ENVIRONMENT. `runBuiltWithoutKeys` drops every variable whose
 name ends in `_API_KEY` and every variable whose name starts
 `TRANSLATION_REPAIR_` before a case adds the locations it needs
 (`withheldFromChild` in `built-command-without-keys.test-fixture.ts`).

 Fixtures are cat-themed invention. No corpus content appears here.

 @module
 */

import {
  DEFAULT_CONCURRENCY,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { scratchDir, } from '../scratch-dir.test-fixture.ts';
import { runBuiltWithoutKeys, } from './built-command-without-keys.test-fixture.ts';

/**
 Exit code `reportingRefusals` sets for a stated refusal.
 */
const REFUSED_AS_STATED = 6;

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: 'editor-width-probe as built',
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'REFUSES as stated and exits 6 for want of a provider key, before any call and with nothing on stdout',
          fn: async () => {
            await using scratch = await scratchDir({ prefix: 'editor-width-probe-', },);

            /**
             What the command wrote with every key withheld.
             */
            const run = await runBuiltWithoutKeys({
              command: 'editor-width-probe',
              args: [],
              env: {
                TRANSLATION_REPAIR_RUNS_DIR: scratch.path,
                TRANSLATION_REPAIR_LOOKUP_CACHE_DIR: `${scratch.path}/lookup-cache`,
              },
            },);

            expect(run.code,).toBe(REFUSED_AS_STATED,);
            expect(run.stdout,).toBe('',);
            expect(run.stderr,).toBe(
              'editor-width-probe: TRANSLATION_REPAIR_SYNTHETIC_API_KEY, TRANSLATION_REPAIR_CHARM_HYPER_API_KEY, '
                + 'TRANSLATION_REPAIR_AMAZON_BEDROCK_API_KEY or TRANSLATION_REPAIR_OPENROUTER_API_KEY is not set; '
                + 'run under mise so sops injects it\n',
            );
          },
        },),

        it({
          name: 'REFUSES a flag it does not read as stated and exits 6, naming the flag and the usage',
          fn: async () => {
            await using scratch = await scratchDir({ prefix: 'editor-width-probe-', },);

            /**
             What the command wrote given one flag it does not declare.
             */
            const run = await runBuiltWithoutKeys({
              command: 'editor-width-probe',
              args: ['--bogus',],
              env: {
                TRANSLATION_REPAIR_RUNS_DIR: scratch.path,
                TRANSLATION_REPAIR_LOOKUP_CACHE_DIR: `${scratch.path}/lookup-cache`,
              },
            },);

            expect(run.code,).toBe(REFUSED_AS_STATED,);
            expect(run.stdout,).toBe('',);
            expect(run.stderr,).toBe(
              'editor-width-probe: --bogus is not a flag this command reads. Usage: editor-width-probe [<slices>] '
                + '[<draw>]\n',
            );
          },
        },),
      ],
    },),
  ],
},);
