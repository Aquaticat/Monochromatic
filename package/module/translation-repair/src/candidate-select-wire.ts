import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';

import type { JsonSchemaResponseFormat, } from './chat-contract.ts';
import { isJsonRecord, } from './json-guard.ts';

//region Candidate selection wire format
// Free-text candidates cannot be voted on the way claims are: two editors fixing
// the same defect will phrase the fix differently, so there is nothing to match.
// Judges therefore compare rendered candidates side by side and name the best
// one, or decline.
//
// Candidates reach judges ANONYMIZED and in caller-fixed order, labelled 1..N.
// A judge that could see which model wrote which candidate would be voting on
// reputation, and the whole point of the ensemble is that no single model's
// output is privileged.
//
// Declining is a first-class answer, not a failure: `best: 0` means no candidate
// is good enough, and the caller falls back to text it already trusts.

/**
 * Fence line separating instructions from candidate text.
 */
const SELECT_FENCE = '=====';

/**
 * Ballot value meaning no candidate is acceptable.
 */
export const CANDIDATE_NONE = 0;

/**
 * One judge's ballot over the candidate set.
 *
 * @example
 * ```ts
 * const ballot: CandidateBallotWire = { best: 2, reason: 'keeps the source clause order', };
 * ```
 */
export type CandidateBallotWire = {
  /**
   * One-based index of the chosen candidate,
   * or {@link CANDIDATE_NONE} to decline them all.
   */
  readonly best: number;

  /**
   * Why, in one line; recorded so a selection can be audited later.
   */
  readonly reason: string;
};

/**
 * Guards untrusted ballots from model JSON.
 *
 * @param value - candidate from unvalidated model output
 *
 * @returns Whether value is a well-formed ballot
 *
 * @example
 * ```ts
 * isCandidateBallotWire({ best: 1, reason: 'most natural', },);
 * ```
 */
export function isCandidateBallotWire(value: unknown,): value is CandidateBallotWire {
  if (!isJsonRecord(value,))
    return false;

  /**
   * Chosen index as the model sent it.
   */
  const {
    best,
    reason,
  } = value;
  return ((typeof best) === 'number')
    && Number.isInteger(best,)
    && (best >= CANDIDATE_NONE)
    && ((typeof reason) === 'string');
}

/**
 * Structured-output constraint for a selection ballot.
 */
export const CANDIDATE_SELECT_RESPONSE_FORMAT: JsonSchemaResponseFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'candidate_ballot',
    schema: {
      type: 'object',
      required: [
        'best',
        'reason',
      ],
      additionalProperties: false,
      properties: {
        best: { type: 'integer', },
        reason: { type: 'string', },
      },
    },
  },
};

/**
 * Builds the judge prompt: the task, the evidence, and the anonymized
 * candidates in caller order.
 *
 * @param task - what the candidates are attempting, in one sentence
 *
 * @param criteria - ordered decision rules, most important first
 *
 * @param evidence - source and baseline text judges compare against
 *
 * @param rendered - candidate texts in caller-fixed order
 *
 * @returns Messages for one judge exchange
 *
 * @example
 * ```ts
 * const messages = buildCandidateSelectMessages({ task, criteria, evidence, rendered, },);
 * ```
 */
export function buildCandidateSelectMessages(
  {
    task,
    criteria,
    evidence,
    rendered,
  }: {
    readonly task: string;
    readonly criteria: readonly string[];
    readonly evidence: string;
    readonly rendered: readonly string[];
  },
): readonly ChatMessage[] {
  /**
   * Candidates numbered from one, each fenced so its own line breaks and
   * punctuation cannot be read as instructions.
   */
  const block = rendered
    .map(function toBlock(
      text,
      index,
    ) {
      return `CANDIDATE ${String(index + 1,)}\n${SELECT_FENCE}\n${text}\n${SELECT_FENCE}`;
    },)
    .join('\n\n',);

  /**
   * Decision rules as a numbered list.
   */
  const rules = criteria
    .map(function toRule(
      rule,
      index,
    ) {
      return `${String(index + 1,)}. ${rule}`;
    },)
    .join('\n',);

  return [
    {
      role: 'system',
      content:
        `You are an impartial judge choosing between candidate rewrites. ${task}\n\n`
        + `Decide by these criteria, earlier ones outranking later ones:\n${rules}\n\n`
          + `You do not know which system produced which candidate, and must not guess. `
          + `Judge only the text in front of you.\n\n`
          + `Answer ${String(CANDIDATE_NONE,)} for "best" when NO candidate is acceptable. `
          + `Declining is a real answer and is better than endorsing a candidate you would not ship; `
          + `the caller keeps text it already trusts when you decline.\n\n`
          + `Reply with ONLY a JSON object of shape {"best": 1, "reason": "..."}. `
          + `No prose, no code fences.`,
    },
    {
      role: 'user',
      content: `${evidence}\n\n${block}`,
    },
  ];
}

//endregion Candidate selection wire format
