/**
 Tests for `sentinel-probe` as an operator runs it: the built command in a
 child process that holds no provider key, over a throwaway corpus.

 THE COMMAND SPENDS QUOTA, so what is checked here is only what happens before
 any call: the order of its refusals (an id the corpus lacks is refused before
 the key is asked for), the key refusal itself, and a flag it does not read.

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
const KEY_REFUSAL = 'sentinel-probe: TRANSLATION_REPAIR_SYNTHETIC_API_KEY, TRANSLATION_REPAIR_CHARM_HYPER_API_KEY, '
  + 'TRANSLATION_REPAIR_AMAZON_BEDROCK_API_KEY or TRANSLATION_REPAIR_OPENROUTER_API_KEY is not set; '
  + 'run under mise so sops injects it\n';

await describe({
  name: 'sentinel-probe as built',
  children: [
    it({
      name: 'REFUSES as stated and exits 6 for a named id the corpus holds once no provider key is set, before any call',
      fn: async () => {
        await using corpus = await makeProbeCorpus({ files: { 'people/mittens/page.md': 'Mittens naps.\n', }, },);
        await using runs = await scratchDir({ prefix: 'sentinel-probe-runs-', },);
        const run = await runBuiltWithoutKeys({
          command: 'sentinel-probe',
          args: ['mittens',],
          runsDir: runs.path,
          env: corpusEnvOf({ corpus, },),
        },);

        expect(run,).toEqual({
          code: REFUSED_AS_STATED,
          stdout: '',
          stderr: KEY_REFUSAL,
        },);
      },
    },),
    it({
      name: 'REFUSES the default sentinels the corpus lacks before the key is asked for, and exits 6',
      fn: async () => {
        await using corpus = await makeProbeCorpus({ files: { 'people/mittens/page.md': 'Mittens naps.\n', }, },);
        await using runs = await scratchDir({ prefix: 'sentinel-probe-runs-', },);
        const run = await runBuiltWithoutKeys({
          command: 'sentinel-probe',
          args: [],
          runsDir: runs.path,
          env: corpusEnvOf({ corpus, },),
        },);

        expect(run,).toEqual({
          code: REFUSED_AS_STATED,
          stdout: '',
          stderr: 'sentinel-probe: sentinel-probe asks for "Anilovr", "Aniloviraw", which the corpus at the pin does not hold\n',
        },);
      },
    },),
    it({
      name: 'REFUSES a flag it does not read, and exits 6 with its usage line',
      fn: async () => {
        await using corpus = await makeProbeCorpus({ files: { 'people/mittens/page.md': 'Mittens naps.\n', }, },);
        await using runs = await scratchDir({ prefix: 'sentinel-probe-runs-', },);
        const run = await runBuiltWithoutKeys({
          command: 'sentinel-probe',
          args: ['--bogus',],
          runsDir: runs.path,
          env: corpusEnvOf({ corpus, },),
        },);

        expect(run,).toEqual({
          code: REFUSED_AS_STATED,
          stdout: '',
          stderr: 'sentinel-probe: --bogus is not a flag this command reads. Usage: sentinel-probe [<entry id> ...]\n',
        },);
      },
    },),
  ],
},);
