/**
 * Tests for who wrote the text a checker stage is about to judge, read off the
 * producer the editor stage recorded.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  appliedIssuesByEnvelope,
  collectIssueAuthors,
  type EditableEnvelope,
  type EditorStageResult,
  type PatchOperation,
  type RepairJudgedRound,
  NOBODY_WROTE_IT,
  type RepairSlateEntry,
  type ShippedProducer,
  type RosterModelId,
} from '../dist/final/node/index.mjs';

/**
 * Issue the first envelope serves.
 */
const WHISKER = 'adjudicated/whisker';

/**
 * Issue the second envelope serves.
 */
const PAW = 'adjudicated/paw';

/**
 * Model that wrote the text that ships unless a case says otherwise.
 */
const AUTHOR: RosterModelId = 'hf:zai-org/GLM-5.3-Flash';

/**
 * Second model, for rivals and for candidates that lose.
 */
const HELPER: RosterModelId = 'hf:Qwen/Qwen3.8-27B';

/**
 * Builds an editable envelope carrying the issues it serves.
 */
function envelopeOf(
  {
    envelopeId,
    issueIds,
  }: {
    readonly envelopeId: string;
    readonly issueIds: readonly string[];
  },
): EditableEnvelope {
  return {
    envelopeId,
    startOffset: 0,
    endOffset: 1,
    baseText: 'the cat naps',
    baseHash: `hash-${envelopeId}`,
    issueIds,
  };
}

/**
 * Builds an applied patch operation against one envelope.
 */
function operationOf(envelopeId: string,): PatchOperation {
  return {
    envelopeId,
    baseHash: `hash-${envelopeId}`,
    newText: 'the cat dozes',
  };
}

/**
 * Builds one slate entry, whose `index` is the ONE-BASED number judges saw and
 * need not match its position in the array.
 */
function slateEntryOf(
  {
    index,
    modelId,
  }: {
    readonly index: number;
    readonly modelId: RosterModelId;
  },
): RepairSlateEntry {
  return {
    index,
    rendered: `candidate ${String(index,)}`,
    hash: `slate-${String(index,)}`,
    producer: {
      kind: 'model',
      modelId,
    },
  };
}

/**
 * Builds an envelope round that picked the candidate carrying `selectedIndex`.
 */
function selectedRound(
  {
    envelopeId,
    slate,
    selectedIndex,
  }: {
    readonly envelopeId: string;
    readonly slate: readonly RepairSlateEntry[];
    readonly selectedIndex: number;
  },
): RepairJudgedRound {
  return {
    kind: 'selected',
    stage: 'envelope',
    envelopeId,
    slate,
    ballots: [],
    tally: {
      judgesAvailable: 3,
      ballots: 3,
      abstentions: 0,
      selfVotes: 0,
    },
    perCandidate: [],
    selectedIndex,
    voteWeight: 2,
  };
}

/**
 * Builds the record of an envelope whose sole proposal was adopted without a
 * vote.
 *
 * @param envelopeId - envelope adopted
 *
 * @param slate - its one entry
 *
 * @returns Adopted round
 *
 * @example
 * ```ts
 * const round = adoptedRound({ envelopeId: 'kept', slate: [entry,], },);
 * ```
 */
function adoptedRound(
  {
    envelopeId,
    slate,
  }: {
    readonly envelopeId: string;
    readonly slate: readonly RepairSlateEntry[];
  },
): RepairJudgedRound {
  return {
    kind: 'adopted',
    stage: 'envelope',
    envelopeId,
    slate,
    ballots: [],
    tally: {
      judgesAvailable: 0,
      ballots: 0,
      abstentions: 0,
      selfVotes: 0,
    },
    perCandidate: [],
    selectedIndex: 1,
    reason: 'sole proposal, adopted without a vote',
  };
}

/**
 * Builds the whole-chunk round as it looks when judges could not rank anything,
 * which is the round that records ballots and names no winner.
 */
function declinedChunkRound(slate: readonly RepairSlateEntry[],): RepairJudgedRound {
  return {
    kind: 'declined',
    stage: 'chunk-patch',
    envelopeId: 'chunk',
    slate,
    ballots: [],
    tally: {
      judgesAvailable: 3,
      ballots: 3,
      abstentions: 3,
      selfVotes: 0,
    },
    perCandidate: [],
    reason: 'no candidate drew quorum',
    disposition: 'indecision',
  };
}

/**
 * Builds the editor stage result the authorship read takes.
 */
function editorOf(
  {
    rounds,
    applied,
    shippedProducer,
  }: {
    readonly rounds: readonly RepairJudgedRound[];
    readonly applied: readonly PatchOperation[];
    readonly shippedProducer: ShippedProducer;
  },
): EditorStageResult {
  return {
    patch: {
      patchedText: 'the cat dozes',
      applied,
      rejected: [],
    },
    heardEditors: 3,
    rounds,
    findings: [],
    shippedProducer,
  };
}

/**
 * The one envelope every case below repairs, and the issue it serves.
 */
const KEPT = [
  envelopeOf({
    envelopeId: 'kept',
    issueIds: [WHISKER,],
  },),
];

await describe({
  name: appliedIssuesByEnvelope.name,
  children: [
    it({
      name: 'NAMES ONLY THE ENVELOPES WHOSE OPERATION SURVIVED THE GATE, so an envelope the gate '
        + 'refused puts no text into the candidate and the issues it named keep whole votes',
      fn: async function rejectedEnvelopesAreAbsent() {
        expect(appliedIssuesByEnvelope({
          envelopes: [
            envelopeOf({
              envelopeId: 'kept',
              issueIds: [WHISKER,],
            },),
            envelopeOf({
              envelopeId: 'refused',
              issueIds: [PAW,],
            },),
          ],
          applied: [operationOf('kept',),],
        },),).toEqual({ kept: [WHISKER,], },);
      },
    },),

    it({
      name: 'SKIPS an operation naming an envelope the slate no longer carries, rather than '
        + 'refusing: an unknown envelope contributes no authorship, which is the safe direction',
      fn: async function unknownEnvelopesAreSkipped() {
        expect(appliedIssuesByEnvelope({
          envelopes: [],
          applied: [operationOf('vanished',),],
        },),).toEqual({},);
      },
    },),
  ],
},);

await describe({
  name: collectIssueAuthors.name,
  children: [
    it({
      name: 'NAMES THE MODEL THAT WROTE THE WHOLE SHIPPED CHUNK for every issue, because one '
        + 'model wrote all of it and every creditable issue sits in text it produced',
      fn: async function aLoneWinnerAnswersForEveryIssue() {
        expect(collectIssueAuthors({
          editor: editorOf({
            applied: [operationOf('kept',),],
            rounds: [],
            shippedProducer: {
              kind: 'model',
              modelId: AUTHOR,
            },
          },),
          envelopes: KEPT,
        },),).toEqual({
          perIssue: {},
          everyIssue: [AUTHOR,],
        },);
      },
    },),

    it({
      name: 'NAMES THE EDITOR WHOSE REPAIR SHIPS AFTER THE JUDGES DECLINED TO RANK ANYTHING. This '
        + 'is the case a reader of the rounds cannot answer: the round records ballots and no '
        + 'winner, yet a real editor wrote the text, and leaving it unnamed lets that editor '
        + 'certify its own work at full weight',
      fn: async function theIndecisionFallbackHasAnAuthor() {
        expect(collectIssueAuthors({
          editor: editorOf({
            applied: [operationOf('kept',),],
            rounds: [
              declinedChunkRound([
                slateEntryOf({
                  index: 1,
                  modelId: AUTHOR,
                },),
                slateEntryOf({
                  index: 2,
                  modelId: HELPER,
                },),
              ],),
            ],
            shippedProducer: {
              kind: 'model',
              modelId: AUTHOR,
            },
          },),
          envelopes: KEPT,
        },),).toEqual({
          perIssue: {},
          everyIssue: [AUTHOR,],
        },);
      },
    },),

    it({
      name: 'IGNORES AN ENVELOPE WINNER WHOSE TEXT LOST TO A RIVAL WHOLE-CHUNK PROPOSAL, because '
        + 'the composite it was assembled into never shipped, so it is judging someone else\'s '
        + 'text and keeps a whole vote',
      fn: async function envelopeWinnersThatLostAreNotAuthors() {
        expect(collectIssueAuthors({
          editor: editorOf({
            applied: [operationOf('kept',),],
            rounds: [
              selectedRound({
                envelopeId: 'kept',
                slate: [
                  slateEntryOf({
                    index: 1,
                    modelId: HELPER,
                  },),
                ],
                selectedIndex: 1,
              },),
            ],
            shippedProducer: {
              kind: 'model',
              modelId: AUTHOR,
            },
          },),
          envelopes: KEPT,
        },),).toEqual({
          perIssue: {},
          everyIssue: [AUTHOR,],
        },);
      },
    },),

    it({
      name: 'NAMES THE AUTHOR OF AN ENVELOPE ADOPTED WITHOUT A VOTE, so a checker who wrote that '
        + 'text is discounted on it like any other winner (`#239`)',
      fn: async function adoptedEnvelopesKeepTheirAuthors() {
        expect(collectIssueAuthors({
          editor: editorOf({
            applied: [operationOf('kept',),],
            rounds: [
              adoptedRound({
                envelopeId: 'kept',
                slate: [
                  slateEntryOf({
                    index: 1,
                    modelId: HELPER,
                  },),
                ],
              },),
            ],
            shippedProducer: {
              kind: 'composite',
              contributors: [HELPER,],
            },
          },),
          envelopes: KEPT,
        },),).toEqual({
          perIssue: { [WHISKER]: [HELPER,], },
          everyIssue: [],
        },);
      },
    },),
    it({
      name: 'NAMES NOBODY WHEN THE UNTOUCHED TRANSLATION SHIPS, since no model wrote it and no '
        + 'checker can be certifying its own work',
      fn: async function nothingShippedMeansNoAuthors() {
        expect(collectIssueAuthors({
          editor: editorOf({
            applied: [],
            rounds: [],
            shippedProducer: NOBODY_WROTE_IT,
          },),
          envelopes: KEPT,
        },),).toEqual({
          perIssue: {},
          everyIssue: [],
        },);
      },
    },),
  ],
},);
