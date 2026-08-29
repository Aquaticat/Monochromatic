/**
 * Tests pre-polish baseline contributor authority floor.
 *
 * @module
 */

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  applyFinalPolish,
  NaturalnessRepairInterruptedError,
  type SyntheticClient,
} from '../dist/final/node/index.mjs';

await describe({
  name: applyFinalPolish.name,
  children: [
    it({
      name: 'PAUSES INVALID BASE before no-polish fallback can retain contributor respelling',
      fn: async () => {
        const client: SyntheticClient = {
          chatText: async () => {
            throw new Error('model calls must not run before baseline floor',);
          },
          chatJson: async () => {
            throw new Error('model calls must not run before baseline floor',);
          },
          quotas: async () => {
            throw new Error('meter unused by baseline floor fixture',);
          },
        };
        let caught: unknown;
        try {
          await applyFinalPolish({
            client,
            settlement: {
              terminal: 'consolidated',
              text: 'Contributors for this entry: Snowflake',
              floor: { kind: 'proposals', validModelIds: [], },
              verdicts: [],
              rewrapped: false,
              demoted: false,
              findings: [],
            },
            subject: {
              sourceText: '本条目贡献者：雪猫',
              incumbentText: 'Contributors for this entry: [Snow](https://example.test/snow)',
            },
            lineStructured: false,
            sliceIndex: 1,
            eligible: true,
            signal: AbortSignal.timeout(5_000,),
            perCallTimeoutMs: 5_000,
            l: tagged({ tag: 'contributor-baseline-floor-test', },),
          },);
        }
        catch (error) {
          caught = error;
        }
        expect(caught,).toBeInstanceOf(NaturalnessRepairInterruptedError,);
      },
    },),
  ],
},);
