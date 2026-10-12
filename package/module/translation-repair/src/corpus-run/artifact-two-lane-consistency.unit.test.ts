/**
 Tests for what the consistency pass says about one slice of a recorded
 section: the text of a slice it changed, and nothing for any other.

 Fixtures are cat-themed invention; no corpus content appears here.

 @module
 */

import {
  DEFAULT_CONCURRENCY,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type ArtifactConsistency,
  consistencyOverrideAt,
  NO_CONSISTENCY,
} from '../../dist/final/node/index.mjs';

/**
 A section whose pass changed the second slice.
 */
const CHANGED_SECOND: ArtifactConsistency = {
  groups: [],
  slices: [{ sliceIndex: 1, text: '## Two\n\nThe kitten naps on the sunny sill.', },],
  findings: [],
};

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: consistencyOverrideAt.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'READS THE TEXT OF A SLICE THE PASS CHANGED AND NOTHING FOR ANY OTHER, or for a pass that changed none',
          fn: async () => {
            expect([
              consistencyOverrideAt({ consistency: CHANGED_SECOND, sliceIndex: 1, },),
              consistencyOverrideAt({ consistency: CHANGED_SECOND, sliceIndex: 0, },),
              consistencyOverrideAt({ consistency: NO_CONSISTENCY, sliceIndex: 1, },),
            ],).toEqual([
              { kind: 'replaced', text: '## Two\n\nThe kitten naps on the sunny sill.', },
              { kind: 'untouched', },
              { kind: 'untouched', },
            ],);
          },
        },),
      ],
    },),
  ],
},);
