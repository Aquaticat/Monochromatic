/**
 * Tests for how far one round's win reaches: onto the issues its envelope
 * served, or onto every issue in the chunk.
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
  name: collectIssueAuthors.name,
  children: [
    it({
      name: 'NAMES A CHUNK-WIDE WINNER SEPARATELY, because a round that decided the whole chunk '
        + 'answers for issues it was never told about and no envelope map can carry that',
      fn: async function chunkScopeLandsInEveryIssue() {
        expect(collectIssueAuthors({
          editor: editorOf({
            applied: [],
            rounds: [
              selectedRound({
                envelopeId: 'chunk',
                slate: [
                  slateEntryOf({
                    index: 1,
                    modelId: AUTHOR,
                  },),
                ],
                selectedIndex: 1,
              },),
            ],
          },),
          envelopes: [],
        },),).toEqual({
          perIssue: {},
          everyIssue: [AUTHOR,],
        },);
      },
    },),

    it({
      name: 'MERGES THE AUTHORS OF TWO ENVELOPES SERVING ONE ISSUE, so neither writer of that issue '
        + 'text keeps a whole vote just because the other also wrote some of it',
      fn: async function twoEnvelopesMergeOntoOneIssue() {
        expect(collectIssueAuthors({
          editor: editorOf({
            applied: [
              operationOf('first',),
              operationOf('second',),
            ],
            rounds: [
              selectedRound({
                envelopeId: 'first',
                slate: [
                  slateEntryOf({
                    index: 1,
                    modelId: AUTHOR,
                  },),
                ],
                selectedIndex: 1,
              },),
              selectedRound({
                envelopeId: 'second',
                slate: [
                  slateEntryOf({
                    index: 1,
                    modelId: HELPER,
                  },),
                ],
                selectedIndex: 1,
              },),
            ],
          },),
          envelopes: [
            envelopeOf({
              envelopeId: 'first',
              issueIds: [WHISKER,],
            },),
            envelopeOf({
              envelopeId: 'second',
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

await describe({
  name: collectRefinedAuthors.name,
  children: [
    it({
      name: 'READS BOTH STAGES OFF ONE ROUND LIST and takes its envelope map from the regions the '
        + 'accuracy stage actually replaced, so an editor whose fix survived and a refiner who '
        + 'rewrote around it are both discounted at the recheck',
      fn: async function refinedTextHasTwoSetsOfAuthors() {
        expect(collectRefinedAuthors({
          rounds: [
            selectedRound({
              envelopeId: 'kept',
              slate: [
                slateEntryOf({
                  index: 1,
                  modelId: AUTHOR,
                },),
              ],
              selectedIndex: 1,
            },),
            selectedRound({
              envelopeId: 'chunk',
              slate: [
                slateEntryOf({
                  index: 1,
                  modelId: HELPER,
                },),
              ],
              selectedIndex: 1,
            },),
          ],
          repairRegions: [
            {
              envelopeId: 'kept',
              issueIds: [WHISKER,],
              before: 'the cat naps',
              editorAfter: 'the cat dozes',
            },
          ],
        },),).toEqual({
          perIssue: { [WHISKER]: [AUTHOR,], },
          everyIssue: [HELPER,],
        },);
      },
    },),
  ],
},);
