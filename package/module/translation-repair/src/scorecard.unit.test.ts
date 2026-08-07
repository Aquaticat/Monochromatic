/**
 * Tests for the benchmark aggregation.
 *
 * `computeScorecard` produces `ensembleRecall`, which the handover calls the
 * milestone go/no-go number. It had no test. Everything here is pure
 * arithmetic over records, which is exactly the kind of code that looks
 * obviously right and quietly divides by the wrong denominator.
 *
 * The cases concentrate on the two denominators that are easy to get wrong:
 * skipped records, which must back the skipped count and nothing else, and the
 * entry-scoped seed keys, which decide whether one seed found by three models
 * counts once or three times.
 *
 * Fixtures are cat-themed invention.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type CriticAttemptRecord,
  computeScorecard,
} from '../dist/final/node/index.mjs';

/**
 * One model of the roster, used wherever a row's identity does not matter.
 */
const MODEL_A = 'hf:zai-org/GLM-5.2';

/**
 * Second model, for ensemble cases where two models see the same entry.
 */
const MODEL_B = 'hf:moonshotai/Kimi-K3';

/**
 * Builds a graded attempt, defaulting everything a case does not care about.
 *
 * @param modelId - model that made the attempt
 *
 * @param entryId - corpus entry reviewed
 *
 * @param outcomeKind - how the exchange ended
 *
 * @param resolvedClaimCount - claims that survived validation
 *
 * @param unresolvedReasons - resolution failure reasons
 *
 * @param seededHitIds - seeds this attempt detected
 *
 * @param plantedSeedIds - seeds planted for this entry
 *
 * @returns Attempt record
 *
 * @example
 * ```ts
 * const record = attempt({
 *   modelId: MODEL_A,
 *   entryId: 'whiskers',
 *   outcomeKind: 'ok',
 *   resolvedClaimCount: 2,
 *   unresolvedReasons: [],
 *   seededHitIds: ['seed/0',],
 *   plantedSeedIds: ['seed/0', 'seed/1',],
 * },);
 * ```
 */
function attempt(
  {
    modelId,
    entryId,
    outcomeKind,
    resolvedClaimCount,
    unresolvedReasons,
    seededHitIds,
    plantedSeedIds,
  }: {
    readonly modelId: string;
    readonly entryId: string;
    readonly outcomeKind: string;
    readonly resolvedClaimCount: number;
    readonly unresolvedReasons: readonly string[];
    readonly seededHitIds: readonly string[];
    readonly plantedSeedIds: readonly string[];
  },
): CriticAttemptRecord {
  return {
    modelId,
    entryId,
    outcomeKind,
    detail: '',
    resolvedClaimCount,
    unresolvedReasons,
    seededHitIds,
    plantedSeedIds,
  } as CriticAttemptRecord;
}

await describe({
  name: computeScorecard.name,
  children: [
    it({
      name: 'returns zeros for an empty run rather than dividing by nothing, '
        + 'so a run that dispatched no attempts reports no recall instead of '
        + 'NaN, which would render as a number and pass a threshold check',
      fn: async () => {
        /**
         * Scorecard over no attempts at all.
         */
        const scorecard = computeScorecard({ attempts: [], },);

        expect(scorecard.rows,).toStrictEqual([],);
        expect(scorecard.seedUniverse,).toBe(0,);
        expect(scorecard.ensembleRecall,).toBe(0,);
        expect(scorecard.coverage,).toBe(0,);
      },
    },),

    it({
      name: 'divides every rate by DISPATCHED attempts, so a skipped record '
        + 'backs the skipped count and nothing else: a time-boxed run whose '
        + 'budget cut half the roster must not read as a run where half the '
        + 'models failed',
      fn: async () => {
        /**
         * One clean attempt plus one the budget never dispatched.
         */
        const scorecard = computeScorecard({
          attempts: [
            attempt({
              modelId: MODEL_A,
              entryId: 'whiskers',
              outcomeKind: 'ok',
              resolvedClaimCount: 4,
              unresolvedReasons: [],
              seededHitIds: ['seed/0',],
              plantedSeedIds: ['seed/0',],
            },),
            attempt({
              modelId: MODEL_A,
              entryId: 'mittens',
              outcomeKind: 'skipped',
              resolvedClaimCount: 0,
              unresolvedReasons: [],
              seededHitIds: [],
              plantedSeedIds: ['seed/9',],
            },),
          ],
        },);

        /**
         * The single row for the only model.
         */
        const [row,] = scorecard.rows;

        expect(row?.attempts,).toBe(1,);
        expect(row?.skipped,).toBe(1,);
        expect(row?.schemaOkRate,).toBe(1,);
        expect(row?.resolvedClaimsPerAttempt,).toBe(4,);
        expect(row?.seededRecall,).toBe(1,);
        // Coverage is the one number that DOES see the skipped record.
        expect(scorecard.coverage,).toBe(1 / 2,);
      },
    },),

    it({
      name: 'keeps a never-dispatched record OUT of the seed universe, since '
        + 'its seeds were never shown to any model: counting them would make '
        + 'the budget running out look like the ensemble missing seeds',
      fn: async () => {
        /**
         * One dispatched entry and one skipped entry, each with its own seed.
         */
        const scorecard = computeScorecard({
          attempts: [
            attempt({
              modelId: MODEL_A,
              entryId: 'whiskers',
              outcomeKind: 'ok',
              resolvedClaimCount: 1,
              unresolvedReasons: [],
              seededHitIds: ['seed/0',],
              plantedSeedIds: ['seed/0',],
            },),
            attempt({
              modelId: MODEL_A,
              entryId: 'mittens',
              outcomeKind: 'skipped',
              resolvedClaimCount: 0,
              unresolvedReasons: [],
              seededHitIds: [],
              plantedSeedIds: ['seed/0',],
            },),
          ],
        },);

        expect(scorecard.seedUniverse,).toBe(1,);
        expect(scorecard.ensembleRecall,).toBe(1,);
      },
    },),

    it({
      name: 'survives a bucket where EVERY record was skipped, reporting zero '
        + 'rates instead of dividing by zero attempts',
      fn: async () => {
        /**
         * Scorecard where the only model never got dispatched at all.
         */
        const scorecard = computeScorecard({
          attempts: [
            attempt({
              modelId: MODEL_A,
              entryId: 'whiskers',
              outcomeKind: 'skipped',
              resolvedClaimCount: 0,
              unresolvedReasons: [],
              seededHitIds: [],
              plantedSeedIds: ['seed/0',],
            },),
          ],
        },);

        /**
         * The fully-skipped model's row.
         */
        const [row,] = scorecard.rows;

        expect(row?.attempts,).toBe(0,);
        expect(row?.skipped,).toBe(1,);
        expect(row?.schemaOkRate,).toBe(0,);
        expect(row?.refusalRate,).toBe(0,);
        expect(row?.seededRecall,).toBe(0,);
        expect(Number.isNaN(row?.resolvedClaimsPerAttempt ?? Number.NaN,),).toBe(false,);
        expect(scorecard.coverage,).toBe(0,);
      },
    },),

    it({
      name: 'counts a refusal and a failure AGAINST recall rather than '
        + 'excluding them, because a model that refused still did not find the '
        + 'seed and effective recall is what the milestone reads',
      fn: async () => {
        /**
         * One refusal and one schema mismatch, each on a seeded entry.
         */
        const scorecard = computeScorecard({
          attempts: [
            attempt({
              modelId: MODEL_A,
              entryId: 'whiskers',
              outcomeKind: 'refusal-shaped',
              resolvedClaimCount: 0,
              unresolvedReasons: [],
              seededHitIds: [],
              plantedSeedIds: ['seed/0',],
            },),
            attempt({
              modelId: MODEL_A,
              entryId: 'mittens',
              outcomeKind: 'schema-mismatch',
              resolvedClaimCount: 0,
              unresolvedReasons: [],
              seededHitIds: [],
              plantedSeedIds: ['seed/1',],
            },),
          ],
        },);

        /**
         * The row for the failing model.
         */
        const [row,] = scorecard.rows;

        expect(row?.attempts,).toBe(2,);
        expect(row?.schemaOkRate,).toBe(0,);
        expect(row?.refusalRate,).toBe(1 / 2,);
        expect(row?.seededRecall,).toBe(0,);
        expect(scorecard.coverage,).toBe(1,);
      },
    },),

    it({
      name: 'DEDUPES ensemble hits by entry and seed, so one seed found by two '
        + 'models counts once: the ensemble ceiling asks how many seeds anyone '
        + 'found, not how many findings happened',
      fn: async () => {
        /**
         * Both models finding the same single planted seed.
         */
        const scorecard = computeScorecard({
          attempts: [
            attempt({
              modelId: MODEL_A,
              entryId: 'whiskers',
              outcomeKind: 'ok',
              resolvedClaimCount: 1,
              unresolvedReasons: [],
              seededHitIds: ['seed/0',],
              plantedSeedIds: ['seed/0',],
            },),
            attempt({
              modelId: MODEL_B,
              entryId: 'whiskers',
              outcomeKind: 'ok',
              resolvedClaimCount: 1,
              unresolvedReasons: [],
              seededHitIds: ['seed/0',],
              plantedSeedIds: ['seed/0',],
            },),
          ],
        },);

        expect(scorecard.seedUniverse,).toBe(1,);
        expect(scorecard.ensembleRecall,).toBe(1,);
      },
    },),

    it({
      name: 'SCOPES seed keys to their entry, so the same seed id planted in '
        + 'two entries is two seeds: without the entry prefix a benchmark '
        + 'whose generator numbers seeds from zero per entry would collapse '
        + 'its whole universe to one seed per index',
      fn: async () => {
        /**
         * Two entries each planting `seed/0`, only one of which was found.
         */
        const scorecard = computeScorecard({
          attempts: [
            attempt({
              modelId: MODEL_A,
              entryId: 'whiskers',
              outcomeKind: 'ok',
              resolvedClaimCount: 1,
              unresolvedReasons: [],
              seededHitIds: ['seed/0',],
              plantedSeedIds: ['seed/0',],
            },),
            attempt({
              modelId: MODEL_A,
              entryId: 'mittens',
              outcomeKind: 'ok',
              resolvedClaimCount: 0,
              unresolvedReasons: [],
              seededHitIds: [],
              plantedSeedIds: ['seed/0',],
            },),
          ],
        },);

        expect(scorecard.seedUniverse,).toBe(2,);
        expect(scorecard.ensembleRecall,).toBe(1 / 2,);
      },
    },),

    it({
      name: 'keeps rows in FIRST-ATTEMPT order, so a report reads in the order '
        + 'the roster was dispatched rather than in map-insertion accident',
      fn: async () => {
        /**
         * Model B seen first, then A, then B again.
         */
        const scorecard = computeScorecard({
          attempts: [
            attempt({
              modelId: MODEL_B,
              entryId: 'whiskers',
              outcomeKind: 'ok',
              resolvedClaimCount: 0,
              unresolvedReasons: [],
              seededHitIds: [],
              plantedSeedIds: [],
            },),
            attempt({
              modelId: MODEL_A,
              entryId: 'whiskers',
              outcomeKind: 'ok',
              resolvedClaimCount: 0,
              unresolvedReasons: [],
              seededHitIds: [],
              plantedSeedIds: [],
            },),
            attempt({
              modelId: MODEL_B,
              entryId: 'mittens',
              outcomeKind: 'ok',
              resolvedClaimCount: 0,
              unresolvedReasons: [],
              seededHitIds: [],
              plantedSeedIds: [],
            },),
          ],
        },);

        expect(scorecard.rows.map(function toId(row,) {
          return row.modelId;
        },),).toStrictEqual([
          MODEL_B,
          MODEL_A,
        ],);
        expect(scorecard.rows[0]?.attempts,).toBe(2,);
      },
    },),

    it({
      name: 'averages claims and unresolved reasons over dispatched attempts, '
        + 'which is what makes a high unresolved figure readable as sloppy '
        + 'quoting rather than as a busy run',
      fn: async () => {
        /**
         * Two attempts with differing claim and failure counts.
         */
        const scorecard = computeScorecard({
          attempts: [
            attempt({
              modelId: MODEL_A,
              entryId: 'whiskers',
              outcomeKind: 'ok',
              resolvedClaimCount: 3,
              unresolvedReasons: [
                'ambiguous-quote (target)',
                'absent-quote (source)',
              ],
              seededHitIds: [],
              plantedSeedIds: [],
            },),
            attempt({
              modelId: MODEL_A,
              entryId: 'mittens',
              outcomeKind: 'ok',
              resolvedClaimCount: 1,
              unresolvedReasons: [],
              seededHitIds: [],
              plantedSeedIds: [],
            },),
          ],
        },);

        /**
         * The averaged row.
         */
        const [row,] = scorecard.rows;

        expect(row?.resolvedClaimsPerAttempt,).toBe(2,);
        expect(row?.unresolvedPerAttempt,).toBe(1,);
        // No seeds planted anywhere, so recall is zero rather than NaN.
        expect(row?.seededRecall,).toBe(0,);
        expect(scorecard.ensembleRecall,).toBe(0,);
      },
    },),

    it({
      name: 'never reports a ceiling above one for well-formed records, across '
        + 'partial, total, and duplicated detection. UNENFORCED PRECONDITION: '
        + 'ensemble hits are never intersected with the universe, so a record '
        + 'crediting a seed nobody planted would push the ceiling past one. '
        + 'That cannot happen today because prepare-entry.ts derives '
        + 'plantedSeedIds from the applications list and gradeHits filters that '
        + 'SAME list, making hits a subset by construction. The invariant lives '
        + 'in those two places, not here; if either stops deriving from the '
        + 'applications list, this function has no guard and the milestone '
        + 'go/no-go number silently exceeds its own maximum',
      fn: async () => {
        for (const [
          seededHitIds,
          plantedSeedIds,
        ] of [
          [
            [],
            [
              'seed/0',
              'seed/1',
            ],
          ],
          [
            ['seed/0',],
            [
              'seed/0',
              'seed/1',
            ],
          ],
          [
            [
              'seed/0',
              'seed/1',
            ],
            [
              'seed/0',
              'seed/1',
            ],
          ],
        ] as const) {
          /**
           * Scorecard for one well-formed record of this shape.
           */
          const scorecard = computeScorecard({
            attempts: [
              attempt({
                modelId: MODEL_A,
                entryId: 'whiskers',
                outcomeKind: 'ok',
                resolvedClaimCount: seededHitIds.length,
                unresolvedReasons: [],
                seededHitIds,
                plantedSeedIds,
              },),
            ],
          },);

          expect(scorecard.ensembleRecall,).toBeLessThanOrEqual(1,);
          expect(scorecard.rows[0]?.seededRecall,).toBeLessThanOrEqual(1,);
        }
      },
    },),

    it({
      name: 'measures per-model recall by OCCURRENCE and ensemble recall by '
        + 'DISTINCT entry-scoped seed, which are different questions: a model '
        + 'that reviewed one entry twice has that entry\'s seeds counted twice '
        + 'in its own row and once in the universe. Neither is wrong, but the '
        + 'two numbers are not comparable, and reading a row\'s recall as a '
        + 'share of the ensemble ceiling would be',
      fn: async () => {
        /**
         * One model reviewing the SAME entry twice, finding the seed once.
         */
        const scorecard = computeScorecard({
          attempts: [
            attempt({
              modelId: MODEL_A,
              entryId: 'whiskers',
              outcomeKind: 'ok',
              resolvedClaimCount: 1,
              unresolvedReasons: [],
              seededHitIds: ['seed/0',],
              plantedSeedIds: ['seed/0',],
            },),
            attempt({
              modelId: MODEL_A,
              entryId: 'whiskers',
              outcomeKind: 'ok',
              resolvedClaimCount: 0,
              unresolvedReasons: [],
              seededHitIds: [],
              plantedSeedIds: ['seed/0',],
            },),
          ],
        },);

        // Two records, so the row's denominator is two planted occurrences.
        expect(scorecard.rows[0]?.seededRecall,).toBe(1 / 2,);
        // One distinct entry-scoped seed, found, so the ceiling is whole.
        expect(scorecard.seedUniverse,).toBe(1,);
        expect(scorecard.ensembleRecall,).toBe(1,);
      },
    },),
  ],
},);
