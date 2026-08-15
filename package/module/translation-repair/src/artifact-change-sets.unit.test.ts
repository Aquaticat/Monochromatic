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
  AssemblyContractError,
  parseSettledArtifact,
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
        },).toThrow('newest this reader knows',);
      },
    },),
    it({
      name: 'REFUSES a version that is not a count at all, before comparing it to anything',
      fn: async () => {
        expect(function readStringVersion() {
          readArtifactSchemaVersion({
            artifact: { artifactSchemaVersion: '1', },
            path: 'Mittens',
          },);
        },).toThrow('a number',);
      },
    },),
  ],
},);

await describe({
  name: readArtifactChangeSets.name,
  children: [
    it({
      name: 'reads an artifact that recorded neither set as UNRECORDED, and carries no arrays at all: a run '
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
        expect(sets.kind,).toBe('unrecorded',);
        expect(Object.hasOwn(sets, 'shipped',),).toBe(false,);
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
      name: 'reads an artifact that recorded both sets WITHOUT a slice count as uncounted, keeping every rule '
        + 'a count is not needed for: the 2026-08-15 generation wrote the arrays before anything wrote their '
        + 'denominator, and skipping all of its checks for want of one would accept a repeat it can see',
      fn: async () => {
        /** Reading over the generation that has arrays and no count. */
        const sets = readArtifactChangeSets({
          artifact: {
            shippedChunkIndices: [
              9,
              2,
            ],
            withdrawnChunkIndices: [],
          },
          path: 'Mittens',
        },);
        expect(sets,).toEqual({
          kind: 'uncounted',
          shipped: [
            2,
            9,
          ],
          withdrawn: [],
        },);
        expect(changeSetFailure({
          artifact: {
            shippedChunkIndices: [
              2,
              2,
            ],
            withdrawnChunkIndices: [],
          },
        },),).toBeInstanceOf(AssemblyContractError,);
      },
    },),
    it({
      name: 'REFUSES one index set without the other, whichever half is missing: every generation wrote both '
        + 'or neither, so one alone means the record was edited or truncated, and reading it would report a '
        + 'shipped set with no withdrawals as though a run had said so',
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
      name: 'REFUSES an index outside the slices a versioned artifact says it prepared',
      fn: async () => {
        /** Failure the out-of-range index raised. */
        const caught = changeSetFailure({
          artifact: {
            artifactSchemaVersion: SETTLED_ARTIFACT_SCHEMA_VERSION,
            sliceCount: 2,
            shippedChunkIndices: [2,],
            withdrawnChunkIndices: [],
          },
        },);
        expect(caught,).toBeInstanceOf(AssemblyContractError,);
        expect(String(caught,),).toContain('of 2 prepared',);
      },
    },),
    it({
      name: 'REFUSES a slice recorded as both shipped and withdrawn, which the writing lane\'s own contract '
        + 'calls impossible: found in a file afterwards it means the same thing it means at assembly',
      fn: async () => {
        /** Failure the overlap raised. */
        const caught = changeSetFailure({
          artifact: {
            artifactSchemaVersion: SETTLED_ARTIFACT_SCHEMA_VERSION,
            sliceCount: 4,
            shippedChunkIndices: [
              1,
              3,
            ],
            withdrawnChunkIndices: [3,],
          },
        },);
        expect(caught,).toBeInstanceOf(AssemblyContractError,);
        expect(String(caught,),).toContain('both shipped and withdrawn',);
      },
    },),
    it({
      name: 'REFUSES an entry that is not a slice index, naming the position it sits at',
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
  ],
},);
