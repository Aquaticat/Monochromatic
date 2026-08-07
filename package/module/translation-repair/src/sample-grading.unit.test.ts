import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type AdjudicatedIssue,
  allocateBandQuota,
  type BandQuota,
  classifyBand,
  drawStratifiedSample,
  extractGradingCandidate,
  formatGradingSheet,
  type GradingCandidate,
  MEDIUM_BAND_MAX_BYTES,
  type SizeBand,
  SMALL_BAND_MAX_BYTES,
} from '../dist/final/node/index.mjs';

/**
 * Builds a grading candidate for the given entry and band; only the fields a
 * test reads carry meaning, the rest default to cat-themed filler.
 */
function catCandidate(
  {
    entryId,
    band,
    issueId,
  }: {
    readonly entryId: string;
    readonly band: SizeBand;
    readonly issueId: string;
  },
): GradingCandidate {
  return {
    entryId,
    band,
    issueId,
    category: 'accuracy/omission',
    severity: 'minor',
    summary: 'A purr is dropped from the greeting.',
    sourceAnchor: 'quoted',
    sourceQuotes: ['呼噜',],
    targetQuotes: [],
  };
}

/**
 * Builds a pool of `perEntry` candidates for each of `entries`, all in one
 * band, with deterministic ids so draws are checkable.
 */
function catPool(
  {
    band,
    entries,
    perEntry,
  }: {
    readonly band: SizeBand;
    readonly entries: readonly string[];
    readonly perEntry: number;
  },
): readonly GradingCandidate[] {
  return entries.flatMap(function forEntry(entryId,) {
    return [
      ...Array.from({ length: perEntry, },)
        .keys(),
    ]
      .map(function forIssue(issueIndex,) {
        return catCandidate({
          entryId,
          band,
          issueId: `${entryId}/issue/${String(issueIndex,)}`,
        },);
      },);
  },);
}

/**
 * Builds an adjudicated issue from a list of `[side, quote]` span pairs and a
 * primary category, for exercising candidate extraction.
 */
function catIssue(
  {
    issueId,
    category,
    summary,
    spans,
  }: {
    readonly issueId: string;
    readonly category: AdjudicatedIssue['claims'][number]['claim']['category'];
    readonly summary: string;
    readonly spans: readonly (readonly ['source' | 'target', string,])[];
  },
): AdjudicatedIssue {
  return {
    issueId,
    status: 'accepted',
    severity: 'major',
    claims: [
      {
        claimId: `${issueId}/claim`,
        claim: {
          category,
          severity: 'major',
          summary,
          spans: spans.map(function toSpan(pair,) {
            return {
              side: pair[0],
              nodeId: 'block/0',
              nodeHash: 'hash/whisker',
              startOffset: 0,
              endOffset: pair[1]
                .length,
              quotedText: pair[1],
            };
          },),
        },
      },
    ],
    tallies: {},
  };
}

await describe({
  name: '',
  children: [
    //region classifyBand

    describe({
      name: classifyBand.name,
      children: [
        it({
          name: 'is small below the small cut',
          fn: async () => {
            expect(classifyBand({ sourceBytes: SMALL_BAND_MAX_BYTES - 1, },),)
              .toBe('small',);
            expect(classifyBand({ sourceBytes: 0, },),)
              .toBe('small',);
          },
        },),
        it({
          name: 'is medium from the small cut up to the medium cut',
          fn: async () => {
            expect(classifyBand({ sourceBytes: SMALL_BAND_MAX_BYTES, },),)
              .toBe('medium',);
            expect(classifyBand({ sourceBytes: MEDIUM_BAND_MAX_BYTES - 1, },),)
              .toBe('medium',);
          },
        },),
        it({
          name: 'is large at and above the medium cut',
          fn: async () => {
            expect(classifyBand({ sourceBytes: MEDIUM_BAND_MAX_BYTES, },),)
              .toBe('large',);
            expect(classifyBand({ sourceBytes: 40_700, },),)
              .toBe('large',);
          },
        },),
      ],
    },),

    //endregion classifyBand

    //region extractGradingCandidate

    describe({
      name: extractGradingCandidate.name,
      children: [
        it({
          name: 'lifts primary category and summary from the first claim',
          fn: async () => {
            const candidate = extractGradingCandidate({
              issue: catIssue({
                issueId: 'adjudicated/paw',
                category: 'terminology/wrong-term',
                summary: 'Whisker rendered as antenna.',
                spans: [['source', '胡须',], ['target', 'antenna',],],
              },),
              entryId: 'Kitten',
              band: 'small',
            },);
            expect(candidate.category,).toBe('terminology/wrong-term',);
            expect(candidate.summary,).toBe('Whisker rendered as antenna.',);
            expect(candidate.entryId,).toBe('Kitten',);
            expect(candidate.band,).toBe('small',);
          },
        },),
        it({
          name: 'gathers distinct source and target quotes in first-seen order',
          fn: async () => {
            const candidate = extractGradingCandidate({
              issue: catIssue({
                issueId: 'adjudicated/tail',
                category: 'accuracy/omission',
                summary: 'Repeated meow dropped.',
                spans: [
                  ['source', '喵',],
                  ['target', 'meow',],
                  ['source', '喵',],
                  ['target', 'purr',],
                ],
              },),
              entryId: 'Kitten',
              band: 'medium',
            },);
            expect(candidate.sourceQuotes,).toEqual(['喵',],);
            expect(candidate.targetQuotes,).toEqual(['meow', 'purr',],);
          },
        },),
        it({
          name: 'drops empty insertion-anchor quotes',
          fn: async () => {
            const candidate = extractGradingCandidate({
              issue: catIssue({
                issueId: 'adjudicated/empty',
                category: 'accuracy/addition',
                summary: 'Fabricated hiss inserted.',
                spans: [['target', '',], ['target', 'hiss',],],
              },),
              entryId: 'Kitten',
              band: 'large',
            },);
            expect(candidate.targetQuotes,).toEqual(['hiss',],);
            expect(candidate.sourceQuotes,).toEqual([],);
          },
        },),
        it({
          name: 'tells an unanchored claim apart from a correctly anchored insertion',
          fn: async () => {
            // A bare "(none)" on the sheet conflated these, which made one
            // graded item ungradable for the wrong reason.
            /**
             * Claim anchoring a real position in the original that holds no
             * text, which is how an insertion is correctly anchored.
             */
            const insertion = extractGradingCandidate({
              issue: catIssue({
                issueId: 'adjudicated/insertion',
                category: 'accuracy/addition',
                summary: 'Fabricated hiss inserted.',
                spans: [['source', '',], ['target', 'hiss',],],
              },),
              entryId: 'Kitten',
              band: 'large',
            },);

            /**
             * Claim pointing at nothing in the original at all.
             */
            const unanchored = extractGradingCandidate({
              issue: catIssue({
                issueId: 'adjudicated/unanchored',
                category: 'accuracy/addition',
                summary: 'Fabricated hiss inserted.',
                spans: [['target', 'hiss',],],
              },),
              entryId: 'Kitten',
              band: 'large',
            },);

            expect(insertion.sourceAnchor,).toBe('insertion-point',);
            expect(unanchored.sourceAnchor,).toBe('unanchored',);
          },
        },),
      ],
    },),

    //endregion extractGradingCandidate

    //region allocateBandQuota

    describe({
      name: allocateBandQuota.name,
      children: [
        it({
          name: 'splits fifty near-evenly when every band has spare',
          fn: async () => {
            const quota = allocateBandQuota({
              available: { small: 200, medium: 180, large: 90, },
              size: 50,
            },);
            expect(quota,).toEqual({ small: 17, medium: 17, large: 16, },);
          },
        },),
        it({
          name: 'caps a scarce band and redistributes its slots to the others',
          fn: async () => {
            const quota = allocateBandQuota({
              available: { small: 100, medium: 100, large: 4, },
              size: 50,
            },);
            expect(quota.large,).toBe(4,);
            expect(quota.small + quota.medium + quota.large,).toBe(50,);
            expect(Math.abs(quota.small - quota.medium,),).toBeLessThanOrEqual(1,);
          },
        },),
        it({
          name: 'falls to total available when the pool is smaller than the size',
          fn: async () => {
            const quota = allocateBandQuota({
              available: { small: 3, medium: 2, large: 1, },
              size: 50,
            },);
            expect(quota,).toEqual({ small: 3, medium: 2, large: 1, },);
          },
        },),
        it({
          name: 'draws entirely from the only stocked band',
          fn: async () => {
            const quota = allocateBandQuota({
              available: { small: 0, medium: 0, large: 90, },
              size: 50,
            },);
            expect(quota,).toEqual({ small: 0, medium: 0, large: 50, },);
          },
        },),
      ],
    },),

    //endregion allocateBandQuota

    //region drawStratifiedSample

    describe({
      name: drawStratifiedSample.name,
      children: [
        it({
          name: 'is deterministic for a fixed pool and seed',
          fn: async () => {
            const pool = [
              ...catPool({ band: 'small', entries: ['A', 'B',], perEntry: 10, },),
              ...catPool({ band: 'medium', entries: ['C', 'D',], perEntry: 10, },),
              ...catPool({ band: 'large', entries: ['E', 'F',], perEntry: 10, },),
            ];
            const first = drawStratifiedSample({ candidates: pool, size: 30, seed: 'meow', },);
            const second = drawStratifiedSample({ candidates: pool, size: 30, seed: 'meow', },);
            /**
             * Sampled issue ids from the first draw.
             */
            const firstIds = first.map(function toId(candidate,) {
              return candidate.issueId;
            },);
            /**
             * Sampled issue ids from the second draw.
             */
            const secondIds = second.map(function toId(candidate,) {
              return candidate.issueId;
            },);
            expect(firstIds,).toEqual(secondIds,);
          },
        },),
        it({
          name: 'honours the per-band quotas',
          fn: async () => {
            const pool = [
              ...catPool({ band: 'small', entries: ['A',], perEntry: 40, },),
              ...catPool({ band: 'medium', entries: ['C',], perEntry: 40, },),
              ...catPool({ band: 'large', entries: ['E',], perEntry: 40, },),
            ];
            const sample = drawStratifiedSample({ candidates: pool, size: 50, seed: 'meow', },);
            /**
             * Sampled count per band.
             */
            const counts: BandQuota = {
              small: sample.filter(function s(c,) { return c.band === 'small'; },).length,
              medium: sample.filter(function m(c,) { return c.band === 'medium'; },).length,
              large: sample.filter(function l(c,) { return c.band === 'large'; },).length,
            };
            expect(counts,).toEqual({ small: 17, medium: 17, large: 16, },);
            expect(sample.length,).toBe(50,);
          },
        },),
        it({
          name: 'spreads across entries before taking a second issue from any one',
          fn: async () => {
            const pool = [
              ...catPool({
                band: 'large',
                entries: ['Heavy', 'Light',],
                perEntry: 1,
              },),
              ...catPool({ band: 'large', entries: ['Heavy',], perEntry: 4, },),
            ];
            const sample = drawStratifiedSample({ candidates: pool, size: 2, seed: 'meow', },);
            /**
             * Distinct entry ids in the two-slot draw.
             */
            const entryIds = new Set(
              sample.map(function toEntry(c,) { return c.entryId; },),
            );
            expect(entryIds.has('Light',),).toBe(true,);
            expect(entryIds.size,).toBe(2,);
          },
        },),
        it({
          name: 'never selects more than the pool holds',
          fn: async () => {
            const pool = catPool({ band: 'small', entries: ['A',], perEntry: 3, },);
            const sample = drawStratifiedSample({ candidates: pool, size: 50, seed: 'meow', },);
            expect(sample.length,).toBe(3,);
          },
        },),
      ],
    },),

    //endregion drawStratifiedSample

    //region formatGradingSheet

    describe({
      name: formatGradingSheet.name,
      children: [
        it({
          name: 'records seed, bar, corpus pin, and per-issue grade boxes',
          fn: async () => {
            const sample = [
              catCandidate({ entryId: 'Kitten', band: 'small', issueId: 'i/1', },),
              catCandidate({ entryId: 'Tabby', band: 'large', issueId: 'i/2', },),
            ];
            const sheet = formatGradingSheet({
              sample,
              seed: 'meow',
              bar: 0.9,
              corpusSha: 'a41fc60',
            },);
            expect(sheet,).toContain('Draw seed: meow',);
            expect(sheet,).toContain('Precision bar: 0.9',);
            expect(sheet,).toContain('Corpus pin: a41fc60',);
            expect(sheet,).toContain('Sample size: 2',);
            expect(sheet,).toContain('entry: Kitten',);
            expect(sheet,).toContain('entry: Tabby',);
            expect(
              sheet.split('grade: [ ]',).length - 1,
            ).toBe(2,);
          },
        },),
      ],
    },),

    //endregion formatGradingSheet
  ],
},);
