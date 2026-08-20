/**
 * Tests for the adjacent-slice repetition check: what it names, and the four
 * things it must NOT name.
 *
 * WHY IT EXISTS SEPARATELY from the document-scale check: that one requires two
 * words of at least five letters before reporting anything, and `#107`'s own
 * example carries none, so the check written for that defect cannot see it.
 * Adjacency is specific enough to need no content gate, which
 * `doc/audit/an-archive-rebuilt-from-the-ledger-is-not-the-archive.md`
 * measures at one hit in twenty-two lane readings.
 *
 * Fixtures are cat-themed invention mirroring corpus structure only.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  adjacentRepetitionFindings,
  findAdjacentRepetitions,
} from '../dist/final/node/index.mjs';

/**
 * Wording long enough to report, with NO word of five letters, mirroring the
 * shape of the duplication `#107` recorded.
 */
const SHORT_WORDED = 'and so we let it be';

/**
 * Ordinary wording that carries content words, for the cases where the content
 * gate is beside the point.
 */
const PASSAGE = 'the tabby waited by the garden gate';

await describe({
  name: findAdjacentRepetitions.name,
  children: [
    it({
      name: 'NAMES wording both neighbours ship that the archive said once',
      fn: async () => {
        const found = findAdjacentRepetitions({
          archiveText: `A kitten dozed. ${PASSAGE}. The end.`,
          shippedSlices: [
            {
              chunkIndex: 2,
              text: `A kitten dozed, and ${PASSAGE}.`,
            },
            {
              chunkIndex: 3,
              text: `${PASSAGE}, as it always had.`,
            },
          ],
        },);
        expect(found.length,).toBe(1,);
        expect(found[0]?.earlierChunkIndex,).toBe(2,);
        expect(found[0]?.laterChunkIndex,).toBe(3,);
        expect(found[0]?.archiveOccurrences,).toBe(1,);
      },
    },),
    it({
      name: 'NAMES wording the archive never carried at all',
      fn: async () => {
        const found = findAdjacentRepetitions({
          archiveText: 'A kitten dozed by the stove. The end.',
          shippedSlices: [
            {
              chunkIndex: 0,
              text: `Well, ${PASSAGE}.`,
            },
            {
              chunkIndex: 1,
              text: `${PASSAGE} once more.`,
            },
          ],
        },);
        expect(found.length,).toBe(1,);
        expect(found[0]?.archiveOccurrences,).toBe(0,);
      },
    },),
    it({
      name: 'NAMES wording with no content word, which the document check REFUSES',
      fn: async () => {
        const found = findAdjacentRepetitions({
          archiveText: `A kitten dozed, ${SHORT_WORDED}. The end.`,
          shippedSlices: [
            {
              chunkIndex: 2,
              text: `A kitten dozed, ${SHORT_WORDED}.`,
            },
            {
              chunkIndex: 3,
              text: `${SHORT_WORDED}, said the tabby.`,
            },
          ],
        },);
        expect(found.length,).toBe(1,);
        // FIVE rather than the six words of the fixture, because punctuation
        // rides on its token: the earlier slice ends the run with `be.` and the
        // later one with `be,`, so the shared run stops one word short. That is
        // `wordsOf`'s documented behaviour and the reason nothing is reported
        // as repeated which is not repeated verbatim.
        expect(found[0]?.words,).toBe(5,);
      },
    },),
    it({
      name: 'REFUSES wording the archive itself already repeated',
      fn: async () => {
        const found = findAdjacentRepetitions({
          archiveText: `${PASSAGE}. A kitten dozed. ${PASSAGE}. The end.`,
          shippedSlices: [
            {
              chunkIndex: 2,
              text: `${PASSAGE}.`,
            },
            {
              chunkIndex: 3,
              text: `${PASSAGE}.`,
            },
          ],
        },);
        expect(found.length,).toBe(0,);
      },
    },),
    it({
      name: 'REFUSES a repeat between slices that are NOT neighbours',
      fn: async () => {
        const found = findAdjacentRepetitions({
          archiveText: `A kitten dozed. ${PASSAGE}. The end.`,
          shippedSlices: [
            {
              chunkIndex: 1,
              text: `${PASSAGE}.`,
            },
            {
              chunkIndex: 2,
              text: 'A kitten dozed by the stove.',
            },
            {
              chunkIndex: 3,
              text: `${PASSAGE}.`,
            },
          ],
        },);
        expect(found.length,).toBe(0,);
      },
    },),
    it({
      name: 'REFUSES a shared run shorter than the four-word floor',
      fn: async () => {
        const found = findAdjacentRepetitions({
          archiveText: 'A kitten dozed. The end.',
          shippedSlices: [
            {
              chunkIndex: 0,
              text: 'The tabby sat by the stove.',
            },
            {
              chunkIndex: 1,
              text: 'A kitten dozed by the window.',
            },
          ],
        },);
        expect(found.length,).toBe(0,);
      },
    },),
    it({
      name: 'REPORTS one maximal match rather than every substring of it',
      fn: async () => {
        const found = findAdjacentRepetitions({
          archiveText: 'A kitten dozed. The end.',
          shippedSlices: [
            {
              chunkIndex: 4,
              text: `Look: ${PASSAGE} and dozed.`,
            },
            {
              chunkIndex: 5,
              text: `${PASSAGE} and dozed, again.`,
            },
          ],
        },);
        expect(found.length,).toBe(1,);
      },
    },),
    it({
      name: 'REFUSES to look at a single slice, which has no neighbour',
      fn: async () => {
        const found = findAdjacentRepetitions({
          archiveText: 'A kitten dozed. The end.',
          shippedSlices: [
            {
              chunkIndex: 0,
              text: `${PASSAGE}. ${PASSAGE}.`,
            },
          ],
        },);
        expect(found.length,).toBe(0,);
      },
    },),
  ],
},);

await describe({
  name: adjacentRepetitionFindings.name,
  children: [
    it({
      name: 'NAMES the slice pair and the measurements, and NO wording',
      fn: async () => {
        const findings = adjacentRepetitionFindings({
          archiveText: `A kitten dozed. ${PASSAGE}. The end.`,
          shippedSlices: [
            {
              chunkIndex: 2,
              text: `A kitten dozed, and ${PASSAGE}.`,
            },
            {
              chunkIndex: 3,
              text: `${PASSAGE}, as it always had.`,
            },
          ],
        },);
        expect(findings.length,).toBe(1,);
        expect(findings[0],).toContain('adjacent-repetition',);
        expect(findings[0],).toContain('slices 2 and 3',);
        expect(findings[0],).toContain('archive 1',);
        // THE WHOLE POINT OF RENDERING COUNTS: a findings list travels into
        // logs and artifacts, and corpus wording must not travel with it.
        expect(findings[0],).not.toContain('tabby',);
      },
    },),
    it({
      name: 'RETURNS nothing when neighbours share no reportable wording',
      fn: async () => {
        const findings = adjacentRepetitionFindings({
          archiveText: 'A kitten dozed. The end.',
          shippedSlices: [
            {
              chunkIndex: 0,
              text: 'The tabby sat by the stove.',
            },
            {
              chunkIndex: 1,
              text: 'A kitten dozed by the window.',
            },
          ],
        },);
        expect(findings.length,).toBe(0,);
      },
    },),
  ],
},);
