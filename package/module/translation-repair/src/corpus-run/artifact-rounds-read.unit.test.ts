/**
 * Tests for reading judged repair rounds back out of a settled artifact.
 *
 * THE REFUSAL IS THE FEATURE, and half these cases pin it. Version 2 hands the
 * lane result back unread, so everything this reader takes it has to check, and
 * a model the roster no longer seats has to be NAMED rather than read as
 * current. A standing that silently mixed two rosters would be worse than one
 * that reported nothing.
 *
 * Content is cat-themed invention. Model ids are not: they come from the
 * catalog, because the whole point of half these cases is which ids the roster
 * holds.
 *
 * @module
 */

import {
  caught,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  ArtifactParseError,
  OffRosterModelError,
  readRepairRounds,
} from '../../dist/final/node/index.mjs';

/**
 * Model the roster seats today, used wherever a case is not about the roster.
 */
const SEATED = 'hf:moonshotai/Kimi-K3';

/**
 * A second seated model, so a slate can carry two producers.
 */
const ALSO_SEATED = 'hf:Qwen/Qwen3.8-27B';

/**
 * Model the roster held until 2026-08-24 and does not now.
 */
const DEPARTED = 'hf:zai-org/GLM-4.7-Flash';

/**
 * Where every case reads from, so a message can be checked against a path.
 */
const PATH = 'Whiskerfold.lanes.repair.result';

/**
 * Builds one ballot, defaulting everything a case does not care about.
 *
 * @param modelId - judge that cast it
 *
 * @param best - candidate it named
 *
 * @param weight - what the ballot counted for
 *
 * @param selfVote - whether the judge named its own writing
 *
 * @returns Ballot as an artifact records one
 *
 * @example
 * ```ts
 * const ballot = ballotOf({ modelId: SEATED, best: 1, },);
 * ```
 */
function ballotOf(
  {
    modelId,
    best,
    weight = 1,
    selfVote = false,
  }: {
    readonly modelId: string;
    readonly best: number;
    readonly weight?: number;
    readonly selfVote?: boolean;
  },
): Record<string, unknown> {
  return {
    modelId,
    best,
    reason: 'the tabby paragraph reads more like a cat and less like a filing',
    weight,
    selfVote,
  };
}

/**
 * Builds one slate position around a producer.
 *
 * @param index - one-based position judges saw
 *
 * @param producer - who wrote it
 *
 * @returns Slate entry as an artifact records one
 *
 * @example
 * ```ts
 * const entry = slateOf({ index: 1, producer: { kind: 'model', modelId: SEATED, }, },);
 * ```
 */
function slateOf(
  {
    index,
    producer,
  }: {
    readonly index: number;
    readonly producer: Record<string, unknown>;
  },
): Record<string, unknown> {
  return {
    index,
    rendered: 'The cat sat, and went on sitting, in the window she had chosen.',
    hash: `sha256-whisker-${String(index,)}`,
    producer,
  };
}

/**
 * Builds what one slate position drew.
 *
 * @param index - one-based position
 *
 * @returns Weight entry as an artifact records one
 *
 * @example
 * ```ts
 * const drawn = drawnOf({ index: 1, },);
 * ```
 */
function drawnOf(
  { index, }: { readonly index: number; },
): Record<string, unknown> {
  return {
    index,
    ballots: 1,
    fullVotes: 1,
    selfVotes: 0,
    weight: 1,
  };
}

/**
 * Builds one round around a slate and its ballots.
 *
 * CARRIES EVERY FIELD THE LANE WRITES, including the ones a standing never
 * reads. The reader validates the whole round, so a fixture carrying only what
 * a standing needs would pin a reader looser than the one that ships.
 *
 * @param slate - candidates judges were shown
 *
 * @param ballots - ballots cast over them
 *
 * @param stage - stage that ran it
 *
 * @returns Round as an artifact records one
 *
 * @example
 * ```ts
 * const round = roundOf({ slate, ballots, },);
 * ```
 */
function roundOf(
  {
    slate,
    ballots,
    stage = 'envelope',
  }: {
    readonly slate: readonly Record<string, unknown>[];
    readonly ballots: readonly Record<string, unknown>[];
    readonly stage?: string;
  },
): Record<string, unknown> {
  return {
    kind: 'selected',
    stage,
    envelopeId: 'chunk',
    slate,
    ballots,
    tally: {
      judgesAvailable: 2,
      ballots: ballots.length,
      abstentions: 0,
      selfVotes: 0,
    },
    perCandidate: slate.map(function drawn(entry, index,): Record<string, unknown> {
      return drawnOf({ index: Number(entry.index ?? (index + 1),), },);
    },),
    selectedIndex: 1,
    voteWeight: 1,
  };
}

/**
 * Builds a round that decided nothing, which records two fields the other
 * outcome does not.
 *
 * @param slate - candidates judges were shown
 *
 * @param ballots - ballots cast over them
 *
 * @returns Declining round as an artifact records one
 *
 * @example
 * ```ts
 * const round = declinedRoundOf({ slate, ballots, },);
 * ```
 */
function declinedRoundOf(
  {
    slate,
    ballots,
  }: {
    readonly slate: readonly Record<string, unknown>[];
    readonly ballots: readonly Record<string, unknown>[];
  },
): Record<string, unknown> {
  /**
   * Selecting round, whose six shared fields this reuses so the two fixtures
   * cannot drift apart on them.
   */
  const selecting = roundOf({
    slate,
    ballots,
  },);

  // NAMED ONE BY ONE rather than spread and blanked, because a declining round
  // records neither `selectedIndex` nor `voteWeight` and a fixture carrying
  // them as blanks would let a reader that ignored `kind` pass.
  return {
    kind: 'declined',
    stage: selecting.stage,
    envelopeId: selecting.envelopeId,
    slate: selecting.slate,
    ballots: selecting.ballots,
    tally: selecting.tally,
    perCandidate: selecting.perCandidate,
    reason: 'judges split evenly across two candidates',
    disposition: 'indecision',
  };
}

/**
 * Wraps rounds into the raw lane result shape the reader takes.
 *
 * @param chunks - rounds per chunk, in chunk order
 *
 * @returns Raw result as an artifact holds one
 *
 * @example
 * ```ts
 * const raw = rawOf({ chunks: [[round,],], },);
 * ```
 */
function rawOf(
  { chunks, }: { readonly chunks: readonly (readonly Record<string, unknown>[])[]; },
): Record<string, unknown> {
  return {
    chunks: chunks.map(function toChunk(rounds, index,): Record<string, unknown> {
      return {
        chunkIndex: index,
        rounds,
      };
    },),
  };
}

/**
 * A round every case can start from, produced by two seated models.
 */
const PLAIN_ROUND = roundOf({
  slate: [
    slateOf({
      index: 1,
      producer: {
        kind: 'model',
        modelId: SEATED,
      },
    },),
    slateOf({
      index: 2,
      producer: {
        kind: 'model',
        modelId: ALSO_SEATED,
      },
    },),
  ],
  ballots: [
    ballotOf({
      modelId: SEATED,
      best: 2,
    },),
    ballotOf({
      modelId: ALSO_SEATED,
      best: 2,
      weight: 0.5,
      selfVote: true,
    },),
  ],
},);

await describe({
  name: readRepairRounds.name,
  children: [
    it({
      name: 'reads a round the lane actually records',
      fn: async () => {
        /**
         * Rounds one chunk produced.
         */
        const perChunk = readRepairRounds({
          raw: rawOf({ chunks: [[PLAIN_ROUND,],], },),
          path: PATH,
        },);

        expect(perChunk.length,).toBe(1,);
        expect(perChunk[0]?.length,).toBe(1,);
        expect(perChunk[0]?.[0]?.stage,).toBe('envelope',);
        expect(perChunk[0]?.[0]?.slate.length,).toBe(2,);
      },
    },),

    it({
      name: 'reads a DECLINING round, keeping what a selecting one has no room for',
      fn: async () => {
        /**
         * A round where judges settled on nothing, which records a reason and a
         * disposition in place of a winner and its weight.
         */
        const perChunk = readRepairRounds({
          raw: rawOf({
            chunks: [[
              declinedRoundOf({
                slate: [
                  slateOf({
                    index: 1,
                    producer: {
                      kind: 'model',
                      modelId: SEATED,
                    },
                  },),
                ],
                ballots: [
                  ballotOf({
                    modelId: ALSO_SEATED,
                    best: 1,
                  },),
                ],
              },),
            ],],
          },),
          path: PATH,
        },);

        /**
         * The round itself, read out so both of its own fields can be asserted.
         */
        const round = perChunk[0]?.[0];

        expect(round?.kind,).toBe('declined',);
        expect(round?.perCandidate.length,).toBe(1,);
        expect((round?.kind === 'declined') ? round.disposition : 'not-declined',)
          .toBe('indecision',);
      },
    },),

    it({
      name: 'REFUSES a round recording nothing about what each position drew',
      fn: async () => {
        /**
         * What the reader threw when `perCandidate` was absent, which is the
         * shape every round on disk carries and a partial reader would ignore.
         */
        const refusal = caught(function readsAPartialRound() {
          /**
           * A well formed round with that one field taken back out.
           */
          const {
            perCandidate,
            ...withoutDraws
          } = roundOf({
            slate: [
              slateOf({
                index: 1,
                producer: {
                  kind: 'model',
                  modelId: SEATED,
                },
              },),
            ],
            ballots: [
              ballotOf({
                modelId: ALSO_SEATED,
                best: 1,
              },),
            ],
          },);

          expect(perCandidate,).toBeDefined();

          readRepairRounds({
            raw: rawOf({ chunks: [[withoutDraws,],], },),
            path: PATH,
          },);
        },);

        expect(refusal,).toBeInstanceOf(ArtifactParseError,);
        expect((refusal as Error).message,)
          .toContain(`${PATH}.chunks[0].rounds[0].perCandidate`,);
      },
    },),

    it({
      name: 'REFUSES a declining round naming a disposition the lane cannot produce',
      fn: async () => {
        /**
         * What the reader threw on a disposition outside the two the selection
         * can reach, which is how a hand-edited or foreign record reads.
         */
        const refusal = caught(function readsAnUnknownDisposition() {
          readRepairRounds({
            raw: rawOf({
              chunks: [[
                {
                  ...declinedRoundOf({
                    slate: [
                      slateOf({
                        index: 1,
                        producer: {
                          kind: 'model',
                          modelId: SEATED,
                        },
                      },),
                    ],
                    ballots: [
                      ballotOf({
                        modelId: ALSO_SEATED,
                        best: 1,
                      },),
                    ],
                  },),
                  disposition: 'adjourned',
                },
              ],],
            },),
            path: PATH,
          },);
        },);

        expect(refusal,).toBeInstanceOf(ArtifactParseError,);
        expect((refusal as Error).message,)
          .toContain(`${PATH}.chunks[0].rounds[0].disposition`,);
      },
    },),

    it({
      name: 'ACCEPTS a half weight and a declining ballot, which no count guard would',
      fn: async () => {
        /**
         * A round whose second ballot is a self-vote and whose first names no
         * candidate at all, both of which a count guard refuses.
         */
        const declining = readRepairRounds({
          raw: rawOf({
            chunks: [[
              roundOf({
                slate: [
                  slateOf({
                    index: 1,
                    producer: {
                      kind: 'model',
                      modelId: SEATED,
                    },
                  },),
                ],
                ballots: [
                  ballotOf({
                    modelId: ALSO_SEATED,
                    best: -1,
                    weight: 0,
                  },),
                  ballotOf({
                    modelId: SEATED,
                    best: 1,
                    weight: 0.5,
                    selfVote: true,
                  },),
                ],
              },),
            ],],
          },),
          path: PATH,
        },);

        expect(declining[0]?.[0]?.ballots[0]?.best,).toBe(-1,);
        expect(declining[0]?.[0]?.ballots[1]?.weight,).toBe(0.5,);
      },
    },),

    it({
      name: 'keeps a chunk that judged nothing as its own empty list',
      fn: async () => {
        /**
         * Two chunks, only the second of which asked anyone to write.
         */
        const perChunk = readRepairRounds({
          raw: rawOf({
            chunks: [
              [],
              [PLAIN_ROUND,],
            ],
          },),
          path: PATH,
        },);

        expect(perChunk.length,).toBe(2,);
        expect(perChunk[0]?.length,).toBe(0,);
        expect(perChunk[1]?.length,).toBe(1,);
      },
    },),

    it({
      name: 'reads a composite producer and an incumbent, not only a lone model',
      fn: async () => {
        /**
         * A slate carrying all three provenance shapes at once.
         */
        const perChunk = readRepairRounds({
          raw: rawOf({
            chunks: [[
              roundOf({
                slate: [
                  slateOf({
                    index: 1,
                    producer: {
                      kind: 'composite',
                      contributors: [
                        SEATED,
                        ALSO_SEATED,
                      ],
                    },
                  },),
                  slateOf({
                    index: 2,
                    producer: {
                      kind: 'incumbent',
                      matched: [],
                    },
                  },),
                ],
                ballots: [
                  ballotOf({
                    modelId: SEATED,
                    best: 1,
                  },),
                ],
              },),
            ],],
          },),
          path: PATH,
        },);

        expect(perChunk[0]?.[0]?.slate[0]?.producer.kind,).toBe('composite',);
        expect(perChunk[0]?.[0]?.slate[1]?.producer.kind,).toBe('incumbent',);
      },
    },),

    it({
      name: 'REFUSES a candidate written by a model the roster no longer seats',
      fn: async () => {
        expect(function read() {
          readRepairRounds({
            raw: rawOf({
              chunks: [[
                roundOf({
                  slate: [
                    slateOf({
                      index: 1,
                      producer: {
                        kind: 'model',
                        modelId: DEPARTED,
                      },
                    },),
                  ],
                  ballots: [
                    ballotOf({
                      modelId: SEATED,
                      best: 1,
                    },),
                  ],
                },),
              ],],
            },),
            path: PATH,
          },);
        },).toThrow(OffRosterModelError,);
      },
    },),

    it({
      name: 'REFUSES a departed model inside a composite, where a slate check alone would miss it',
      fn: async () => {
        expect(function read() {
          readRepairRounds({
            raw: rawOf({
              chunks: [[
                roundOf({
                  slate: [
                    slateOf({
                      index: 1,
                      producer: {
                        kind: 'composite',
                        contributors: [
                          SEATED,
                          DEPARTED,
                        ],
                      },
                    },),
                  ],
                  ballots: [
                    ballotOf({
                      modelId: SEATED,
                      best: 1,
                    },),
                  ],
                },),
              ],],
            },),
            path: PATH,
          },);
        },).toThrow(OffRosterModelError,);
      },
    },),

    it({
      name: 'REFUSES a departed model that only ever judged, having written nothing',
      fn: async () => {
        expect(function read() {
          readRepairRounds({
            raw: rawOf({
              chunks: [[
                roundOf({
                  slate: [
                    slateOf({
                      index: 1,
                      producer: {
                        kind: 'model',
                        modelId: SEATED,
                      },
                    },),
                  ],
                  ballots: [
                    ballotOf({
                      modelId: DEPARTED,
                      best: 1,
                    },),
                  ],
                },),
              ],],
            },),
            path: PATH,
          },);
        },).toThrow(OffRosterModelError,);
      },
    },),

    it({
      name: 'REFUSES a result carrying no chunks at all, rather than reading it as none',
      fn: async () => {
        expect(function read() {
          readRepairRounds({
            raw: { repairedText: 'The cat, having sat, declined to comment.', },
            path: PATH,
          },);
        },).toThrow(ArtifactParseError,);
      },
    },),

    it({
      name: 'REFUSES a stage the lane cannot have run',
      fn: async () => {
        expect(function read() {
          readRepairRounds({
            raw: rawOf({
              chunks: [[
                roundOf({
                  slate: [
                    slateOf({
                      index: 1,
                      producer: {
                        kind: 'model',
                        modelId: SEATED,
                      },
                    },),
                  ],
                  ballots: [
                    ballotOf({
                      modelId: SEATED,
                      best: 1,
                    },),
                  ],
                  stage: 'napping',
                },),
              ],],
            },),
            path: PATH,
          },);
        },).toThrow(ArtifactParseError,);
      },
    },),

    it({
      name: 'REFUSES a ballot whose weight is not a number, since a share divides by it',
      fn: async () => {
        expect(function read() {
          readRepairRounds({
            raw: rawOf({
              chunks: [[
                roundOf({
                  slate: [
                    slateOf({
                      index: 1,
                      producer: {
                        kind: 'model',
                        modelId: SEATED,
                      },
                    },),
                  ],
                  ballots: [
                    {
                      ...ballotOf({
                        modelId: SEATED,
                        best: 1,
                      },),
                      weight: 'a lot',
                    },
                  ],
                },),
              ],],
            },),
            path: PATH,
          },);
        },).toThrow(ArtifactParseError,);
      },
    },),

    it({
      name: 'names the exact path a departed model was read at',
      fn: async () => {
        /**
         * What the reader threw, held so both the class and the path it names
         * can be asserted separately.
         */
        const refusal = caught(function readsAnEarlierRoster() {
          readRepairRounds({
            raw: rawOf({
              chunks: [
                [],
                [
                  roundOf({
                    slate: [
                      slateOf({
                        index: 1,
                        producer: {
                          kind: 'model',
                          modelId: DEPARTED,
                        },
                      },),
                    ],
                    ballots: [
                      ballotOf({
                        modelId: SEATED,
                        best: 1,
                      },),
                    ],
                  },),
                ],
              ],
            },),
            path: PATH,
          },);
        },);

        expect(refusal,).toBeInstanceOf(OffRosterModelError,);
        expect((refusal as Error).message,)
          .toContain(`${PATH}.chunks[1].rounds[0].slate[0].producer.modelId`,);
        expect((refusal as Error).message,).toContain(DEPARTED,);
      },
    },),
  ],
},);
