import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';

import type { JsonSchemaResponseFormat, } from './chat-contract.ts';
import { HOUSE_POLICY_BLOCK, } from './house-policy.ts';
import { isJsonRecord, } from './json-guard.ts';
import { selectFence, } from './prompt-fence.ts';

//region Coverage wire
// The question no aligner can answer: is this passage rendered ANYWHERE in the
// translation.
//
// WHY IT EXISTS. Both halves of the one-sided slicing work insert text where an
// aligner reports no counterpart, and `#106` measured what those reports are
// made of. At paragraph scale, `alignBlocks` can pair one with one or skip a
// block, and nothing else, so a translation that renders two source paragraphs
// as one reports the second as unpaired, identically to an omission: 95 unpaired
// source blocks corpus-wide, whose strongest cases are merges and whose weakest
// are mispairings. At section scale it is worse, 8 of 11 unpaired source
// sections being sections the translation plainly carries under a corresponding
// heading. An aligner distinguishes PAIRED from UNPAIRED; inserting needs a
// third verdict, and this asks for it.
//
// SCOPED TO THE WHOLE TRANSLATION rather than to the blocks an aligner chose as
// neighbours, which is the entire point: a question asked about the neighbours
// inherits the pairing it was meant to check.
//
// EVERY CLAIM OF COVERAGE CARRIES A QUOTE, and `coverage-verdict.ts` throws the
// unanchorable ones away. Coverage can be PROVEN, by pointing at the English
// that carries the passage; absence cannot be, since no reader can exhibit text
// that is not there. So the two answers are not symmetric and the verdict treats
// them differently, which is the honest shape for this question rather than a
// limitation of the sheet.

/**
 * Instructions every coverage call shares.
 *
 * SEARCHING, NOT TRANSLATING, is the whole discipline here, and models offered a
 * Chinese passage and an English document reach for translation by default. The
 * rules say so three ways: what the task is, what a wrong answer looks like, and
 * what the reply must contain.
 */
const COVERAGE_RULES =
  `You are checking a translation for coverage. You are NOT translating anything.

You will be shown one PASSAGE from a Chinese original, and the ENGLISH TRANSLATION of the document it comes from.

Decide whether the English already carries what the passage says.

Rules:
- The English may carry the passage anywhere: in a different paragraph, in a different order, or merged into a sentence that also carries neighbouring passages. All of those count as carried. The passage does not need its own paragraph.
- A rendering may be loose. Different wording, a summary that keeps the meaning, or a translation that reorders the sentence all count as carried.
- Answer "full" when the English says everything the passage says. Answer "partial" when it says some of it and leaves the rest out. Answer "none" when nothing in the English renders it.
- For "full" and "partial", quote the English that carries it, copied EXACTLY from the text you were shown, including its punctuation and capitalisation. Do not paraphrase the quote, do not join separated sentences with an ellipsis, and do not correct anything in it.
- For "none", leave the quote empty.
- Not finding it is a real answer. This archive genuinely has passages nobody translated, and reporting one as carried hides it forever. Never guess at a quote to justify an answer.

${HOUSE_POLICY_BLOCK}`;

/**
 * Reply-format instruction, kept LAST in the assembled sheet.
 */
const COVERAGE_REPLY_RULE =
  `Reply with JSON only: {"coverage": "full" | "partial" | "none", "quote": "<exact English carrying it, or empty>", "reason": "<one sentence>"}`;

/**
 * Messages for one coverage call.
 *
 * @example
 * ```ts
 * const plan: CoveragePromptPlan = { messages, };
 * ```
 */
export type CoveragePromptPlan = {
  /**
   * System sheet and the passage under question.
   */
  readonly messages: readonly ChatMessage[];
};

/**
 * Builds the sheet asking whether a translation carries one passage.
 *
 * @param sourcePassage - original-side text whose coverage is in question
 *
 * @param translationText - translation searched, whole rather than neighbouring
 *
 * @returns Messages for the call
 *
 * @example
 * ```ts
 * const plan = buildCoverageMessages({ sourcePassage, translationText, },);
 * ```
 */
export function buildCoverageMessages(
  {
    sourcePassage,
    translationText,
  }: {
    readonly sourcePassage: string;
    readonly translationText: string;
  },
): CoveragePromptPlan {
  /**
   * Fence neither enclosed text can reproduce, since both are arbitrary prose.
   */
  const fence = selectFence({
    texts: [
      sourcePassage,
      translationText,
    ],
  },);
  return {
    messages: [
      {
        role: 'system',
        content: `${COVERAGE_RULES}\n\n${COVERAGE_REPLY_RULE}`,
      },
      {
        role: 'user',
        content: `${fence} PASSAGE ${fence}
${sourcePassage}
${fence} ENGLISH TRANSLATION ${fence}
${translationText}
${fence} END ${fence}`,
      },
    ],
  };
}

/**
 * How much of a passage a translation carries.
 */
export type CoverageDegree = 'full' | 'partial' | 'none';

/**
 * One coverage reply on the wire.
 *
 * @example
 * ```ts
 * const wire: CoverageReportWire = { coverage: 'none', quote: '', reason: 'nothing renders it', };
 * ```
 */
export type CoverageReportWire = {
  /**
   * How much of the passage the translation carries.
   */
  readonly coverage: CoverageDegree;

  /**
   * English carrying it, verbatim, and empty exactly when coverage is none.
   */
  readonly quote: string;

  /**
   * One sentence of justification, kept for reading rather than for deciding.
   */
  readonly reason: string;
};

/**
 * Coverage degrees a reply may claim.
 */
const COVERAGE_DEGREES: readonly string[] = [
  'full',
  'partial',
  'none',
];

/**
 * Guards a coverage reply.
 *
 * A CLAIM OF COVERAGE WITHOUT A QUOTE IS REFUSED HERE rather than discounted
 * later, because the roster treats a refusal as a lost voice and asks that model
 * again. The quote is the only part of this reply anything downstream can check,
 * so a reply without one carries no evidence at all, and a model that answers
 * that way has not done the task.
 *
 * A claim of NO coverage with a quote is refused for the mirror reason: the two
 * fields contradict each other, and neither can be trusted over the other.
 *
 * @param value - parsed model JSON
 *
 * @returns Whether value is a coverage reply whose fields agree
 *
 * @example
 * ```ts
 * const ok = isCoverageReportWire(JSON.parse(text,),);
 * ```
 */
export function isCoverageReportWire(value: unknown,): value is CoverageReportWire {
  if (!isJsonRecord(value,))
    return false;
  if ((typeof value.quote) !== 'string')
    return false;
  if ((typeof value.reason) !== 'string')
    return false;
  if ((typeof value.coverage) !== 'string')
    return false;
  if (!COVERAGE_DEGREES.includes(value.coverage,))
    return false;

  /**
   * Whether this reply says the translation carries any of the passage.
   */
  const claimsCoverage = value.coverage !== 'none';

  /**
   * Whether it offers English to point at.
   */
  const offersQuote = value.quote
    .trim()
    !== '';

  return claimsCoverage === offersQuote;
}

/**
 * Structured-output constraint for coverage calls.
 */
export const COVERAGE_RESPONSE_FORMAT: JsonSchemaResponseFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'coverage_report',
    schema: {
      type: 'object',
      required: [
        'coverage',
        'quote',
        'reason',
      ],
      additionalProperties: false,
      properties: {
        coverage: {
          type: 'string',
          enum: [...COVERAGE_DEGREES,],
        },
        quote: { type: 'string', },
        reason: { type: 'string', },
      },
    },
  },
};

//endregion Coverage wire
