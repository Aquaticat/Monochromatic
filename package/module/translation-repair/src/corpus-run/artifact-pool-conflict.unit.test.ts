/**
 Tests that the artifact pool reads its policy as the value an entry hands
 it, and REFUSES two pools asked for at once.

 WHAT THE TWO REQUESTS ARE. `TRANSLATION_REPAIR_REQUIRED_COMMIT` filters the
 pool to entries whose recorded pipeline contains a commit; setting
 `TRANSLATION_REPAIR_POOL_ALL` to its one accepted value takes every
 generation instead. Preferring either silently would record a policy nobody
 chose, and the report printed above the resulting number would name that
 policy as though it had been requested.

 THE ENTRY READS THE ENVIRONMENT, AND THE POOL READS A VALUE. `readPoolPolicy`
 is what an entry file calls with the environment it runs in, and
 `resolvePool` takes what it returned. Until 2026-10-10 `resolvePool` read
 the environment itself, so every library caller pooled under whatever the
 shell exported and these cases had to write the process's environment.

 WHAT WAS MEASURED. On 2026-08-25, inverting the comparison that reads the
 pool-all variable failed no test in this package. A reader that mistook
 PRESENCE for the accepted VALUE would refuse ordinary invocations and admit
 the contradictory one, which is why the reader is pinned on the accepted
 value, on another wording and on an exported-but-empty variable.

 NO NETWORK, and no shared state: no case writes the process's environment,
 and the refused pool names a directory nothing reads.

 Fixtures are cat-themed invention. No corpus content appears here.

 @module
 */

import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  readPoolPolicy,
  resolvePool,
  StatedRefusalError,
} from '../../dist/final/node/index.mjs';
import { rejectionOf, } from '../rejecting-call.test-fixture.ts';
import { CONFLICTING_POOL_SAYS, } from './pool-policy.test-fixture.ts';

//region Fixtures

/**
 Variable naming a commit the pooled entries must contain.
 */
const REQUIRED_COMMIT_VAR = 'TRANSLATION_REPAIR_REQUIRED_COMMIT';

/**
 Variable asking for every generation at once.
 */
const POOL_ALL_VAR = 'TRANSLATION_REPAIR_POOL_ALL';

//endregion Fixtures

await describe({
  name: 'artifact pool policy',
  concurrency: 1,
  children: [
    describe({
      name: readPoolPolicy.name,
      concurrency: 1,
      children: [
        it({
          name: 'READS NEITHER REQUEST from an environment that sets neither variable',
          fn: async () => {
            expect(readPoolPolicy({ env: { PURR_LEVEL: 'loud', }, },),).toEqual({
              requiredCommit: '',
              poolAll: false,
            },);
          },
        },),

        it({
          name: 'READS THE REQUIRED COMMIT as the invoker wrote it and the pool-all request by its one accepted '
            + 'value',
          fn: async () => {
            expect(readPoolPolicy({
              env: {
                [REQUIRED_COMMIT_VAR]: 'tabby-tip',
                [POOL_ALL_VAR]: 'yes',
              },
            },),).toEqual({
              requiredCommit: 'tabby-tip',
              poolAll: true,
            },);
          },
        },),

        it({
          name: 'READS A POOL-ALL VARIABLE EXPORTED WITH ANY OTHER WORDING AS NO REQUEST, since a reader noticing '
            + 'the NAME rather than the value it accepts would refuse ordinary invocations',
          fn: async () => {
            expect(readPoolPolicy({
              env: {
                [REQUIRED_COMMIT_VAR]: 'tabby-tip',
                [POOL_ALL_VAR]: 'no',
              },
            },),).toEqual({
              requiredCommit: 'tabby-tip',
              poolAll: false,
            },);
          },
        },),

        it({
          name: 'READS AN EXPORTED-BUT-EMPTY REQUIRED COMMIT AS NONE, an ordinary shell accident',
          fn: async () => {
            expect(readPoolPolicy({
              env: {
                [REQUIRED_COMMIT_VAR]: '',
                [POOL_ALL_VAR]: '',
              },
            },),).toEqual({
              requiredCommit: '',
              poolAll: false,
            },);
          },
        },),
      ],
    },),

    describe({
      name: resolvePool.name,
      concurrency: 1,
      children: [
        it({
          name: 'REFUSES AS STATED a filtered pool and an unfiltered one asked for together in the policy it is '
            + 'handed, rather than picking one and printing its name above a number nobody requested',
          fn: async () => {
            /**
             What the reader said about the pair.
             */
            const refusal = await rejectionOf(async function overBothPools() {
              await resolvePool({
                artifactsDir: join(
                  tmpdir(),
                  'translation-repair-pool-conflict-unread',
                ),
                policy: {
                  requiredCommit: 'tabby-tip',
                  poolAll: true,
                },
              },);
            },);

            expect(refusal,).toBeInstanceOf(StatedRefusalError,);
            expect(String(refusal,),).toBe(`StatedRefusalError: ${CONFLICTING_POOL_SAYS}`,);
          },
        },),
      ],
    },),
  ],
},);
