/**
 * Tests the page assembly section: its parsing across generations and the
 * per-slice override reading.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  ArtifactParseError,
  NO_PAGE_ASSEMBLY,
  pageAssemblyOverrideAt,
  parsePageAssembly,
} from '../../dist/final/node/index.mjs';

/**
 * A recorded section with one trim and one withdrawal.
 */
const RECORDED = {
  trimmed: [{ sliceIndex: 14, replacementText: '[^1]: The note.', },],
  withdrawn: [7,],
  findings: ['assembly-footnote-trimmed orphan-definition gfm 2 (slice 14)',],
};

await describe({
  name: parsePageAssembly.name,
  children: [
    it({
      name: 'reads an absent section on an older generation as a guard that touched nothing',
      fn: async () => {
        expect(parsePageAssembly({ value: undefined, path: 'x.pageAssembly', required: false, },),)
          .toEqual(NO_PAGE_ASSEMBLY,);
      },
    },),
    it({
      name: 'REFUSES an absent section on a generation that writes it',
      fn: async () => {
        expect(() => parsePageAssembly({ value: undefined, path: 'x.pageAssembly', required: true, },),)
          .toThrow(ArtifactParseError,);
      },
    },),
    it({
      name: 'reads a recorded section back as written and refuses a stray key',
      fn: async () => {
        expect(parsePageAssembly({ value: RECORDED, path: 'x.pageAssembly', required: true, },),)
          .toEqual(RECORDED,);
        expect(() => parsePageAssembly({
          value: { ...RECORDED, extra: true, },
          path: 'x.pageAssembly',
          required: true,
        },),).toThrow(ArtifactParseError,);
      },
    },),
  ],
},);

await describe({
  name: pageAssemblyOverrideAt.name,
  children: [
    it({
      name: 'names a trimmed slice with its text, a withdrawn slice, and an untouched one',
      fn: async () => {
        expect(pageAssemblyOverrideAt({ pageAssembly: RECORDED, sliceIndex: 14, },),)
          .toEqual({ kind: 'trimmed', text: '[^1]: The note.', },);
        expect(pageAssemblyOverrideAt({ pageAssembly: RECORDED, sliceIndex: 7, },),)
          .toEqual({ kind: 'withdrawn', },);
        expect(pageAssemblyOverrideAt({ pageAssembly: RECORDED, sliceIndex: 0, },),)
          .toEqual({ kind: 'untouched', },);
      },
    },),
  ],
},);
