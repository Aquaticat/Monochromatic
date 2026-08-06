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
} from '../dist/final/neutral/index.mjs';

/**
 * Builds one region tally as an artifact carries it.
 *
 * @param envelopeId - envelope the region replaced
 *
 * @param corroborated - upheld claims of added damage
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
  }: {
    readonly envelopeId: string;
    readonly corroborated?: number;
  },
): Record<string, unknown> {
  return {
    envelopeId,
    issueIds: ['adjudicated/nap',],
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
  }: {
    readonly repairDisposition: string;
    readonly introducedDefects?: unknown;
  },
): Record<string, unknown> {
  return {
    chunkIndex: 0,
    repairDisposition,
    resolved: true,
    refined: false,
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
