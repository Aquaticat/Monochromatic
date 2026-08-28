import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';

import type { JsonSchemaResponseFormat, } from './chat-contract.ts';
import { isJsonRecord, } from './json-guard.ts';
import { selectFence, } from './prompt-fence.ts';

//region Absolute naturalness review wire

/**
 * One paragraph-located material naturalness defect.
 *
 * @example
 * ```ts
 * const finding: AbsoluteNaturalnessFinding = { paragraph: 1, problem: 'Replace source-language word order.' };
 * ```
 */
export type AbsoluteNaturalnessFinding = {
  /**
   * One-based paragraph number shown in reviewer sheet.
   */
  readonly paragraph: number;

  /**
   * Concise actionable naturalness defect.
   */
  readonly problem: string;
};

/**
 * Provider reply judging one whole English candidate against absolute publication quality.
 *
 * @example
 * ```ts
 * const reply: AbsoluteNaturalnessReviewWire = { acceptable: true, findings: [], reason: 'publication-ready English' };
 * ```
 */
export type AbsoluteNaturalnessReviewWire = {
  /**
   * Whether whole candidate meets absolute naturalness floor.
   */
  readonly acceptable: boolean;

  /**
   * Actionable naturalness defects, empty only for acceptable candidate.
   */
  readonly findings: readonly AbsoluteNaturalnessFinding[];

  /**
   * Concise explanation of verdict.
   */
  readonly reason: string;
};

/**
 * Candidate and context shown to absolute reviewer.
 *
 * @example
 * ```ts
 * const subject: AbsoluteNaturalnessReviewSubject = { sourceText: '猫睡了。', candidateText: 'The cat slept.', paragraphs: ['The cat slept.'] };
 * ```
 */
export type AbsoluteNaturalnessReviewSubject = {
  /**
   * Chinese passage clarifying deliberate source-language terms.
   */
  readonly sourceText: string;

  /**
   * Exact English wording that would ship.
   */
  readonly candidateText: string;

  /**
   * Structurally refinable paragraphs in displayed one-based order.
   */
  readonly paragraphs: readonly string[];

  /**
   * Declared names and public handles candidate must treat as intentional.
   */
  readonly identityContext?: string;
};

/**
 * Structured-output contract for absolute naturalness reviewer.
 */
export const ABSOLUTE_NATURALNESS_REVIEW_RESPONSE_FORMAT: JsonSchemaResponseFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'absolute_naturalness_review',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        acceptable: { type: 'boolean', },
        findings: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              paragraph: {
                type: 'integer',
                minimum: 1,
              },
              problem: { type: 'string', },
            },
            required: [
              'paragraph',
              'problem',
            ],
            additionalProperties: false,
          },
        },
        reason: { type: 'string', },
      },
      required: [
        'acceptable',
        'findings',
        'reason',
      ],
      additionalProperties: false,
    },
  },
};

/**
 * Checks reviewer reply shape and verdict-to-findings consistency.
 *
 * @param value - parsed provider value
 *
 * @returns Whether value is usable absolute review
 *
 * @example
 * ```ts
 * if (isAbsoluteNaturalnessReviewWire(value)) consume(value);
 * ```
 */
export function isAbsoluteNaturalnessReviewWire(
  value: unknown,
): value is AbsoluteNaturalnessReviewWire {
  if (((typeof value) !== 'object') || (value === null))
    return false;
  if (!('acceptable' in value))
    return false;
  if ((typeof value.acceptable) !== 'boolean')
    return false;
  if (!('findings' in value))
    return false;
  if (!Array.isArray(value.findings,))
    return false;
  if (!value
    .findings
    .every(function isFinding(finding,): finding is AbsoluteNaturalnessFinding {
      if (!isJsonRecord(finding,))
        return false;
      /**
       * Finding fields before primitive validation.
       */
      const {
        paragraph,
        problem,
      } = finding;
      if ((typeof paragraph) !== 'number')
        return false;
      if (!Number.isInteger(paragraph,))
        return false;
      if (paragraph < 1)
        return false;
      if ((typeof problem) !== 'string')
        return false;
      return problem !== '';
    },))
    return false;
  if (!('reason' in value))
    return false;
  if ((typeof value.reason) !== 'string')
    return false;
  /**
   * Findings after array and element validation.
   */
  const { findings, } = value;
  if (value.acceptable)
    return findings.length === 0;
  return findings.length > 0;
}

/**
 * Builds independent absolute-quality question over exact would-ship wording.
 *
 * @param subject - source context, exact candidate and declared identities
 *
 * @returns Fenced reviewer conversation
 *
 * @example
 * ```ts
 * const messages = buildAbsoluteNaturalnessReviewMessages({ subject, });
 * ```
 */
export function buildAbsoluteNaturalnessReviewMessages(
  { subject, }: { readonly subject: AbsoluteNaturalnessReviewSubject; },
): readonly ChatMessage[] {
  /**
   * Fence absent from every untrusted block.
   */
  const fence = selectFence({
    texts: [
      subject.sourceText,
      subject.candidateText,
      ...subject.paragraphs,
      ...((subject.identityContext === undefined) ? [] : [subject.identityContext,]),
    ],
  },);
  /**
   * Declared identity context or no block.
   */
  const identity = (subject.identityContext === undefined)
    ? []
    : [
      'DECLARED NAMES AND HANDLES (intentional forms, not naturalness defects):',
      `${fence}\n${subject.identityContext}\n${fence}`,
      '',
    ];
  /**
   * Numbered refinable paragraphs findings must locate.
   */
  const paragraphs = subject.paragraphs
    .map(function numberParagraph(
      paragraph,
      index,
    ): string {
      return `PARAGRAPH ${String(index + 1,)}\n${fence}\n${paragraph}\n${fence}`;
    },)
    .join('\n\n',);
  return [
    {
      role: 'system',
      content: `You are an independent publication-quality editor. Judge the ENTIRE English candidate against an absolute naturalness floor, not against another candidate and not by whether it is better than an earlier draft.

Mark acceptable only when the whole candidate reads as idiomatic, publication-ready English. Reject translationese a careful native editor should change: Chinese word order or parts of speech carried into English, calqued verb-object combinations, stacked time or aspect adverbs, repeated generic nouns or pronouns, stiff causal transitions, literal emotional descriptions, unclear references, and ungrammatical coordination.

Do not reject merely because another optional style is possible. Preserve memorial tone, deliberate source-language kinship terms with their glosses, names, handles, links, Markdown, and line structure. Judge naturalness only; do not rewrite the passage or decide factual fidelity.

For an unacceptable candidate, return one concise actionable finding per material defect and cover every material defect you see. Every finding must name the one-based PARAGRAPH number shown in the sheet. Report only defects in those numbered, structurally correctable paragraphs. For an acceptable candidate, findings must be empty.`,
    },
    {
      role: 'user',
      content: [
        ...identity,
        'ORIGINAL (Chinese, context only):',
        `${fence}\n${subject.sourceText}\n${fence}`,
        '',
        'EXACT ENGLISH CANDIDATE THAT WOULD SHIP:',
        `${fence}\n${subject.candidateText}\n${fence}`,
        '',
        'STRUCTURALLY CORRECTABLE PARAGRAPHS:',
        paragraphs,
        '',
        'Return only JSON: acceptable boolean; findings objects with paragraph and problem; reason one sentence.',
      ].join('\n',),
    },
  ];
}

//endregion Absolute naturalness review wire
