import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';

import type { AdjudicatedIssue, } from './adjudicate-model.ts';
import type { JsonSchemaResponseFormat, } from './chat-contract.ts';
import {
  isJsonArray,
  isJsonRecord,
} from './json-guard.ts';
import type { RepairRegion, } from './repair-region.ts';

//region Introduced-defect probe wire
// The checker stage asks whether each KNOWN issue is gone. Nothing asked
// whether the repair broke something nobody had raised, so `regressedKnownIssues`
// scores a patch that fixes its target and mangles the sentence beside it as
// clean. This wire asks the differential question instead: did THIS replacement
// cause a defect that the baseline did not have.
//
// The failure mode is known before the first call: every region here contains a
// defect by construction, since that is why it was edited, so a model asked
// "is anything wrong" will always find something. Three things fight it, and
// none of them is the prompt alone: the verdict vocabulary refuses to offer
// `clean`, which would be false of a region whose original defect survives; the
// pre-existing issues are shown and labelled as NOT findings; and every claim
// must quote candidate evidence, which `introduced-defect-screen.ts` then checks
// against the baseline deterministically.

/**
 * Fence line separating instructions from document text.
 */
const PROBE_FENCE = '=====';

/**
 * Every verdict a prober may cast on one region, closed vocabulary.
 *
 * There is deliberately no `clean`. A region can be free of introduced damage
 * while remaining defective, because the accepted issue it was cut for may
 * still be unfixed, and a vocabulary that made a prober choose between `clean`
 * and `new-defect` would push every such region into the second bucket. The
 * long name says exactly what a negative verdict proves: this prober found no
 * introduced defect, not that the region is well translated.
 *
 * @example
 * ```ts
 * INTRODUCED_DEFECT_VERDICTS.includes('introduced-defect',);
 * ```
 */
export const INTRODUCED_DEFECT_VERDICTS = [
  'introduced-defect',
  'no-introduced-defect-found',
  'uncertain',
] as const;

/**
 * One prober verdict on one region.
 *
 * @example
 * ```ts
 * const verdict: IntroducedDefectVerdict = 'introduced-defect';
 * ```
 */
export type IntroducedDefectVerdict = typeof INTRODUCED_DEFECT_VERDICTS[number];

/**
 * Guards untrusted verdict strings from model JSON.
 *
 * @param value - candidate from unvalidated model output
 *
 * @returns Whether value names one listed verdict
 *
 * @example
 * ```ts
 * isIntroducedDefectVerdict('uncertain',);
 * ```
 */
export function isIntroducedDefectVerdict(value: unknown,): value is IntroducedDefectVerdict {
  if ((typeof value) !== 'string')
    return false;

  return (INTRODUCED_DEFECT_VERDICTS as readonly string[]).includes(value,);
}

/**
 * System instructions shared by every prober call.
 *
 * Wording follows the design review: the negative case is named as a search
 * that found nothing rather than as a clean bill of health, and the four
 * exclusions are stated as rules rather than as hints, because the pre-existing
 * defect sitting in every region is the thing a general "review this" prompt
 * reports first.
 */
const PROBE_SYSTEM_PROMPT = `You are a strict bilingual translation reviewer auditing an edit for collateral damage.
Editors replaced the BEFORE text of each numbered region with its AFTER text, trying to fix defects that were ALREADY THERE.
Judge ONLY this: did the replacement CAUSE a defect that the BEFORE text did not have?

Rules:
- Do NOT report a listed pre-existing issue merely because the replacement failed to fix it. That is not damage.
- Do NOT report a defect that is present in BOTH the BEFORE text and the AFTER text. It was not introduced.
- DO report a distinct defect created while attempting the repair, even where it concerns the same source passage as a pre-existing issue.
- Stylistic preference is NOT a defect. A different word being nicer is not damage. Report only concrete loss of accuracy, grammar, coherence, or consistency.

Verdicts:
- introduced-defect: the replacement caused a specific defect absent from BEFORE
- no-introduced-defect-found: you looked and found no defect the replacement caused; the region may still be imperfect
- uncertain: you cannot tell from what you were shown

For introduced-defect, quote the exact damaged wording FROM THE AFTER TEXT in "evidence", and say in "reason" why the BEFORE text did not have it.
Leave "evidence" and "reason" as empty strings for other verdicts.
Reply with ONLY a JSON object of shape {"checks": [{"region": 1, "verdict": "no-introduced-defect-found", "category": "", "severity": "", "evidence": "", "reason": ""}]}. No prose, no code fences.
Every region number must appear exactly once in checks.`;

/**
 * Messages plus the region order checks resolve through:
 * region number N on the wire means `envelopeIds[N - 1]`.
 *
 * @example
 * ```ts
 * const plan: IntroducedDefectPromptPlan = buildIntroducedDefectMessages({ ... },);
 * ```
 */
export type IntroducedDefectPromptPlan = {
  /**
   * Messages ready for `chatJson`.
   */
  readonly messages: readonly ChatMessage[];

  /**
   * Envelope ids in prompt numbering order.
   */
  readonly envelopeIds: readonly string[];
};

/**
 * Renders the pre-existing issues a region was cut for, so a prober can
 * recognise and discount them.
 *
 * @param region - region whose served issues are named
 *
 * @param issues - accepted issues of the chunk
 *
 * @returns Claim summary lines, or a line saying none were resolvable
 *
 * @example
 * ```ts
 * const lines = renderPriorIssues({ region, issues, },);
 * ```
 */
function renderPriorIssues(
  {
    region,
    issues,
  }: {
    readonly region: RepairRegion;
    readonly issues: readonly AdjudicatedIssue[];
  },
): string {
  /**
   * Summary lines of every accepted issue this region served.
   */
  const lines = issues
    .filter(function isServed(issue,) {
      return region.issueIds
        .includes(issue.issueId,);
    },)
    .flatMap(function toLines(issue,) {
      return issue.claims
        .map(function toLine(member,) {
          return `- (${member.claim
            .category}, ${issue.severity}): ${member.claim
              .summary}`;
        },);
    },);
  if (lines.length === 0)
    return '- (none recorded)';
  return lines.join('\n',);
}

/**
 * Builds the prober sheet: the original, the baseline translation, and every
 * replaced region with the pre-existing defects it was meant to fix.
 *
 * Both whole texts appear once rather than per region, so a prober can see
 * where a region sits without the sheet repeating the chunk for every edit.
 *
 * @param sourceText - original chunk text
 *
 * @param baselineText - translation as it stood before any replacement
 *
 * @param regions - replaced regions in prompt numbering order
 *
 * @param issues - accepted issues of the chunk, for the pre-existing lists
 *
 * @returns Messages plus region numbering order
 *
 * @example
 * ```ts
 * const plan = buildIntroducedDefectMessages({ sourceText, baselineText, regions, issues, },);
 * ```
 */
export function buildIntroducedDefectMessages(
  {
    sourceText,
    baselineText,
    regions,
    issues,
  }: {
    readonly sourceText: string;
    readonly baselineText: string;
    readonly regions: readonly RepairRegion[];
    readonly issues: readonly AdjudicatedIssue[];
  },
): IntroducedDefectPromptPlan {
  /**
   * Rendered region blocks in numbering order.
   */
  const blocks = regions.map(function toBlock(
    region,
    index,
  ) {
    return `REGION ${index + 1}
PRE-EXISTING DEFECTS THIS EDIT TARGETED (these are NOT your findings):
${renderPriorIssues({
      region,
      issues,
    },)}
BEFORE:
${region.before}
AFTER:
${region.editorAfter}`;
  },);

  return {
    messages: [
      {
        role: 'system',
        content: PROBE_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: `${PROBE_FENCE} ORIGINAL ${PROBE_FENCE}
${sourceText}
${PROBE_FENCE} BASELINE TRANSLATION ${PROBE_FENCE}
${baselineText}
${PROBE_FENCE} REPLACED REGIONS ${PROBE_FENCE}
${blocks.join('\n\n',)}
${PROBE_FENCE} END ${PROBE_FENCE}`,
      },
    ],
    envelopeIds: regions.map(function toId(region,) {
      return region.envelopeId;
    },),
  };
}

/**
 * One check as a prober reports it.
 *
 * @example
 * ```ts
 * const wire: IntroducedDefectCheckWire = { region: 1, verdict: 'uncertain', ... };
 * ```
 */
export type IntroducedDefectCheckWire = {
  /**
   * One-based region number from the prompt sheet.
   */
  readonly region: number;

  /**
   * Verdict string; validated against the closed vocabulary at resolution.
   */
  readonly verdict: string;

  /**
   * Defect class in the prober's own words; free text, telemetry only.
   */
  readonly category: string;

  /**
   * Claimed severity; free text, validated where it is read.
   */
  readonly severity: string;

  /**
   * Wording quoted from the AFTER text, which the screen checks against the
   * baseline before the claim counts as corroborated.
   */
  readonly evidence: string;

  /**
   * Why the BEFORE text did not carry this defect.
   */
  readonly reason: string;
};

/**
 * Whole prober reply on the wire.
 *
 * @example
 * ```ts
 * const report: IntroducedDefectReportWire = { checks: [], };
 * ```
 */
export type IntroducedDefectReportWire = {
  /**
   * Every check cast.
   */
  readonly checks: readonly IntroducedDefectCheckWire[];
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
 * isIntroducedDefectCheckWire({ region: 1, verdict: 'uncertain', ... },);
 * ```
 */
function isIntroducedDefectCheckWire(value: unknown,): value is IntroducedDefectCheckWire {
  if (!isJsonRecord(value,))
    return false;

  /**
   * Region reference as reported; integerness checked on the primitive copy.
   */
  const { region, } = value;
  if ((typeof region) !== 'number')
    return false;
  if ((region % 1) !== 0)
    return false;
  return [
    'verdict',
    'category',
    'severity',
    'evidence',
    'reason',
  ].every(function isString(field,) {
    return (typeof value[field]) === 'string';
  },);
}

/**
 * Guards a whole prober reply.
 *
 * @param value - parsed model JSON
 *
 * @returns Whether value is a wire report
 *
 * @example
 * ```ts
 * const outcome = await client.chatJson({ ..., validate: isIntroducedDefectReportWire, },);
 * ```
 */
export function isIntroducedDefectReportWire(value: unknown,): value is IntroducedDefectReportWire {
  if (!isJsonRecord(value,))
    return false;
  if (!isJsonArray(value.checks,))
    return false;
  return value.checks
    .every(function eachCheck(check,) {
      return isIntroducedDefectCheckWire(check,);
    },);
}

/**
 * Structured-output constraint for prober calls;
 * client-side validation through {@link isIntroducedDefectReportWire} stays
 * regardless, because per-model schema strictness is unverified.
 *
 * Every field is required rather than optional, and negative verdicts carry
 * empty strings, because optional properties are where per-model structured
 * output diverges most and a lost voice costs a whole region's telemetry.
 */
export const INTRODUCED_DEFECT_RESPONSE_FORMAT: JsonSchemaResponseFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'introduced_defect_report',
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
              'region',
              'verdict',
              'category',
              'severity',
              'evidence',
              'reason',
            ],
            additionalProperties: false,
            properties: {
              region: { type: 'integer', },
              verdict: { type: 'string', },
              category: { type: 'string', },
              severity: { type: 'string', },
              evidence: { type: 'string', },
              reason: { type: 'string', },
            },
          },
        },
      },
    },
  },
};

//endregion Introduced-defect probe wire
