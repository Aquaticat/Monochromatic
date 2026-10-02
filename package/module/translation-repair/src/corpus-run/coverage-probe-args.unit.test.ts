/**
 Tests for the coverage probe's command line: the entry filter and the
 candidate cap, read from the probe's command line the way
 `reportingRefusals` reads it (ledger B75). Fixtures are cat-themed invention
 only.

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
  DEFAULT_CANDIDATE_CAP,
  readCoverageProbeArguments,
  StatedRefusalError,
} from '../../dist/final/node/index.mjs';
import { capNotDigits, } from './cap-argument-refusal.test-fixture.ts';
import { lineOf, } from './command-line.test-fixture.ts';

/**
 Usage line every refusal of the probe's command line ends with.
 */
const USAGE = 'Usage: coverage-probe [--only <entry ids>] [--cap <count>]';

/**
 Reads the probe's arguments off a command line carrying what was typed.

 @param typed - what the operator wrote after the script path

 @returns What the reader settled on

 @example
 ```ts
 const asked = askedFrom({ typed: ['--cap', '3',], },);
 ```
 */
function askedFrom(
  { typed, }: { readonly typed: readonly string[]; },
): ReturnType<typeof readCoverageProbeArguments> {
  return readCoverageProbeArguments({
    line: lineOf({
      command: 'coverage-probe',
      typed,
    },),
  },);
}

await describe({
  name: readCoverageProbeArguments.name,
  children: [
    it({
      name: 'TAKES every entry and the default cap when no flag is written',
      fn: async () => {
        expect(askedFrom({ typed: [], },),).toEqual({
          onlyIds: [],
          cap: DEFAULT_CANDIDATE_CAP,
        },);
      },
    },),
    it({
      name: 'READS the entries named after --only, dropping the gaps a stray comma leaves, and the cap after --cap',
      fn: async () => {
        expect(askedFrom({ typed: ['--only', 'tabby,,ginger', '--cap', '3',], },),).toEqual({
          onlyIds: ['tabby', 'ginger',],
          cap: 3,
        },);
      },
    },),
    it({
      name: 'REFUSES a cap that is no whole number written in digits, or below zero, and a flag written last or '
        + 'naming nobody, where each fell back to a default or to every entry in silence and spent asks nobody '
        + 'wanted (ledger B73)',
      fn: async () => {
        /**
         Command lines an operator mistyped, each with the refusal it must draw.
         */
        const mistyped: readonly (readonly [readonly string[], string])[] = [
          [['--cap', 'fourty',], capNotDigits({ cap: 'fourty', },),],
          [['--cap', '4.9',], capNotDigits({ cap: '4.9', },),],
          [
            ['--cap', '-3',],
            '--cap cannot be below zero, and -3 is; leave it off to ask about the default of '
              + `${String(DEFAULT_CANDIDATE_CAP,)} candidates`,
          ],
          [['--cap',], `--cap needs a value written after it. ${USAGE}`,],
          [['--only',], `--only needs a value written after it. ${USAGE}`,],
          [['--only', ',',], '--only needs at least one entry id, and "," names none',],
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
