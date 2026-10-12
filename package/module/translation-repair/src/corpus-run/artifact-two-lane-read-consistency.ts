import { requireExactKeys, } from '../artifact-exact-guard.ts';
import {
  ArtifactParseError,
  requireArray,
  requireCount,
  requireRecord,
  requireString,
  requireStringList,
} from '../artifact-guard.ts';
import {
  type ArtifactConsistency,
  type ArtifactConsistencyGroup,
  type ArtifactConsistencySlice,
  NO_CONSISTENCY,
} from './artifact-two-lane-consistency.ts';
import { assertGroupFits, } from './artifact-two-lane-read-consistency-fit.ts';
import {
  assertAskedGroupCoherent,
  assertSlicesCoherent,
} from './artifact-two-lane-read-consistency-coherence.ts';
import { parseConsistencyOccurrence, } from './artifact-two-lane-read-consistency-occurrence.ts';
import {
  parseConsistencyRepeat,
  parseConsistencyUnplaced,
} from './artifact-two-lane-read-consistency-parts.ts';
import { parseConsistencyVerdict, } from './artifact-two-lane-read-consistency-verdict.ts';

//region Artifact consistency reading
// Reading the consistency section of a settled artifact: every key checked,
// every group recounted from its ballots, every changed slice tied to a
// replaced place (`artifact-two-lane-read-consistency-coherence.ts`).

/**
 Reads one group.

 @param value - recorded group

 @param path - where it sits, for the parse error

 @param sliceIndexes - slices the artifact's comparison names

 @returns The group

 @throws {@link ArtifactParseError} when it is malformed or contradicts its own ballots

 @example
 ```ts
 const group = parseConsistencyGroup({ value, path: `${path}.groups[0]`, sliceIndexes, },);
 ```
 */
function parseConsistencyGroup(
  {
    value,
    path,
    sliceIndexes,
  }: {
    readonly value: unknown;
    readonly path: string;
    readonly sliceIndexes: ReadonlySet<number>;
  },
): ArtifactConsistencyGroup {
  /**
   The group as a record.
   */
  const record = requireRecord({
    value,
    path,
  },);
  requireExactKeys({
    record,
    allowed: [
      'repeat',
      'occurrences',
      'unplaced',
      'verdict',
    ],
    path,
  },);
  /**
   The group as the file holds it.
   */
  const group: ArtifactConsistencyGroup = {
    repeat: parseConsistencyRepeat({
      value: record.repeat,
      path: `${path}.repeat`,
    },),
    occurrences: requireArray({
      value: record.occurrences,
      path: `${path}.occurrences`,
    },)
      .map(function toOccurrence(
        entry,
        at,
      ) {
        return parseConsistencyOccurrence({
          value: entry,
          path: `${path}.occurrences[${String(at,)}]`,
        },);
      },),
    unplaced: requireArray({
      value: record.unplaced,
      path: `${path}.unplaced`,
    },)
      .map(function toUnplaced(
        entry,
        at,
      ) {
        return parseConsistencyUnplaced({
          value: entry,
          path: `${path}.unplaced[${String(at,)}]`,
        },);
      },),
    verdict: parseConsistencyVerdict({
      value: record.verdict,
      path: `${path}.verdict`,
    },),
  };
  assertGroupFits({
    group,
    path,
    sliceIndexes,
  },);
  if (group.verdict
    .kind
    === 'asked')
    assertAskedGroupCoherent({
      group: {
        ...group,
        verdict: group.verdict,
      },
      path,
    },);
  return group;
}

/**
 Reads one changed slice.

 @param value - recorded row

 @param path - where it sits, for the parse error

 @param sliceIndexes - slices the artifact's comparison names

 @returns The row

 @throws {@link ArtifactParseError} when it is malformed or names a slice the
 comparison does not

 @example
 ```ts
 const row = parseConsistencySlice({ value, path: `${path}.slices[0]`, sliceIndexes, },);
 ```
 */
function parseConsistencySlice(
  {
    value,
    path,
    sliceIndexes,
  }: {
    readonly value: unknown;
    readonly path: string;
    readonly sliceIndexes: ReadonlySet<number>;
  },
): ArtifactConsistencySlice {
  /**
   The row as a record.
   */
  const record = requireRecord({
    value,
    path,
  },);
  requireExactKeys({
    record,
    allowed: [
      'sliceIndex',
      'text',
    ],
    path,
  },);
  /**
   Slice the row changes.
   */
  const sliceIndex = requireCount({
    value: record.sliceIndex,
    path: `${path}.sliceIndex`,
  },);
  if (!sliceIndexes.has(sliceIndex,)) {
    throw new ArtifactParseError({
      path: `${path}.sliceIndex`,
      reason: 'a slice the comparison names',
    },);
  }
  return {
    sliceIndex,
    text: requireString({
      value: record.text,
      path: `${path}.text`,
    },),
  };
}

/**
 Reads the consistency section of a settled artifact.

 @param value - recorded section, absent on artifacts written before it

 @param path - where it sits, for the parse error

 @param writesSection - whether this generation writes the section, so its
 absence is a broken file and its presence in an older one is a broken file too

 @param sliceIndexes - slices the artifact's comparison names

 @returns The section, empty on an older artifact

 @throws {@link ArtifactParseError} when a required section is absent, an older
 generation carries one, any field is the wrong shape, or a group contradicts
 its own ballots

 @example
 ```ts
 const consistency = parseConsistency({ value: artifact.consistency, path: `${id}.consistency`, writesSection, sliceIndexes, },);
 ```
 */
export function parseConsistency(
  {
    value,
    path,
    writesSection,
    sliceIndexes,
  }: {
    readonly value: unknown;
    readonly path: string;
    readonly writesSection: boolean;
    readonly sliceIndexes: ReadonlySet<number>;
  },
): ArtifactConsistency {
  if (value === undefined) {
    if (writesSection) {
      throw new ArtifactParseError({
        path,
        reason: 'recorded consistency from generation fifteen',
      },);
    }
    return NO_CONSISTENCY;
  }
  if (!writesSection) {
    throw new ArtifactParseError({
      path,
      reason: 'no consistency section before generation fifteen',
    },);
  }
  /**
   The section as a record.
   */
  const record = requireRecord({
    value,
    path,
  },);
  requireExactKeys({
    record,
    allowed: [
      'groups',
      'slices',
      'findings',
    ],
    path,
  },);
  /**
   Groups as recorded.
   */
  const groups = requireArray({
    value: record.groups,
    path: `${path}.groups`,
  },)
    .map(function toGroup(
      entry,
      at,
    ) {
      return parseConsistencyGroup({
        value: entry,
        path: `${path}.groups[${String(at,)}]`,
        sliceIndexes,
      },);
    },);
  /**
   Changed slices as recorded.
   */
  const slices = requireArray({
    value: record.slices,
    path: `${path}.slices`,
  },)
    .map(function toSlice(
      entry,
      at,
    ) {
      return parseConsistencySlice({
        value: entry,
        path: `${path}.slices[${String(at,)}]`,
        sliceIndexes,
      },);
    },);
  assertSlicesCoherent({
    groups,
    slices,
    path: `${path}.slices`,
  },);
  return {
    groups,
    slices,
    findings: requireStringList({
      value: record.findings,
      path: `${path}.findings`,
    },),
  };
}

//endregion Artifact consistency reading
