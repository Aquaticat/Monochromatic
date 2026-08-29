/**
 * Tests caught entry errors map to operational tally and scheduler state.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  DuplicateModelPromptError,
  entryErrorOutcome,
  NaturalnessCompletenessError,
  NaturalnessRepairInterruptedError,
} from '../../dist/final/node/index.mjs';

await describe({
  name: entryErrorOutcome.name,
  children: [
    ...([
      new NaturalnessRepairInterruptedError({ reason: 'quorum-not-met', }),
      new NaturalnessCompletenessError({ sliceIndex: 1, }),
      new DuplicateModelPromptError({
        modelId: 'hf:moonshotai/Kimi-K3',
        promptDigest: 'sha256:fixture',
      },),
    ] as const).map(function stoppedError(error,) {
      return it({
        name: `MAPS ${error.name} to INCOMPLETE stopped work`,
        fn: async () => {
          expect(entryErrorOutcome({ error, },),).toEqual({
            status: 'INCOMPLETE',
            outcome: { kind: 'stopped', },
          },);
        },
      },);
    },),

    it({
      name: 'MAPS ORDINARY OPERATIONAL ERROR to resumable ERROR',
      fn: async () => {
        expect(entryErrorOutcome({ error: new Error('transport failed',), },),).toEqual({
          status: 'ERROR',
          outcome: { kind: 'resumable-failure', },
        },);
      },
    },),
  ],
},);
