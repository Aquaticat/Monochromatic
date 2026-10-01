/**
 Tests for the coverage probe's command line: the entry filter and the
 candidate cap, read from an argument vector the way `process.argv` presents
 one. Fixtures are cat-themed invention only.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  DEFAULT_CANDIDATE_CAP,
  readCoverageProbeArguments,
} from '../../dist/final/node/index.mjs';

/**
 What `process.argv` carries before anything a person typed.
 */
const BEFORE_FLAGS: readonly string[] = [
  '/usr/bin/node',
  '/somewhere/coverage-probe.mjs',
];

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
  return readCoverageProbeArguments({ argv: [...BEFORE_FLAGS, ...typed,], },);
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
  ],
},);
