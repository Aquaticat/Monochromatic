/**
 * Tests that the artifact pool REFUSES two pools asked for at once.
 *
 * WHAT THE TWO REQUESTS ARE. `TRANSLATION_REPAIR_REQUIRED_COMMIT` filters the
 * pool to entries whose recorded pipeline contains a commit; setting
 * `TRANSLATION_REPAIR_POOL_ALL` to its one accepted value takes every
 * generation instead. Preferring either silently would record a policy nobody
 * chose, and the report printed above the resulting number would name that
 * policy as though it had been requested.
 *
 * WHAT WAS MEASURED. On 2026-08-25, inverting the comparison that reads the
 * pool-all variable failed no test in this package. A reader that mistook
 * PRESENCE for the accepted VALUE would refuse ordinary invocations and admit
 * the contradictory one, which is why both directions are pinned below rather
 * than the refusal alone.
 *
 * THE SECOND CASE IS THE DISCRIMINATING ONE. A variable exported with any other
 * value is an ordinary shell accident, and folding it together with the request
 * it does not make is what separates reading a value from noticing a name.
 *
 * NO NETWORK, and no shared state: the environment is edited through a
 * disposable that puts back whatever was there, and the pool is read out of a
 * throwaway directory rather than any real artifacts.
 *
 * @module
 */

import {
  mkdtemp,
  rm,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { resolvePool, } from '../../dist/final/node/index.mjs';

//region Fixtures

/**
 * Variable naming a commit the pooled entries must contain.
 */
const REQUIRED_COMMIT_VAR = 'TRANSLATION_REPAIR_REQUIRED_COMMIT';

/**
 * Variable asking for every generation at once.
 */
const POOL_ALL_VAR = 'TRANSLATION_REPAIR_POOL_ALL';

/**
 * Wording the refusal carries, kept here so both cases ask about the same one.
 */
const CONFLICT_WORDING = 'are both set';

/**
 * Points two environment variables at given values until disposed.
 *
 * ABSENCE IS SPELT AS THE EMPTY STRING rather than removing the name, which the
 * reader itself folds together with absence: an exported-but-empty variable is
 * an ordinary shell accident, and the module says so where it reads them.
 *
 * @param values - variable names mapped to what they should say
 *
 * @returns Edit holding what each name now says, which puts them back on disposal
 *
 * @example
 * ```ts
 * using edited = environmentSaying({ values: { [POOL_ALL_VAR]: 'yes', }, },);
 * ```
 */
function environmentSaying(
  { values, }: { readonly values: Readonly<Record<string, string>>; },
): { readonly saying: Readonly<Record<string, string>>; } & Disposable {
  /**
   * What each edited name said beforehand, with absence spelt as empty.
   */
  const before: Record<string, string> = Object.fromEntries(
    Object.keys(values,)
      .map(function priorOf(name,): [string, string,] {
        return [
          name,
          process.env[name] ?? '',
        ];
      },),
  );

  for (const [name, value,] of Object.entries(values,))
    process.env[name] = value;

  return {
    saying: values,
    [Symbol.dispose]: () => {
      for (const [name, value,] of Object.entries(before,))
        process.env[name] = value;
    },
  };
}

/**
 * Runs a call that must refuse and hands back what it threw.
 *
 * @param act - call expected to reject
 *
 * @returns Whatever it rejected with, unchanged
 *
 * @throws Error when the call resolved instead of rejecting
 *
 * @example
 * ```ts
 * const refusal = await refusalOf(async function overBothPools() { ... },);
 * ```
 */
async function refusalOf(act: () => Promise<unknown>,): Promise<unknown> {
  try {
    await act();
  }
  catch (error) {
    return error;
  }
  throw new Error(
    `Expected ${(act.name === '') ? 'the call' : act.name} to refuse, but it returned`,
  );
}

//endregion Fixtures

await describe({
  name: resolvePool.name,
  children: [
    it({
      name: 'REFUSES a filtered pool and an unfiltered one asked for together, rather than picking '
        + 'one and printing its name above a number nobody requested',
      fn: async () => {
        using edited = environmentSaying({
          values: {
            [REQUIRED_COMMIT_VAR]: 'HEAD',
            [POOL_ALL_VAR]: 'yes',
          },
        },);
        expect(process.env[POOL_ALL_VAR],).toBe(edited.saying[POOL_ALL_VAR],);

        /**
         * What the reader said about the pair.
         */
        const refusal = await refusalOf(async function overBothPools() {
          await resolvePool({ artifactsDir: join(
            tmpdir(),
            'translation-repair-pool-conflict-unread',
          ), },);
        },);

        expect(refusal,).toBeInstanceOf(Error,);
        expect((refusal as Error).message,).toContain(CONFLICT_WORDING,);
        expect((refusal as Error).message,).toContain(POOL_ALL_VAR,);
      },
    },),

    it({
      name: 'ADMITS a pool-all variable exported with any other wording, since a reader noticing the '
        + 'NAME rather than the value it accepts would refuse ordinary invocations',
      fn: async () => {
        /**
         * Throwaway artifacts directory, empty, so nothing real is read.
         */
        const artifactsDir = await mkdtemp(join(
          tmpdir(),
          'translation-repair-pool-',
        ),);

        using edited = environmentSaying({
          values: {
            [REQUIRED_COMMIT_VAR]: 'HEAD',
            [POOL_ALL_VAR]: 'no',
          },
        },);
        expect(process.env[POOL_ALL_VAR],).toBe(edited.saying[POOL_ALL_VAR],);

        /**
         * What the reader said when only one pool was actually requested.
         */
        const refusal = await refusalOf(async function overAnEmptyPool() {
          await resolvePool({ artifactsDir, },);
        },);

        await rm(
          artifactsDir,
          {
            recursive: true,
            force: true,
          },
        );

        expect(refusal,).toBeInstanceOf(Error,);
        expect((refusal as Error).message,).not.toContain(CONFLICT_WORDING,);
      },
    },),
  ],
},);
