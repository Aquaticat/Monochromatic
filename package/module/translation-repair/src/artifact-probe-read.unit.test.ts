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
    claims = [],
  }: {
    readonly envelopeId: string;
    readonly corroborated?: number;
    readonly issueIds?: readonly string[];
    readonly claims?: readonly unknown[];
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
    claims,
  };
}

/**
 * Builds one screened claim as an artifact carries it, quotes included.
 *
 * The quote fields are present here precisely so a case can assert the reader
 * DROPS them.
 *
 * @param modelId - prober that made the claim
 *
 * @param admissibility - what the screen made of the quote
 *
 * @returns Claim object for a fixture artifact
 *
 * @example
 * ```ts
 * const claim = catClaim({ modelId: 'cat/one', },);
 * ```
 */
function catClaim(
  {
    modelId,
    admissibility = 'corroborated',
  }: {
    readonly modelId: string;
    readonly admissibility?: string;
  },
): Record<string, unknown> {
  return {
    modelId,
    admissibility,
    category: 'meaning',
    severity: 'major',
    evidence: 'the cat naps on the sunlit sill',
    omittedText: 'the cat had not napped',
    reason: 'this wording is new in the replacement',
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
    refined = false,
  }: {
    readonly repairDisposition: string;
    readonly introducedDefects?: unknown;
    readonly issueId?: string;
    readonly refined?: boolean;
  },
): Record<string, unknown> {
  return {
    chunkIndex: 0,
    repairDisposition,
    resolved: true,
    refined,
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
      name: 'keeps claim IDENTITY and drops the quotes. The majority rule '
        + 'counts distinct probers, so modelId and admissibility have to '
        + 'survive parsing or every region reads as uncorroborated; the quote '
        + 'fields carry unlicensed corpus text into a summary meant to be '
        + 'pasteable, so they must not',
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
                  regions: [
                    catTally({
                      envelopeId: 'envelope/nap',
                      corroborated: 1,
                      claims: [catClaim({ modelId: 'cat/one', },),],
                    },),
                  ],
                },
              },),
            ],
          },
          path: 'Kitten',
        },);

        /**
         * Sole parsed claim.
         */
        const claim = reading.readings[0]
          ?.regions[0]
          ?.claims[0];

        expect(claim?.modelId,).toBe('cat/one',);
        expect(claim?.admissibility,).toBe('corroborated',);
        expect(claim?.evidence,).toBe('',);
        expect(claim?.omittedText,).toBe('',);
        expect(claim?.reason,).toBe('',);
      },
    },),

    it({
      name: 'THROWS on an admissibility the screen never emits, rather than '
        + 'treating it as non-upholding. An unrecognized verdict name would '
        + 'silently zero the corroboration of every region and read as a clean '
        + 'run, which is the failure shape that looks most like success',
      fn: async () => {
        expect(function readsUnknownAdmissibility() {
          readArtifactProbe({
            value: {
              id: 'Kitten',
              issues: [
                catRecord({
                  repairDisposition: 'shipped',
                  introducedDefects: {
                    heardProbers: 3,
                    configuredProbers: 3,
                    regions: [
                      catTally({
                        envelopeId: 'envelope/nap',
                        corroborated: 1,
                        claims: [
                          catClaim({
                            modelId: 'cat/one',
                            admissibility: 'probably-fine',
                          },),
                        ],
                      },),
                    ],
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
      name: 'carries the REFINED flag with each reading, because it decides '
        + 'whether the reading is about the text that shipped. The probe runs '
        + 'inside the accuracy stage and the naturalness lane runs after it, so '
        + 'on a refined slice the probe judged wording the lane replaced, while '
        + 'the repair sheet asks the human to grade the returned wording. '
        + 'Without this flag that mismatch joins silently',
      fn: async () => {
        const reading = readArtifactProbe({
          value: {
            id: 'Kitten',
            issues: [
              catRecord({
                repairDisposition: 'shipped',
                issueId: 'adjudicated/nap',
                refined: true,
                introducedDefects: {
                  heardProbers: 3,
                  configuredProbers: 3,
                  regions: [],
                },
              },),
              catRecord({
                repairDisposition: 'shipped',
                issueId: 'adjudicated/chase',
                introducedDefects: {
                  heardProbers: 3,
                  configuredProbers: 3,
                  regions: [],
                },
              },),
            ],
          },
          path: 'Kitten',
        },);

        expect(reading.owned
          .map(function toRefined(entry,) {
            return entry.refined;
          },),).toEqual([
          true,
          false,
        ],);
      },
    },),

    it({
      name: 'THROWS when a declared count disagrees with the claim list it is '
        + 'the tally of. The screen derives one from the other, so they are a '
        + 'single fact written twice, but they are read by different consumers: '
        + 'the CLAIMS report sums the counts while the majority rule reads the '
        + 'claims. A disagreement makes a region report one corroboration and '
        + 'flag nothing, or flag a majority while reporting none, and both look '
        + 'like ordinary output',
      fn: async () => {
        expect(function readsDisagreeingCount() {
          readArtifactProbe({
            value: {
              id: 'Kitten',
              issues: [
                catRecord({
                  repairDisposition: 'shipped',
                  introducedDefects: {
                    heardProbers: 3,
                    configuredProbers: 3,
                    regions: [
                      catTally({
                        envelopeId: 'envelope/nap',
                        // Says two were upheld while listing one.
                        corroborated: 2,
                        claims: [catClaim({ modelId: 'cat/one', },),],
                      },),
                    ],
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
      name: 'THROWS on a disposition the pipeline never writes rather than '
        + 'filing it under not-shipped. A typo is not another disposition, it '
        + 'means writer and reader disagree, and quietly excluding the record '
        + 'shrinks the denominator of a rate with nothing recording that it '
        + 'happened',
      fn: async () => {
        expect(function readsUnknownDisposition() {
          readArtifactProbe({
            value: {
              id: 'Kitten',
              issues: [catRecord({ repairDisposition: 'shippped', },),],
            },
            path: 'Kitten',
          },);
        },).toThrow(ArtifactParseError,);
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
