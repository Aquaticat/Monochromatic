/**
 * Tests for reading a settled artifact's schema generation and index sets.
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
  ArtifactParseError,
  buildSettledArtifact,
  parseSettledArtifact,
  type PipelineDigest,
  readArtifactChangeSets,
  readArtifactSchemaVersion,
  SETTLED_ARTIFACT_SCHEMA_VERSION,
} from '../dist/final/node/index.mjs';

/**
 * Reads change sets out of one artifact record, returning whatever it threw.
 *
 * @param artifact - artifact record under test
 *
 * @returns Failure it raised, or `undefined` when it accepted the record
 *
 * @example
 * ```ts
 * const caught = changeSetFailure({ artifact: { shippedChunkIndices: [], }, },);
 * ```
 */
function changeSetFailure(
  { artifact, }: { readonly artifact: Readonly<Record<string, unknown>>; },
): unknown {
  try {
    readArtifactChangeSets({
      artifact,
      path: 'Mittens',
    },);
  }
  catch (error) {
    return error;
  }
  return undefined;
}

/**
 * Artifact as the pass writes one today, with both sets and their count.
 */
const VERSIONED_ARTIFACT = {
  artifactSchemaVersion: SETTLED_ARTIFACT_SCHEMA_VERSION,
  sliceCount: 5,
  shippedChunkIndices: [
    3,
    0,
  ],
  withdrawnChunkIndices: [4,],
} as const;

await describe({
  name: readArtifactSchemaVersion.name,
  children: [
    it({
      name: 'reads an artifact with no version field as UNVERSIONED rather than as version zero, which is '
        + 'the whole reason the reading is a union: every artifact settled to date is one of these',
      fn: async () => {
        expect(readArtifactSchemaVersion({
          artifact: { id: 'Mittens', },
          path: 'Mittens',
        },).kind,).toBe('unversioned',);
      },
    },),
    it({
      name: 'reads the generation the pass writes today',
      fn: async () => {
        expect(readArtifactSchemaVersion({
          artifact: VERSIONED_ARTIFACT,
          path: 'Mittens',
        },),).toEqual({
          kind: 'versioned',
          version: SETTLED_ARTIFACT_SCHEMA_VERSION,
        },);
      },
    },),
    it({
      name: 'REFUSES a generation written after this reader was compiled, rather than parsing it on the '
        + 'assumption that fields it knows still mean what they did: an instrument that reports a wrong '
        + 'number is worse than one that reports none',
      fn: async () => {
        expect(function readFutureVersion() {
          readArtifactSchemaVersion({
            artifact: { artifactSchemaVersion: SETTLED_ARTIFACT_SCHEMA_VERSION + 1, },
            path: 'Mittens',
          },);
        },).toThrow('this reader knows',);
      },
    },),
    it({
      name: 'REFUSES version zero as firmly as a future one. Zero is what a reader that defaulted an '
        + 'absent field would have invented, so accepting it would let the invention back in through '
        + 'the field itself',
      fn: async () => {
        expect(function readZeroVersion() {
          readArtifactSchemaVersion({
            artifact: { artifactSchemaVersion: 0, },
            path: 'Mittens',
          },);
        },).toThrow('this reader knows',);
      },
    },),
    it({
      name: 'REFUSES a version that is not a count at all, before comparing it to anything: a string, a '
        + 'fraction and a negative each mean the writer and this reader disagree about the field',
      fn: async () => {
        expect(function readStringVersion() {
          readArtifactSchemaVersion({
            artifact: { artifactSchemaVersion: '1', },
            path: 'Mittens',
          },);
        },).toThrow('a number',);
        expect(function readFractionalVersion() {
          readArtifactSchemaVersion({
            artifact: { artifactSchemaVersion: 1.5, },
            path: 'Mittens',
          },);
        },).toThrow('a non-negative integer',);
        expect(function readNegativeVersion() {
          readArtifactSchemaVersion({
            artifact: { artifactSchemaVersion: -1, },
            path: 'Mittens',
          },);
        },).toThrow('a non-negative integer',);
      },
    },),
  ],
},);

await describe({
  name: readArtifactChangeSets.name,
  children: [
    it({
      name: 'reads an artifact that recorded neither set as UNRECORDED, carrying neither array: a run '
        + 'nobody wrote index sets for must never read as a run that changed nothing, and an empty array '
        + 'is exactly how those two become indistinguishable',
      fn: async () => {
        /** Reading over an artifact from before index recording existed. */
        const sets = readArtifactChangeSets({
          artifact: {
            id: 'Mittens',
            status: 'repaired',
          },
          path: 'Mittens',
        },);
        expect(sets,).toEqual({ kind: 'unrecorded', },);
        expect(Object.hasOwn(sets, 'shipped',),).toBe(false,);
        expect(Object.hasOwn(sets, 'withdrawn',),).toBe(false,);
      },
    },),
    it({
      name: 'reads both sets of a versioned artifact ascending, bounded by the count it records',
      fn: async () => {
        expect(readArtifactChangeSets({
          artifact: VERSIONED_ARTIFACT,
          path: 'Mittens',
        },),).toEqual({
          kind: 'counted',
          sliceCount: 5,
          shipped: [
            0,
            3,
          ],
          withdrawn: [4,],
        },);
      },
    },),
    it({
      name: 'reads two EMPTY recorded sets as a run that genuinely changed nothing, whether or not it '
        + 'was versioned. This is the reading the unknown must never be folded into, so it has to be '
        + 'reachable in its own right',
      fn: async () => {
        expect(readArtifactChangeSets({
          artifact: {
            artifactSchemaVersion: SETTLED_ARTIFACT_SCHEMA_VERSION,
            sliceCount: 3,
            shippedChunkIndices: [],
            withdrawnChunkIndices: [],
          },
          path: 'Mittens',
        },),).toEqual({
          kind: 'counted',
          sliceCount: 3,
          shipped: [],
          withdrawn: [],
        },);
        expect(readArtifactChangeSets({
          artifact: {
            shippedChunkIndices: [],
            withdrawnChunkIndices: [],
          },
          path: 'Mittens',
        },),).toEqual({
          kind: 'uncounted',
          shipped: [],
          withdrawn: [],
        },);
      },
    },),
    it({
      name: 'reads an artifact that recorded both sets WITHOUT a slice count as uncounted, keeping every '
        + 'rule a count is not needed for on BOTH sets: the 2026-08-15 generation wrote the arrays before '
        + 'anything wrote their denominator, and skipping all of its checks for want of one would accept '
        + 'a repeat or an overlap it can plainly see',
      fn: async () => {
        expect(readArtifactChangeSets({
          artifact: {
            shippedChunkIndices: [
              9,
              2,
            ],
            withdrawnChunkIndices: [],
          },
          path: 'Mittens',
        },),).toEqual({
          kind: 'uncounted',
          shipped: [
            2,
            9,
          ],
          withdrawn: [],
        },);
        expect(function repeatedShipped() {
          readArtifactChangeSets({
            artifact: {
              shippedChunkIndices: [
                2,
                2,
              ],
              withdrawnChunkIndices: [],
            },
            path: 'Mittens',
          },);
        },).toThrow('shipped slices repeat',);
        expect(function repeatedWithdrawn() {
          readArtifactChangeSets({
            artifact: {
              shippedChunkIndices: [],
              withdrawnChunkIndices: [
                4,
                4,
              ],
            },
            path: 'Mittens',
          },);
        },).toThrow('withdrawn slices repeat',);
      },
    },),
    it({
      name: 'REFUSES one index set without the other, whichever half is missing: every generation wrote '
        + 'both or neither, so one alone means the record was edited or truncated, and reading it would '
        + 'report a shipped set with no withdrawals as though a run had said so',
      fn: async () => {
        expect(function shippedAlone() {
          readArtifactChangeSets({
            artifact: { shippedChunkIndices: [1,], },
            path: 'Mittens',
          },);
        },).toThrow('both index sets or neither',);
        expect(function withdrawnAlone() {
          readArtifactChangeSets({
            artifact: { withdrawnChunkIndices: [1,], },
            path: 'Mittens',
          },);
        },).toThrow('both index sets or neither',);
      },
    },),
    it({
      name: 'REFUSES an unversioned artifact that records a slice count, which no writer ever produced. '
        + 'What produces it is a CURRENT artifact whose version field was lost to an edit or a merge, and '
        + 'reading that as an older generation would throw away a denominator the run recorded',
      fn: async () => {
        expect(function countWithoutVersion() {
          readArtifactChangeSets({
            artifact: {
              sliceCount: 2,
              shippedChunkIndices: [],
              withdrawnChunkIndices: [],
            },
            path: 'Mittens',
          },);
        },).toThrow('records the slice count that arrived with one',);
      },
    },),
    it({
      name: 'treats an explicit null as PRESENT and refuses it, rather than reading it as the absence of a '
        + 'field: a writer that emitted null said something, and what it said is not a set of indices',
      fn: async () => {
        expect(function nullShipped() {
          readArtifactChangeSets({
            artifact: {
              shippedChunkIndices: null,
              withdrawnChunkIndices: [],
            },
            path: 'Mittens',
          },);
        },).toThrow('an array',);
      },
    },),
    it({
      name: 'REFUSES a versioned artifact that omits the sets or their count, since the version is what '
        + 'promises them: a missing field is a defect there rather than an older generation',
      fn: async () => {
        expect(function versionedWithoutSets() {
          readArtifactChangeSets({
            artifact: {
              artifactSchemaVersion: SETTLED_ARTIFACT_SCHEMA_VERSION,
              sliceCount: 2,
            },
            path: 'Mittens',
          },);
        },).toThrow('index sets',);
        expect(function versionedWithoutCount() {
          readArtifactChangeSets({
            artifact: {
              artifactSchemaVersion: SETTLED_ARTIFACT_SCHEMA_VERSION,
              shippedChunkIndices: [0,],
              withdrawnChunkIndices: [],
            },
            path: 'Mittens',
          },);
        },).toThrow('sliceCount',);
      },
    },),
    it({
      name: 'REFUSES an index outside the slices a versioned artifact says it prepared, on either side, '
        + 'and reports it as a defect of the ARTIFACT naming the entry. A reader holding a file cannot '
        + 'know whether the run, an edit or a truncation put it there, so it says what the file contains '
        + 'rather than who broke the contract',
      fn: async () => {
        /** Failure the out-of-range shipped index raised. */
        const caught = changeSetFailure({
          artifact: {
            artifactSchemaVersion: SETTLED_ARTIFACT_SCHEMA_VERSION,
            sliceCount: 2,
            shippedChunkIndices: [2,],
            withdrawnChunkIndices: [],
          },
        },);
        expect(caught,).toBeInstanceOf(ArtifactParseError,);
        expect(String(caught,),).toContain('Mittens index sets',);
        expect(String(caught,),).toContain('of 2 prepared',);
        expect(function withdrawnOutOfRange() {
          readArtifactChangeSets({
            artifact: {
              artifactSchemaVersion: SETTLED_ARTIFACT_SCHEMA_VERSION,
              sliceCount: 2,
              shippedChunkIndices: [],
              withdrawnChunkIndices: [7,],
            },
            path: 'Mittens',
          },);
        },).toThrow('of 2 prepared',);
      },
    },),
    it({
      name: 'REFUSES a slice recorded as both shipped and withdrawn, which the writing lanes call '
        + 'impossible by construction: found in a file afterwards it describes the same contradiction',
      fn: async () => {
        expect(function overlapping() {
          readArtifactChangeSets({
            artifact: {
              artifactSchemaVersion: SETTLED_ARTIFACT_SCHEMA_VERSION,
              sliceCount: 4,
              shippedChunkIndices: [
                1,
                3,
              ],
              withdrawnChunkIndices: [3,],
            },
            path: 'Mittens',
          },);
        },).toThrow('both shipped and withdrawn',);
      },
    },),
    it({
      name: 'REFUSES an entry that is not a slice index, naming the position it sits at, and refuses one '
        + 'too large for JSON to carry exactly however whole it looks',
      fn: async () => {
        expect(function fractionalIndex() {
          readArtifactChangeSets({
            artifact: {
              shippedChunkIndices: [
                0,
                1.5,
              ],
              withdrawnChunkIndices: [],
            },
            path: 'Mittens',
          },);
        },).toThrow('shippedChunkIndices[1]',);
        expect(function unsafeIndex() {
          readArtifactChangeSets({
            artifact: {
              shippedChunkIndices: [Number.MAX_SAFE_INTEGER + 2,],
              withdrawnChunkIndices: [],
            },
            path: 'Mittens',
          },);
        },).toThrow('no larger than JSON carries exactly',);
      },
    },),
  ],
},);

await describe({
  name: `${parseSettledArtifact.name} change sets`,
  children: [
    it({
      name: 'carries the unknown through to the parsed artifact, so a consumer counting shipped slices over '
        + 'a directory of older runs cannot mistake them for runs that shipped none',
      fn: async () => {
        expect(parseSettledArtifact({
          value: {
            id: 'Mittens',
            status: 'unchanged',
            issues: [],
          },
        },).changeSets
          .kind,).toBe('unrecorded',);
      },
    },),
    it({
      name: 'reads the sets of an artifact the pass wrote under the current schema',
      fn: async () => {
        expect(parseSettledArtifact({
          value: {
            ...VERSIONED_ARTIFACT,
            id: 'Mittens',
            status: 'repaired',
            issues: [],
          },
        },).changeSets,).toEqual({
          kind: 'counted',
          sliceCount: 5,
          shipped: [
            0,
            3,
          ],
          withdrawn: [4,],
        },);
      },
    },),
    it({
      name: 'REFUSES a generation from the future through the parser too, since a consumer scanning a '
        + 'directory meets artifacts a newer pass wrote there rather than hand-built records',
      fn: async () => {
        expect(function parseFutureArtifact() {
          parseSettledArtifact({
            value: {
              ...VERSIONED_ARTIFACT,
              artifactSchemaVersion: SETTLED_ARTIFACT_SCHEMA_VERSION + 1,
              id: 'Mittens',
              status: 'repaired',
              issues: [],
            },
          },);
        },).toThrow('this reader knows',);
      },
    },),
    it({
      name: 'ROUND-TRIPS what the pass actually writes, through JSON, into what the parser reads. Every '
        + 'other test here hand-builds the record, so removing or misspelling a field in the writer would '
        + 'leave all of them passing while no real artifact carried it',
      fn: async () => {
        /** Artifact the writer produces for a two-slice document. */
        const artifact = buildSettledArtifact({
          entryId: 'Mittens',
          tip: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          pipelineDigest: 'sha256-tree-v1:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as PipelineDigest,
          corpusSha: 'cccccccccccccccccccccccccccccccccccccccc',
          callConfig: { perCallTimeoutMs: 1_000, },
          status: 'repaired',
          durationMs: 12,
          sourceText: '猫在晒太阳。',
          targetText: 'The cat naps in the sun.',
          result: {
            issues: [],
            findings: [],
            chunkCritics: [],
            repairedText: 'The cat naps in the warm sun.',
            sliceCount: 2,
            shippedChunkIndices: [0,],
            withdrawnChunkIndices: [1,],
          },
          acceptedCount: 0,
          resolvedCount: 0,
        },);
        /** What lands on disk, which is where a later reader meets it. */
        const onDisk = JSON.stringify(artifact,);
        expect(parseSettledArtifact({ value: JSON.parse(onDisk,), },).changeSets,).toEqual({
          kind: 'counted',
          sliceCount: 2,
          shipped: [0,],
          withdrawn: [1,],
        },);
      },
    },),
  ],
},);
