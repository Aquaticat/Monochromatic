import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';

import type { AdjudicatedIssue, } from './adjudicate-model.ts';
import type { JsonSchemaResponseFormat, } from './chat-contract.ts';
import { MEASUREMENT_POLICY_BLOCK, } from './house-policy.ts';
import {
  isJsonArray,
  isJsonRecord,
} from './json-guard.ts';

//region Resolution check
// Region changed does not mean issue resolved (settled architecture): after
// patches apply, checker models look at each accepted issue against the
// revised translation and say whether the defect is actually gone. Checkers
// answer with issue numbers and a closed verdict vocabulary; a strict
// majority of `fixed` verdicts across checkers marks an issue resolved.

/**
 * Fence line separating instructions from document text.
 */
const RESOLUTION_FENCE = '=====';

/**
 * Every verdict a checker may cast on one issue, closed vocabulary.
 * `worse` flags a repair that damaged the region beyond the original
 * defect; the no-regression measurement counts it against the candidate.
 *
 * @example
 * ```ts
 * RESOLUTION_VERDICTS.includes('fixed',);
 * ```
 */
export const RESOLUTION_VERDICTS = [
  'fixed',
  'not-fixed',
  'worse',
] as const;

/**
 * One checker verdict on one issue.
 *
 * @example
 * ```ts
 * const verdict: ResolutionVerdict = 'fixed';
 * ```
 */
export type ResolutionVerdict = typeof RESOLUTION_VERDICTS[number];

/**
 * Guards untrusted verdict strings from model JSON.
 *
 * @param value - candidate from unvalidated model output
 *
 * @returns Whether value names one listed verdict
 *
 * @example
 * ```ts
 * isResolutionVerdict('fixed',);
 * ```
 */
export function isResolutionVerdict(value: unknown,): value is ResolutionVerdict {
  if ((typeof value) !== 'string')
    return false;

  return (RESOLUTION_VERDICTS as readonly string[]).includes(value,);
}

/**
 * System instructions shared by every checker call.
 */
const RESOLUTION_SYSTEM_PROMPT = `You are a strict bilingual translation reviewer.
Editors revised the TRANSLATION of the ORIGINAL document to fix the numbered issues below.
For EVERY issue, judge the REVISED translation:
- fixed: the defect is gone and the fix reads correctly
- not-fixed: the defect is still present, in the same or another form
- worse: the revision introduced new damage around this issue

${MEASUREMENT_POLICY_BLOCK}

An issue asking for a detail reader protection keeps out is answered not-fixed, and there is no verdict here meaning the issue should never have been filed: the REVISED translation is right not to carry that detail, and saying fixed would agree that it should. Where the REVISED translation HAS restored such a detail, the verdict is worse.

Reply with ONLY a JSON object of shape {"checks": [{"issue": 1, "verdict": "fixed"}]}. No prose, no code fences.
Every issue number must appear exactly once in checks.`;

/**
 * Messages plus the issue order checks resolve through:
 * issue number N on the wire means `issueIds[N - 1]`.
 *
 * @example
 * ```ts
 * const plan: ResolutionPromptPlan = buildResolutionMessages({
 *   sourceText,
 *   patchedText,
 *   issues,
 * },);
 * ```
 */
export type ResolutionPromptPlan = {
  /**
   * Messages ready for `chatJson`.
   */
  readonly messages: readonly ChatMessage[];

  /**
   * Issue ids in prompt numbering order.
   */
  readonly issueIds: readonly string[];
};

/**
 * Builds the checker sheet: original, revised translation, and every
 * accepted issue the editors were asked to fix.
 *
 * @param sourceText - original chunk text
 *
 * @param patchedText - revised translation after patch application
 *
 * @param issues - accepted issues the editors addressed
 *
 * @returns Messages plus issue numbering order
 *
 * @example
 * ```ts
 * const plan = buildResolutionMessages({ sourceText, patchedText, issues, },);
 * ```
 */
export function buildResolutionMessages(
  {
    sourceText,
    patchedText,
    issues,
  }: {
    readonly sourceText: string;
    readonly patchedText: string;
    readonly issues: readonly AdjudicatedIssue[];
  },
): ResolutionPromptPlan {
  /**
   * Rendered issue blocks in issue order.
   */
  const blocks = issues.map(function toBlock(
    issue,
    index,
  ) {
    /**
     * Claim lines of this issue.
     */
    const claimLines = issue.claims
      .map(function toLine(member,) {
      return `- (${member.claim
        .category}, ${issue.severity}): ${member.claim
          .summary}`;
    },);

    return `ISSUE ${index + 1}
${claimLines.join('\n',)}`;
  },);

  return {
    messages: [
      {
        role: 'system',
        content: RESOLUTION_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: `${RESOLUTION_FENCE} ORIGINAL ${RESOLUTION_FENCE}
${sourceText}
${RESOLUTION_FENCE} REVISED TRANSLATION ${RESOLUTION_FENCE}
${patchedText}
${RESOLUTION_FENCE} ISSUES ${RESOLUTION_FENCE}
${blocks.join('\n\n',)}
${RESOLUTION_FENCE} END ${RESOLUTION_FENCE}`,
      },
    ],
    issueIds: issues.map(function toId(issue,) {
      return issue.issueId;
    },),
  };
}

/**
 * One check as a checker reports it.
 *
 * @example
 * ```ts
 * const wire: ResolutionCheckWire = { issue: 1, verdict: 'fixed', };
 * ```
 */
export type ResolutionCheckWire = {
  /**
   * One-based issue number from the prompt sheet.
   */
  readonly issue: number;

  /**
   * Verdict string; validated against the closed vocabulary at resolution.
   */
  readonly verdict: string;
};

/**
 * Whole checker reply on the wire.
 *
 * @example
 * ```ts
 * const report: ResolutionReportWire = { checks: [], };
 * ```
 */
export type ResolutionReportWire = {
  /**
   * Every check cast.
   */
  readonly checks: readonly ResolutionCheckWire[];
};

/**
 * Guards one wire check.
 *
 * @param value - candidate from parsed model JSON
 *
 * @returns Whether value carries the required check fields
 *
 * @example
 * ```ts
 * isResolutionCheckWire({ issue: 1, verdict: 'fixed', },);
 * ```
 */
function isResolutionCheckWire(value: unknown,): value is ResolutionCheckWire {
  if (!isJsonRecord(value,))
    return false;

  /**
   * Issue reference as reported; integerness checked on the primitive copy.
   */
  const { issue, } = value;
  if ((typeof issue) !== 'number')
    return false;
  if ((issue % 1) !== 0)
    return false;
  return (typeof value.verdict) === 'string';
}

/**
 * Guards a whole checker reply.
 *
 * @param value - parsed model JSON
 *
 * @returns Whether value is a wire report
 *
 * @example
 * ```ts
 * const outcome = await client.chatJson({ ..., validate: isResolutionReportWire, },);
 * ```
 */
export function isResolutionReportWire(value: unknown,): value is ResolutionReportWire {
  if (!isJsonRecord(value,))
    return false;
  if (!isJsonArray(value.checks,))
    return false;
  return value.checks
    .every(function eachCheck(check,) {
      return isResolutionCheckWire(check,);
    },);
}

/**
 * Structured-output constraint for checker calls;
 * client-side validation through {@link isResolutionReportWire} stays
 * regardless, because per-model schema strictness is unverified.
 */
export const RESOLUTION_RESPONSE_FORMAT: JsonSchemaResponseFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'resolution_report',
    schema: {
      type: 'object',
      required: ['checks',],
      additionalProperties: false,
      properties: {
        checks: {
          type: 'array',
          items: {
            type: 'object',
            required: [
              'issue',
              'verdict',
            ],
            additionalProperties: false,
            properties: {
              issue: { type: 'integer', },
              verdict: { type: 'string', },
            },
          },
        },
      },
    },
  },
};

//endregion Resolution check
