/**
 * Tests for the pass entry allowlist.
 *
 * The cases that matter are the ones where a misread flag runs the WHOLE
 * corpus instead of one entry. That is expensive to discover afterwards and
 * looks like an ordinary long pass while it happens, so every shape that could
 * parse to nothing throws instead.
 *
 * Entry ids are real corpus ids, since the flag's whole job is to name them.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { readOnlyIds, } from '../../dist/final/node/index.mjs';

/**
 * Builds an argv with the runtime and script path a real invocation carries.
 *
 * @param rest - arguments following the script path
 *
 * @returns Full argv
 *
 * @example
 * ```ts
 * const argv = argvWith({ rest: ['--only', 'Toka_ls',], },);
 * ```
 */
function argvWith({ rest, }: { readonly rest: readonly string[]; },): readonly string[] {
  return [
    '/usr/bin/node',
    'src/corpus-run/corpus-pass.ts',
    ...rest,
  ];
}

await describe({
  name: readOnlyIds.name,
  children: [
    it({
      name: 'returns an EMPTY set when the flag is absent, which is what keeps '
        + 'the ordinary pass untouched: absence and no-restriction are the same '
        + 'value, so a caller cannot forget to handle one of them',
      fn: async () => {
        expect(readOnlyIds({ argv: argvWith({ rest: [], },), },).size,).toBe(0,);
        expect(readOnlyIds({ argv: argvWith({ rest: ['--plan',], },), },).size,).toBe(0,);
      },
    },),

    it({
      name: 'reads one id, which is the case this exists for: Toka_ls sat at '
        + 'position 22 of 71 pending entries, about fourteen hours away, for a '
        + 'question one entry answers',
      fn: async () => {
        expect([...readOnlyIds({
          argv: argvWith({ rest: ['--only', 'Toka_ls',], },),
        },),],).toEqual(['Toka_ls',],);
      },
    },),

    it({
      name: 'splits a comma-separated list and trims each id, so a value pasted '
        + 'with spaces after the commas still names the entries it looks like '
        + 'it names',
      fn: async () => {
        expect([...readOnlyIds({
          argv: argvWith({ rest: ['--only', 'Toka_ls, XingZ60 ,Acheron',], },),
        },),].toSorted(),).toEqual(['Acheron', 'Toka_ls', 'XingZ60',],);
      },
    },),

    it({
      name: 'reads the flag wherever it sits, since mise passes task arguments '
        + 'after its own and the position is not ours to fix',
      fn: async () => {
        expect([...readOnlyIds({
          argv: argvWith({ rest: ['--plan', '--only', 'Toka_ls',], },),
        },),],).toEqual(['Toka_ls',],);
      },
    },),

    it({
      name: 'THROWS when the flag ends the arguments, rather than reading it as '
        + 'no restriction and running all 92 entries',
      fn: async () => {
        expect(function readTrailingFlag() {
          readOnlyIds({ argv: argvWith({ rest: ['--only',], },), },);
        },).toThrow();
      },
    },),

    it({
      name: 'THROWS when the next argument is another flag, which is what a '
        + 'forgotten value looks like: --only --plan would otherwise silently '
        + 'take "--plan" for an entry id and match nothing',
      fn: async () => {
        expect(function readMissingValue() {
          readOnlyIds({ argv: argvWith({ rest: ['--only', '--plan',], },), },);
        },).toThrow();
      },
    },),

    it({
      name: 'THROWS when the value holds only separators and whitespace, since '
        + 'an empty allowlist would run the whole corpus, the exact opposite of '
        + 'what was asked',
      fn: async () => {
        expect(function readEmptyList() {
          readOnlyIds({ argv: argvWith({ rest: ['--only', ' , , ',], },), },);
        },).toThrow();
      },
    },),
  ],
},);
