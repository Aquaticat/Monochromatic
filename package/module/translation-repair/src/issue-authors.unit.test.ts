/**
 * Tests for reading authorship off judged rounds: who wrote the text a checker
 * stage is about to judge.
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
  collectRefinedAuthors,
  type EditableEnvelope,
  type EditorStageResult,
  type PatchOperation,
  type RepairJudgedRound,
  type RepairSlateEntry,
  type SyntheticModelId,
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
 * Model that wins the rounds below unless a case says otherwise.
 */
const AUTHOR: SyntheticModelId = 'hf:zai-org/GLM-5.2';

/**
 * Second model, for composites and for losing candidates.
 */
const HELPER: SyntheticModelId = 'hf:Qwen/Qwen3.8-27B';

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
    readonly modelId: SyntheticModelId;
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
 * Builds a round that picked the candidate carrying `selectedIndex`.
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
 * Builds the editor stage result the authorship read takes.
 */
function editorOf(
  {
    rounds,
    applied,
  }: {
    readonly rounds: readonly RepairJudgedRound[];
    readonly applied: readonly PatchOperation[];
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
  };
}

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
      name: 'JOINS THE WINNER BY THE NUMBER JUDGES WERE SHOWN, NOT BY ARRAY POSITION. Numbers are '
        + 'ONE-BASED, so the winner numbered 1 sits at position 0 and indexing the array by '
        + 'selectedIndex silently names the LOSER instead. This is the shape that discriminates: '
        + 'it fails with a wrong answer rather than with a throw',
      fn: async function oneBasedNumbersAreNotArrayPositions() {
        expect(collectIssueAuthors({
          editor: editorOf({
            applied: [operationOf('kept',),],
            rounds: [
              selectedRound({
                envelopeId: 'kept',
                slate: [
                  slateEntryOf({
                    index: 1,
                    modelId: AUTHOR,
                  },),
                  slateEntryOf({
                    index: 2,
                    modelId: HELPER,
                  },),
                ],
                selectedIndex: 1,
              },),
            ],
          },),
          envelopes: [
            envelopeOf({
              envelopeId: 'kept',
              issueIds: [WHISKER,],
            },),
          ],
        },),).toEqual({
          perIssue: { [WHISKER]: [AUTHOR,], },
          everyIssue: [],
        },);
      },
    },),

    it({
      name: 'NAMES NOBODY FOR A DECLINED ROUND, since a panel that ranked nothing put no model text '
        + 'into the candidate through it',
      fn: async function declinedRoundsAuthorNothing() {
        expect(collectIssueAuthors({
          editor: editorOf({
            applied: [operationOf('kept',),],
            rounds: [
              {
                kind: 'declined',
                stage: 'envelope',
                envelopeId: 'kept',
                slate: [
                  slateEntryOf({
                    index: 1,
                    modelId: AUTHOR,
                  },),
                ],
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
              },
            ],
          },),
          envelopes: [
            envelopeOf({
              envelopeId: 'kept',
              issueIds: [WHISKER,],
            },),
          ],
        },),).toEqual({
          perIssue: {},
          everyIssue: [],
        },);
      },
    },),

    it({
      name: 'NAMES EVERY CONTRIBUTOR TO A COMPOSITE WINNER, because each of them has a stake in the '
        + 'text that composite put in',
      fn: async function compositesNameEveryContributor() {
        expect(collectIssueAuthors({
          editor: editorOf({
            applied: [operationOf('kept',),],
            rounds: [
              selectedRound({
                envelopeId: 'kept',
                slate: [
                  {
                    index: 1,
                    rendered: 'assembled',
                    hash: 'slate-1',
                    producer: {
                      kind: 'composite',
                      contributors: [
                        AUTHOR,
                        HELPER,
                      ],
                    },
                  },
                ],
                selectedIndex: 1,
              },),
            ],
          },),
          envelopes: [
            envelopeOf({
              envelopeId: 'kept',
              issueIds: [WHISKER,],
            },),
          ],
        },),).toEqual({
          perIssue: {
            [WHISKER]: [
              AUTHOR,
              HELPER,
            ],
          },
          everyIssue: [],
        },);
      },
    },),
  ],
},);
