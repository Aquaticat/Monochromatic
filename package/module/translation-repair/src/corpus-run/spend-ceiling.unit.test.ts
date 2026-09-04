/**
 * Tests for the per-run spend ceiling: the resolver, the predicate the
 * scheduler asks before each entry, and the line it prints when it stops.
 *
 * Fixtures are cat-themed invention.
 *
 * @module
 */

import {
  caught,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  resolveSpendCeilingUsd,
  SPEND_CEILING_PROVIDER,
  SPEND_CEILING_VAR,
  spendCeilingNote,
  spendCeilingReached,
  SpendCeilingOverrideError,
} from '../../dist/final/node/index.mjs';

/**
 * Built-in the resolver falls back to in these cases.
 */
const FALLBACK = 7;

await describe({
  name: resolveSpendCeilingUsd.name,
  children: [
    it({
      name: 'RETURNS the built-in for an unset or blank override, since neither is an override',
      fn: async () => {
        expect(resolveSpendCeilingUsd({
          fallback: FALLBACK,
          raw: '',
        },),).toBe(FALLBACK,);
        expect(resolveSpendCeilingUsd({
          fallback: FALLBACK,
          raw: '   ',
        },),).toBe(FALLBACK,);
      },
    },),
    it({
      name: 'READS a number of USD, zero included, since zero means start nothing and is how the guard '
        + 'is shown to fire on a live run without spending',
      fn: async () => {
        expect(resolveSpendCeilingUsd({
          fallback: FALLBACK,
          raw: '5.5',
        },),).toBe(5.5,);
        expect(resolveSpendCeilingUsd({
          fallback: FALLBACK,
          raw: '0',
        },),).toBe(0,);
      },
    },),
    it({
      name: 'REFUSES a value that is not a non-negative number, naming the variable and quoting the '
        + 'value, rather than replacing it by the default an operator did not ask for',
      fn: async () => {
        for (const raw of ['plenty', '-1', '5 dollars', 'Infinity',]) {
          /**
           * What the resolver raised for this value.
           */
          const refusal = caught(function readUnreadable(): number {
            return resolveSpendCeilingUsd({
              fallback: FALLBACK,
              raw,
            },);
          },);
          expect(refusal,).toBeInstanceOf(SpendCeilingOverrideError,);
          expect((refusal as Error).message,).toContain(SPEND_CEILING_VAR,);
          expect((refusal as Error).message,).toContain(JSON.stringify(raw,),);
          expect((refusal as SpendCeilingOverrideError).messageNamesOnly,).toBe(true,);
        }
      },
    },),
  ],
},);

await describe({
  name: spendCeilingReached.name,
  children: [
    it({
      name: 'STOPS at or past the ceiling and not below it, so a ceiling of zero refuses the first entry',
      fn: async () => {
        expect(spendCeilingReached({
          spentUsd: 19.99,
          ceilingUsd: 20,
        },),).toBe(false,);
        expect(spendCeilingReached({
          spentUsd: 20,
          ceilingUsd: 20,
        },),).toBe(true,);
        expect(spendCeilingReached({
          spentUsd: 20.01,
          ceilingUsd: 20,
        },),).toBe(true,);
        expect(spendCeilingReached({
          spentUsd: 0,
          ceilingUsd: 0,
        },),).toBe(true,);
      },
    },),
  ],
},);

await describe({
  name: spendCeilingNote.name,
  children: [
    it({
      name: 'NAMES both figures, the metered provider, and the dial that raises the allowance',
      fn: async () => {
        /**
         * The line the scheduler prints when it stops.
         */
        const note = spendCeilingNote({
          spentUsd: 20.4,
          ceilingUsd: 20,
        },);
        expect(note.startsWith('SPEND CEILING reached',),).toBe(true,);
        expect(note,).toContain('20.4 of 20 USD',);
        expect(note,).toContain(SPEND_CEILING_PROVIDER,);
        expect(note,).toContain(SPEND_CEILING_VAR,);
      },
    },),
  ],
},);
