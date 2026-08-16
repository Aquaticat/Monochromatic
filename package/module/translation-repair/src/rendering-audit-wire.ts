import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';

import type { JsonSchemaResponseFormat, } from './chat-contract.ts';
import {
  isJsonArray,
  isJsonRecord,
} from './json-guard.ts';
import { selectFence, } from './prompt-fence.ts';

//region Rendering audit wire
// Asks whether one candidate rendering says what its original says, with NO
// before-text to compare against.
//
// WHY A SECOND INSTRUMENT RATHER THAN A WIDER FIRST ONE. The introduced-defect
// probe asks a DIFFERENTIAL question: does this replacement carry a defect the
// baseline did not have. That question needs a baseline, and a slice the
// translate lane rendered from scratch has none: there is no earlier wording of
// it that anybody produced. Widening that probe would have meant passing it an
// empty baseline and reading every defect as introduced, which is exactly the
// reading the differential form exists to avoid.
//
// SO THE QUESTION HERE IS ABSOLUTE: against the original, and against the
// identity evidence this run licensed, does the candidate fail to render or
// misrepresent anything. Nothing about improvement, nothing about the archive.
//
// THE ARCHIVE IS NOT THE STANDARD, and the prompt is not what enforces that.
// The screen anchors an original quote in the ORIGINAL only, so a claim that
// quotes the archive's wording as though it were the source anchors nowhere and
// is dropped. A prompt sentence would be advice; this is a property of what
// counts as evidence.
//
// EVERY CATEGORY NAMES WHICH SIDE IT CAN PROVE ITSELF FROM, which is the one
// thing a symmetric rule gets wrong. Content the candidate never rendered has
// nothing in the candidate to quote, its absence being the whole claim, so
// omission proves itself from the original alone. An addition nothing supports
// has nothing in the original to quote, for the mirror reason. Everything else
// changes something both sides state, and must quote both.

/**
 * Every verdict one auditor may cast on one candidate, closed vocabulary.
 *
 * NO `faithful`, for the same reason the introduced-defect vocabulary has no
 * `clean`: a voice reports what it found, and finding nothing is not proof of
 * fidelity. `no-defect-found` says exactly that much and no more.
 *
 * @example
 * ```ts
 * RENDERING_AUDIT_VERDICTS.includes('defects-found',);
 * ```
 */
export const RENDERING_AUDIT_VERDICTS = [
  'defects-found',
  'no-defect-found',
  'uncertain',
] as const;

/**
 * One verdict, narrowed to the vocabulary.
 *
 * @example
 * ```ts
 * const verdict: RenderingAuditVerdict = 'no-defect-found';
 * ```
 */
export type RenderingAuditVerdict = typeof RENDERING_AUDIT_VERDICTS[number];

/**
 * Categories provable from the ORIGINAL alone, because the candidate holds
 * nothing to quote.
 *
 * @example
 * ```ts
 * SOURCE_ONLY_CATEGORIES.includes('omission',);
 * ```
 */
export const SOURCE_ONLY_CATEGORIES = ['omission',] as const;

/**
 * Categories provable from the CANDIDATE alone, because the original holds
 * nothing to quote.
 *
 * @example
 * ```ts
 * CANDIDATE_ONLY_CATEGORIES.includes('unsupported-addition',);
 * ```
 */
export const CANDIDATE_ONLY_CATEGORIES = ['unsupported-addition',] as const;

/**
 * Categories that change something both sides state, and must quote both.
 *
 * @example
 * ```ts
 * PAIRED_CATEGORIES.includes('altered-polarity',);
 * ```
 */
export const PAIRED_CATEGORIES = [
  'altered-actor',
  'altered-referent',
  'altered-polarity',
  'altered-modality',
  'altered-time',
  'altered-number',
  'altered-relation',
  'altered-identity',
  'broken-structure',
] as const;

/**
 * Every category an auditor may name, closed vocabulary.
 *
 * @example
 * ```ts
 * RENDERING_AUDIT_CATEGORIES.includes('omission',);
 * ```
 */
export const RENDERING_AUDIT_CATEGORIES = [
  ...SOURCE_ONLY_CATEGORIES,
  ...CANDIDATE_ONLY_CATEGORIES,
  ...PAIRED_CATEGORIES,
] as const;

/**
 * One category, narrowed to the vocabulary.
 *
 * @example
 * ```ts
 * const category: RenderingAuditCategory = 'omission';
 * ```
 */
export type RenderingAuditCategory = typeof RENDERING_AUDIT_CATEGORIES[number];

/**
 * One claimed defect as an auditor sent it, before any screening.
 *
 * BOTH QUOTE FIELDS ALWAYS PRESENT ON THE WIRE, and empty where the category
 * cannot prove itself from that side. A schema whose required fields varied by
 * category would ask a model to satisfy a conditional shape, which is the kind
 * of instruction a model follows unevenly; the screen enforces the obligation
 * instead, where it is deterministic.
 *
 * @example
 * ```ts
 * const finding: RenderingAuditFindingWire = {
 *   category: 'omission',
 *   sourceQuote: '猫猫没有离开窗台',
 *   candidateQuote: '',
 *   reason: 'the clause is absent',
 * };
 * ```
 */
export type RenderingAuditFindingWire = {
  /**
   * What kind of defect this is, from the closed vocabulary.
   */
  readonly category: string;

  /**
   * Minimal span of the ORIGINAL this claim rests on.
   */
  readonly sourceQuote: string;

  /**
   * Minimal span of the CANDIDATE this claim rests on.
   */
  readonly candidateQuote: string;

  /**
   * Why those two spans amount to the claimed defect.
   */
  readonly reason: string;
};

/**
 * One auditor's whole answer about one candidate.
 *
 * @example
 * ```ts
 * const report: RenderingAuditReportWire = { verdict: 'no-defect-found', findings: [], };
 * ```
 */
export type RenderingAuditReportWire = {
  /**
   * What this voice concluded overall.
   */
  readonly verdict: string;

  /**
   * Every defect it claims, empty when it claims none.
   */
  readonly findings: readonly RenderingAuditFindingWire[];
};

/**
 * Reads one wire finding out of an untyped value.
 *
 * @param value - one element of a reply's finding list
 *
 * @returns Whether it carries every field this wire requires, as strings
 *
 * @example
 * ```ts
 * const usable = isRenderingAuditFindingWire(value,);
 * ```
 */
function isRenderingAuditFindingWire(value: unknown,): value is RenderingAuditFindingWire {
  if (!isJsonRecord(value,))
    return false;

  return ((typeof value.category) === 'string')
    && ((typeof value.sourceQuote) === 'string')
    && ((typeof value.candidateQuote) === 'string')
    && ((typeof value.reason) === 'string');
}

/**
 * Reads one auditor's reply out of an untyped value.
 *
 * SHAPE ONLY. Whether the words are ones this version knows, and whether the
 * quotes prove anything, belong to the screen: a reply that is well shaped and
 * unfounded is a different failure from one that did not parse, and reporting
 * them as the same thing loses the voice-loss rate.
 *
 * @param value - parsed reply
 *
 * @returns Whether it is a report this wire can hand to the screen
 *
 * @example
 * ```ts
 * if (isRenderingAuditReportWire(parsed,)) screen({ report: parsed, },);
 * ```
 */
export function isRenderingAuditReportWire(value: unknown,): value is RenderingAuditReportWire {
  if (!isJsonRecord(value,))
    return false;

  if ((typeof value.verdict) !== 'string')
    return false;

  if (!isJsonArray(value.findings,))
    return false;

  return value.findings
    .every(isRenderingAuditFindingWire,);
}

/**
 * What one audit call is asked about.
 *
 * @example
 * ```ts
 * const subject: RenderingAuditSubject = { sourceText, candidateText, };
 * ```
 */
export type RenderingAuditSubject = {
  /**
   * Original passage, the only standard this audit has.
   */
  readonly sourceText: string;

  /**
   * Rendering under audit.
   */
  readonly candidateText: string;

  /**
   * Names and terms this run licensed, shown as evidence rather than as a rule.
   */
  readonly identityContext?: string;
};

/**
 * Builds the messages for one audit call.
 *
 * @param subject - original, candidate and any licensed identity evidence
 *
 * @returns System and user messages
 *
 * @example
 * ```ts
 * const messages = buildRenderingAuditMessages({ subject, },);
 * ```
 */
export function buildRenderingAuditMessages(
  { subject, }: { readonly subject: RenderingAuditSubject; },
): readonly ChatMessage[] {
  /**
   * Fence long enough to hold both texts without either closing it.
   */
  const fence = selectFence({
    texts: [
      subject.sourceText,
      subject.candidateText,
      subject.identityContext ?? '',
    ],
  },);

  return [
    {
      role: 'system',
      content: [
        'You audit one translated passage against its original.',
        '',
        'THE QUESTION IS ABSOLUTE, not comparative. Against the ORIGINAL, and against any identity',
        'evidence given below, does the CANDIDATE fail to render or misrepresent anything?',
        '',
        'Report concrete omissions, unsupported additions, and changes to actor, referent, polarity,',
        'modality, time, number, relation, identity, or required structure.',
        '',
        'A difference from any other translation is NOT a defect, and no other translation is shown to',
        'you. Wording you would have chosen differently is not a defect either. Report only what the',
        'original does not support or what the candidate leaves unrendered.',
        '',
        'Every finding must quote the MINIMAL spans it rests on, copied character for character:',
        '',
        `  ${SOURCE_ONLY_CATEGORIES.join(', ',)}: quote the ORIGINAL span only, and leave candidateQuote empty,`,
        '  because content that was never rendered has nothing in the candidate to quote.',
        `  ${CANDIDATE_ONLY_CATEGORIES.join(', ',)}: quote the CANDIDATE span only, and leave sourceQuote empty.`,
        '  every other category: quote BOTH, since the two spans are what disagree.',
        '',
        'A quote that does not occur in the text it names is discarded, and so is the finding resting',
        'on it. Quote the fewest characters that still identify the span uniquely.',
        '',
        `verdict is one of: ${RENDERING_AUDIT_VERDICTS.join(', ',)}.`,
        `category is one of: ${RENDERING_AUDIT_CATEGORIES.join(', ',)}.`,
        '',
        'Answer with JSON only.',
      ].join('\n',),
    },
    {
      role: 'user',
      content: [
        'ORIGINAL:',
        fence,
        subject.sourceText,
        fence,
        '',
        'CANDIDATE:',
        fence,
        subject.candidateText,
        fence,
        ...((subject.identityContext === undefined)
          ? []
          : [
            '',
            'IDENTITY EVIDENCE, licensed for this document, not a defect when the candidate follows it:',
            fence,
            subject.identityContext,
            fence,
          ]),
      ].join('\n',),
    },
  ];
}

/**
 * Response format one audit call asks for.
 *
 * @example
 * ```ts
 * const format = RENDERING_AUDIT_RESPONSE_FORMAT;
 * ```
 */
export const RENDERING_AUDIT_RESPONSE_FORMAT: JsonSchemaResponseFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'rendering_audit_report',
    schema: {
      type: 'object',
      required: [
        'verdict',
        'findings',
      ],
      additionalProperties: false,
      properties: {
        verdict: { type: 'string', },
        findings: {
          type: 'array',
          items: {
            type: 'object',
            required: [
              'category',
              'sourceQuote',
              'candidateQuote',
              'reason',
            ],
            additionalProperties: false,
            properties: {
              category: { type: 'string', },
              sourceQuote: { type: 'string', },
              candidateQuote: { type: 'string', },
              reason: { type: 'string', },
            },
          },
        },
      },
    },
  },
};

//endregion Rendering audit wire
