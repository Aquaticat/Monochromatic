/**
 Tests for the fidelity probe's command line: the entry filter, the trial
 cap, the defects to build and the context switch, read from an argument
 vector the way `process.argv` presents one. Fixtures are cat-themed
 invention only.

 @module
 */

import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
import {
  caught,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  DAMAGE_KINDS,
  DEFAULT_TRIAL_CAP,
  readFidelityArguments,
  StatedRefusalError,
} from '../../dist/final/node/index.mjs';

/**
 What `process.argv` carries before anything a person typed.
 */
const BEFORE_FLAGS: readonly string[] = [
  '/usr/bin/node',
  '/somewhere/judge-fidelity-probe.mjs',
];

/**
 Reads the probe's arguments off a command line carrying what was typed.

 @param typed - what the operator wrote after the script path

 @returns What the reader settled on

 @throws StatedRefusalError when the reader refuses what was typed

 @example
 ```ts
 const asked = askedFrom({ typed: ['--cap', '3',], },);
 ```
 */
function askedFrom(
  { typed, }: { readonly typed: readonly string[]; },
): ReturnType<typeof readFidelityArguments> {
  return readFidelityArguments({ argv: [...BEFORE_FLAGS, ...typed,], },);
}

/**
 Refusal a cap draws when it is no whole number written in digits.

 @param cap - cap as typed

 @returns The refusal's sentence

 @example
 ```ts
 const said = capNotDigits({ cap: 'fourty', },);
 ```
 */
function capNotDigits({ cap, }: { readonly cap: string; },): string {
  return `--cap needs a whole number written in digits, at most ${String(Number.MAX_SAFE_INTEGER,)}, `
    + `and ${cap} is not one`;
}

await describe({
  name: readFidelityArguments.name,
  children: [
    it({
      name: 'TAKES every entry, the default cap, every defect and no context when no flag is written',
      fn: async () => {
        expect(askedFrom({ typed: [], },),).toEqual({
          onlyIds: [],
          cap: DEFAULT_TRIAL_CAP,
          damageKinds: DAMAGE_KINDS,
          withContext: false,
        },);
      },
    },),
    it({
      name: 'READS the entries, the cap, one defect and the context switch as written',
      fn: async () => {
        expect(askedFrom({
          typed: ['--only', 'tabby,,ginger', '--cap', '3', '--damage', 'insertion', '--context',],
        },),).toEqual({
          onlyIds: ['tabby', 'ginger',],
          cap: 3,
          damageKinds: ['insertion',],
          withContext: true,
        },);
      },
    },),
    it({
      name: 'REFUSES a defect this probe does not build, naming the ones it does',
      fn: async () => {
        /**
         What the reader threw.
         */
        const refusal = caught(function readUnbuilt(): void {
          askedFrom({ typed: ['--damage', 'scratches',], },);
        },);
        expect(refusal,).toBeInstanceOf(StatedRefusalError,);
        expect(caughtValueText(refusal,),).toBe('--damage takes deletion, insertion or alteration, not scratches',);
      },
    },),
    it({
      name: 'REFUSES a cap that is no whole number written in digits, or below zero, and a flag written last or '
        + 'naming nobody, where each fell back to a default or to every entry in silence and spent trials nobody '
        + 'asked for (ledger B73)',
      fn: async () => {
        /**
         Command lines an operator mistyped, each with the refusal it must draw.
         */
        const mistyped: readonly (readonly [readonly string[], string])[] = [
          [['--cap', 'fourty',], capNotDigits({ cap: 'fourty', },),],
          [['--cap', '4.9',], capNotDigits({ cap: '4.9', },),],
          [
            ['--cap', '-3',],
            '--cap cannot be below zero, and -3 is; leave it off to run the default of '
              + `${String(DEFAULT_TRIAL_CAP,)} trials`,
          ],
          [['--cap',], '--cap needs a value written after it',],
          [['--only',], '--only needs a value written after it',],
          [['--only', ',',], '--only needs at least one entry id, and , names none',],
          [['--damage',], '--damage needs a value written after it',],
        ];
        expect(mistyped.map(function refusalOf([typed,],): string {
          /**
           What the reader threw.
           */
          const refusal = caught(function readsTyped(): void {
            askedFrom({ typed, },);
          },);
          expect(refusal,).toBeInstanceOf(StatedRefusalError,);
          return caughtValueText(refusal,);
        },),).toEqual(mistyped.map(function expectedOf([, said,],): string {
          return said;
        },),);
      },
    },),
  ],
},);
