/**
 Tests for `coverage-probe` as an operator runs it: the built command in a
 child process that holds no provider key, over a throwaway corpus and a
 throwaway runs directory.

 THE COMMAND SPENDS QUOTA, so what is checked here is only what happens before
 any call: the key refusal, which the command makes after it has read its own
 command line and before it reads the corpus, and the flags it does not accept.

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
const KEY_REFUSAL = 'coverage-probe: TRANSLATION_REPAIR_SYNTHETIC_API_KEY, TRANSLATION_REPAIR_CHARM_HYPER_API_KEY, '
  + 'TRANSLATION_REPAIR_AMAZON_BEDROCK_API_KEY or TRANSLATION_REPAIR_OPENROUTER_API_KEY is not set; '
  + 'run under mise so sops injects it\n';

/**
 Runs the built command against a one-entry corpus with no provider key,
 and returns what it did together with whether it kept anything.

 @param args - arguments after the command

 @returns Exit code and both streams

 @example
 ```ts
 const run = await runOverOneEntry({ args: ['--cap', '2',], },);
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
  await using runs = await scratchDir({ prefix: 'coverage-probe-runs-', },);
  return await runBuiltWithoutKeys({
    command: 'coverage-probe',
    args,
    runsDir: runs.path,
    env: corpusEnvOf({ corpus, },),
  },);
}

await describe({
  name: 'coverage-probe as built',
  children: [
    it({
      name: 'REFUSES as stated and exits 6 once no provider key is set, before any call and with nothing printed',
      fn: async () => {
        expect(await runOverOneEntry({ args: ['--only', 'Mittens', '--cap', '2',], },),).toEqual({
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
          stderr: 'coverage-probe: --bogus is not a flag this command reads. '
            + 'Usage: coverage-probe [--only <entry ids>] [--cap <count>]\n',
        },);
      },
    },),
    it({
      name: 'REFUSES a cap that is no whole number before the key is asked for, and exits 6',
      fn: async () => {
        expect(await runOverOneEntry({ args: ['--cap', 'x',], },),).toEqual({
          code: REFUSED_AS_STATED,
          stdout: '',
          stderr: 'coverage-probe: --cap needs a whole number written in digits, at most 9007199254740991, '
            + 'and "x" is not one\n',
        },);
      },
    },),
  ],
},);
