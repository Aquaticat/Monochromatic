/**
 Tests for `coverage-control-probe` as an operator runs it: the built command
 in a child process that holds no provider key, over a throwaway corpus.

 THE COMMAND SPENDS QUOTA, so what is checked here is only what happens before
 any call: the key refusal, which the command makes before it reads its entry
 filter or the corpus, and a flag it does not read.

 Fixtures are cat-themed invention. No corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { scratchDir, } from '../scratch-dir.test-fixture.ts';
import {
  type BuiltRun,
  corpusEnvOf,
  makeProbeCorpus,
  runBuiltWithoutKeys,
} from './probes-b-built-command.test-fixture.ts';

/**
 Exit code `reportingRefusals` sets for a stated refusal.
 */
const REFUSED_AS_STATED = 6;

/**
 Line the missing key refuses with.
 */
const KEY_REFUSAL = 'coverage-control-probe: TRANSLATION_REPAIR_SYNTHETIC_API_KEY, TRANSLATION_REPAIR_CHARM_HYPER_API_KEY, '
  + 'TRANSLATION_REPAIR_AMAZON_BEDROCK_API_KEY or TRANSLATION_REPAIR_OPENROUTER_API_KEY is not set; '
  + 'run under mise so sops injects it\n';

/**
 Runs the built command against a one-entry corpus with no provider key.

 @param args - arguments after the command

 @returns Exit code and both streams

 @example
 ```ts
 const run = await runOverOneEntry({ args: ['--only', 'Mittens',], },);
 ```
 */
async function runOverOneEntry(
  { args, }: { readonly args: readonly string[]; },
): Promise<BuiltRun> {
  await using corpus = await makeProbeCorpus({
    files: {
      'people/Mittens/page.md': 'Mittens naps.\n',
      'people/Mittens/page.en.md': 'Mittens naps.\n',
    },
  },);
  await using runs = await scratchDir({ prefix: 'coverage-control-probe-runs-', },);
  return await runBuiltWithoutKeys({
    command: 'coverage-control-probe',
    args,
    runsDir: runs.path,
    env: corpusEnvOf({ corpus, },),
  },);
}

await describe({
  name: 'coverage-control-probe as built',
  children: [
    it({
      name: 'REFUSES as stated and exits 6 for a named entry the corpus holds once no provider key is set, before any call',
      fn: async () => {
        expect(await runOverOneEntry({ args: ['--only', 'Mittens',], },),).toEqual({
          code: REFUSED_AS_STATED,
          stdout: '',
          stderr: KEY_REFUSAL,
        },);
      },
    },),
    it({
      name: 'REFUSES for the missing key before it reads the entry filter, so an entry the corpus lacks is not yet named',
      fn: async () => {
        expect(await runOverOneEntry({ args: ['--only', 'Nobody',], },),).toEqual({
          code: REFUSED_AS_STATED,
          stdout: '',
          stderr: KEY_REFUSAL,
        },);
      },
    },),
    it({
      name: 'REFUSES a flag it does not read, and exits 6 with its usage line',
      fn: async () => {
        expect(await runOverOneEntry({ args: ['--bogus',], },),).toEqual({
          code: REFUSED_AS_STATED,
          stdout: '',
          stderr: 'coverage-control-probe: --bogus is not a flag this command reads. '
            + 'Usage: coverage-control-probe [--only <entry ids>]\n',
        },);
      },
    },),
  ],
},);
