/**
 Tests for the editor fidelity probe's command line: the entry filter, the trial cap, the defects to build and the
 amount it may spend, read from the probe's command line the way `reportingRefusals` reads it. Fixtures are cat-themed
 invention only.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  DEFAULT_EDITOR_MAX_USD,
  DEFAULT_EDITOR_TRIAL_CAP,
  EDITOR_DAMAGE_KINDS,
  readEditorFidelityArguments,
} from '../../dist/final/node/index.mjs';
import { refusalOf, } from '@monochromatic-dev/translation-repair-glossary/ts/corpus-run/cap-argument-refusal.test-fixture.ts';
import { lineOf, } from '@monochromatic-dev/translation-repair-run/ts/corpus-run/command-line.test-fixture.ts';

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
): ReturnType<typeof readEditorFidelityArguments> {
  return readEditorFidelityArguments({
    line: lineOf({
      command: 'editor-fidelity-probe',
      typed,
    },),
  },);
}

await describe({
  name: readEditorFidelityArguments.name,
  children: [
    it({
      name: 'TAKES every entry, the default cap, both defects and two dollars when no flag is written',
      fn: async () => {
        expect(DEFAULT_EDITOR_MAX_USD,).toBe(2,);
        expect(askedFrom({ typed: [], },),).toEqual({
          onlyIds: [],
          cap: DEFAULT_EDITOR_TRIAL_CAP,
          damageKinds: EDITOR_DAMAGE_KINDS,
          maxUsd: DEFAULT_EDITOR_MAX_USD,
        },);
      },
    },),
    it({
      name: 'READS the entries, the cap, one defect and the amount as written',
      fn: async () => {
        expect(askedFrom({
          typed: ['--only', 'tabby,,ginger', '--cap', '3', '--damage', 'insertion', '--max-usd', '0.75',],
        },),).toEqual({
          onlyIds: ['tabby', 'ginger',],
          cap: 3,
          damageKinds: ['insertion',],
          maxUsd: 0.75,
        },);
      },
    },),
    it({
      name: 'REFUSES A DELETION by saying why: its fix is a sentence the editor must write, which no deterministic '
        + 'test can score against the archive\'s own wording',
      fn: async () => {
        expect(refusalOf({
          typed: ['--damage', 'deletion',],
          askedFrom,
        },),).toBe(
          '--damage deletion is not built for the editor probe: its fix is a sentence the editor must write, '
            + 'which no deterministic test scores against the archive\'s wording; the probe takes insertion or alteration',
        );
      },
    },),
    it({
      name: 'REFUSES a defect this probe does not build, naming the ones it does, and a name that sits on '
        + 'Object.prototype',
      fn: async () => {
        expect(['scratches', 'constructor', '__proto__',].map(function refusedDefect(name,): string {
          return refusalOf({
            typed: ['--damage', name,],
            askedFrom,
          },);
        },),).toEqual([
          '--damage takes insertion or alteration, not "scratches"',
          '--damage takes insertion or alteration, not "constructor"',
          '--damage takes insertion or alteration, not "__proto__"',
        ],);
      },
    },),
    it({
      name: 'REFUSES a cap or an amount mistyped, and a flag written last or naming nobody',
      fn: async () => {
        /**
         Usage line every refusal of the probe's command line ends with.
         */
        const usage = 'Usage: editor-fidelity-probe [--only <entry ids>] [--cap <count>] '
          + '[--damage <insertion|alteration>] [--candidates <seatable ids>] [--max-usd <dollars>] '
          + '[--candidates-alone]';
        /**
         Command lines an operator mistyped, each with the refusal it must draw.
         */
        const mistyped: readonly (readonly [readonly string[], string])[] = [
          [['--cap', 'fourty',], '--cap needs a whole number written in digits, at most 9007199254740991, and "fourty" is not one',],
          [
            ['--cap', '-3',],
            `--cap cannot be below zero, and -3 is; leave it off to run the default of ${
              String(DEFAULT_EDITOR_TRIAL_CAP,)
            } trials`,
          ],
          [
            ['--max-usd', 'two',],
            '--max-usd needs a plain amount of dollars written in digits with at most one decimal point, '
              + 'and "two" is not one',
          ],
          [['--max-usd',], `--max-usd needs a value written after it. ${usage}`,],
          [['--only', ',',], '--only needs at least one entry id, and "," names none',],
          [['--damage',], `--damage needs a value written after it. ${usage}`,],
        ];
        expect(mistyped.map(function refusalFor([typed,],): string {
          return refusalOf({
            typed,
            askedFrom,
          },);
        },),).toEqual(mistyped.map(function expectedOf([, said,],): string {
          return said;
        },),);
      },
    },),
  ],
},);
