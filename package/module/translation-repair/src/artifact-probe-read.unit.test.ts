/**
 * Tests for lifting probe telemetry back out of a settled artifact, where
 * absence and malformation must not be treated alike.
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
  readArtifactProbe,
} from '../dist/final/node/index.mjs';

/**
 * Builds one region tally as an artifact carries it.
 *
 * @param envelopeId - envelope the region replaced
 *
 * @param corroborated - upheld claims of added damage
 *
 * @param issueIds - every issue this region serves, which is more than one
 * whenever a single replacement covered several accepted issues
 *
 * @returns Tally object for a fixture artifact
 *
 * @example
 * ```ts
 * const tally = catTally({ envelopeId: 'envelope/nap', },);
 * ```
 */
function catTally(
  {
    envelopeId,
    corroborated = 0,
    issueIds = ['adjudicated/nap',],
  }: {
    readonly envelopeId: string;
    readonly corroborated?: number;
    readonly issueIds?: readonly string[];
  },
): Record<string, unknown> {
  return {
    envelopeId,
    issueIds,
    corroborated,
    removalCorroborated: 0,
    contradicted: 0,
    unanchored: 0,
    noneFound: 3 - corroborated,
    uncertain: 0,
    claims: [],
  };
}

/**
 * Builds one issue record as an artifact carries it.
 *
 * @param repairDisposition - what became of this issue's repair
 *
 * @param introducedDefects - probe reading, or absent when never probed
 *
 * @param issueId - adjudicated issue this record is about; defaults to one id
 * because most cases have a single record and only ownership cases need to
 * tell two apart
 *
 * @returns Record object for a fixture artifact
 *
 * @example
 * ```ts
 * const record = catRecord({ repairDisposition: 'shipped', },);
 * ```
 */
function catRecord(
  {
    repairDisposition,
    introducedDefects,
    issueId = 'adjudicated/nap',
  }: {
    readonly repairDisposition: string;
    readonly introducedDefects?: unknown;
    readonly issueId?: string;
  },
): Record<string, unknown> {
  return {
    chunkIndex: 0,
    repairDisposition,
    resolved: true,
    refined: false,
    issue: { issueId, },
    ...(introducedDefects === undefined ? {} : { introducedDefects, }),
  };
}

await describe({
  name: readArtifactProbe.name,
  children: [
    it({
      name: 'reads only shipped records, since the repair sheet grades only '
        + 'those and counting the rest would put regions nobody judged into a '
        + 'rate about judged ones',
      fn: async () => {
        const reading = readArtifactProbe({
          value: {
            id: 'Kitten',
            issues: [
              catRecord({
                repairDisposition: 'shipped',
                introducedDefects: {
                  heardProbers: 3,
                  configuredProbers: 3,
                  regions: [catTally({ envelopeId: 'envelope/nap', },),],
                },
              },),
              catRecord({
                repairDisposition: 'not-selected',
                introducedDefects: {
                  heardProbers: 3,
                  configuredProbers: 3,
                  regions: [catTally({ envelopeId: 'envelope/chase', },),],
                },
              },),
            ],
          },
          path: 'Kitten',
        },);
        expect(reading.readings,).toHaveLength(1,);
        expect(reading.shippedRecords,).toBe(1,);
        expect(reading.readings[0]
          ?.regions[0]
          ?.envelopeId,).toBe('envelope/nap',);
      },
    },),

    it({
      name: 'pairs each reading with the issue whose RECORD carried it, not '
        + 'with the issues its regions name. One replacement can serve several '
        + 'accepted issues, so a shared envelope appears in every one of their '
        + 'readings and names all of them; deciding ownership from those lists '
        + 'attaches whichever record was indexed last, which is how a graded '
        + 'sheet position would receive another record\'s probe verdict while '
        + 'the counts looked entirely normal',
      fn: async () => {
        /**
         * Envelope serving both issues, exactly as a merged replacement does.
         */
        const shared = catTally({
          envelopeId: 'envelope/shared',
          issueIds: [
            'adjudicated/nap',
            'adjudicated/chase',
          ],
        },);
        const reading = readArtifactProbe({
          value: {
            id: 'Kitten',
            issues: [
              catRecord({
                repairDisposition: 'shipped',
                issueId: 'adjudicated/nap',
                introducedDefects: {
                  heardProbers: 3,
                  configuredProbers: 3,
                  regions: [shared,],
                },
              },),
              catRecord({
                repairDisposition: 'shipped',
                issueId: 'adjudicated/chase',
                introducedDefects: {
                  heardProbers: 3,
                  configuredProbers: 3,
                  regions: [shared,],
                },
              },),
            ],
          },
          path: 'Kitten',
        },);

        expect(reading.owned
          .map(function toIssueId(entry,) {
            return entry.issueId;
          },),).toEqual([
          'adjudicated/nap',
          'adjudicated/chase',
        ],);
        expect(reading.owned,).toHaveLength(2,);
      },
    },),

    it({
      name: 'treats an absent probe field as ordinary and counts it, because '
        + 'an artifact predating the probe is not a fault while a run whose '
        + 'probe never fired still has to be visible',
      fn: async () => {
        const reading = readArtifactProbe({
          value: {
            id: 'Kitten',
            issues: [catRecord({ repairDisposition: 'shipped', },),],
          },
          path: 'Kitten',
        },);
        expect(reading.readings,).toHaveLength(0,);
        expect(reading.shippedRecords,).toBe(1,);
        expect(reading.unprobedRecords,).toBe(1,);
      },
    },),

    it({
      name: 'throws when a PRESENT probe field is malformed, since that means '
        + 'writer and reader disagree and every count downstream is unsound',
      fn: async () => {
        expect(function readsMalformed() {
          readArtifactProbe({
            value: {
              id: 'Kitten',
              issues: [
                catRecord({
                  repairDisposition: 'shipped',
                  introducedDefects: {
                    heardProbers: 3,
                    configuredProbers: 'three',
                    regions: [],
                  },
                },),
              ],
            },
            path: 'Kitten',
          },);
        },).toThrow(ArtifactParseError,);
      },
    },),

    it({
      name: 'refuses a fractional count rather than rounding it, because a '
        + 'fraction means the field is not the tally the reader thinks it is',
      fn: async () => {
        expect(function readsFraction() {
          readArtifactProbe({
            value: {
              id: 'Kitten',
              issues: [
                catRecord({
                  repairDisposition: 'shipped',
                  introducedDefects: {
                    heardProbers: 2.5,
                    configuredProbers: 3,
                    regions: [],
                  },
                },),
              ],
            },
            path: 'Kitten',
          },);
        },).toThrow(ArtifactParseError,);
      },
    },),

    it({
      name: 'reads an artifact carrying no issue report at all without '
        + 'throwing, which is what a blocked entry looks like',
      fn: async () => {
        const reading = readArtifactProbe({
          value: { id: 'Kitten', },
          path: 'Kitten',
        },);
        expect(reading.readings,).toHaveLength(0,);
        expect(reading.shippedRecords,).toBe(0,);
        expect(reading.unprobedRecords,).toBe(0,);
      },
    },),
  ],
},);
