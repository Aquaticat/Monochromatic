import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';

import type { AdjudicatedIssue, } from './adjudicate-model.ts';
import type { JsonSchemaResponseFormat, } from './chat-contract.ts';
import {
  isJsonArray,
  isJsonRecord,
} from './json-guard.ts';
import { selectFence, } from './prompt-fence.ts';
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
// must quote verbatim wording, which `introduced-defect-screen.ts` then checks
// deterministically.
//
// A claim anchors in one of two directions and never both, because damage comes
// in two shapes. Added wording is quoted from the AFTER text; content the edit
// DROPPED has nothing in the AFTER text to quote, its absence being the defect,
// so it is quoted from the BEFORE text instead. Accepting only forward quotes
// would have left omission, the likeliest damage a rewriting editor causes,
// permanently unprovable.


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
/**
 * Which edit a probe run is auditing.
 *
 * The question is identical for both and the rules below are shared; only what
 * the editor was TRYING to do differs, and that changes what a prober should
 * expect to see. Telling a prober that an edit was fixing defects, when it was
 * actually rewriting already-repaired text for fluency, invites them to read
 * every rephrasing as a failed repair.
 *
 * @example
 * ```ts
 * const kind: ProbedEditKind = 'naturalness-refinement';
 * ```
 */
export type ProbedEditKind = 'accuracy-repair' | 'naturalness-refinement';

/**
 * Opening framing per edit kind, prepended to the shared rules.
 */
const PROBE_FRAMING: Readonly<Record<ProbedEditKind, string>> = {
  'accuracy-repair':
    `Editors replaced the BEFORE text of each numbered region with its AFTER text, trying to fix defects that were ALREADY THERE.`,
  'naturalness-refinement':
    `A later pass rewrote the BEFORE text of each numbered region into its AFTER text for NATURALNESS ALONE.
It was NOT fixing defects. Any listed issue was already repaired in the BEFORE text, so a rephrasing that keeps the meaning is the edit working as intended, not a failure.`,
};

/**
 * The one rule that names what the editor was doing, per edit kind.
 *
 * Kept per kind rather than neutralised into "the edit" because the two lanes
 * really are doing different things, and a prober told the wrong one reads
 * every rephrasing as a failed repair.
 *
 * This comment used to say the accuracy prompt was byte-identical to the one
 * every artifact had been produced under, so telemetry stayed comparable across
 * runs. That is no longer true and the comparability is no longer worth having.
 * The old prompt asked whether the replacement introduced a defect the BEFORE
 * text did not have, which made the pre-edit TRANSLATION the standard of
 * accuracy. Read back, every claim it produced argued from the before text, and
 * one called a corrected mistranslation an introduced inaccuracy. A series of
 * readings taken through that question measured whether an edit CHANGED
 * anything, so preserving comparability with it would preserve a measurement of
 * the wrong quantity.
 */
const PROBE_CREATED_CLAUSE: Readonly<Record<ProbedEditKind, string>> = {
  'accuracy-repair':
    `- DO report a distinct defect created while attempting the repair, even where it concerns the same source passage as a pre-existing issue.`,
  'naturalness-refinement':
    `- DO report a distinct defect the rewrite created, even where it concerns the same source passage as a pre-existing issue.`,
};

/**
 * Rules preceding the per-kind clause.
 */
const PROBE_RULES_HEAD =
  `Judge ONLY this: does the AFTER text misrepresent the ORIGINAL in a way the BEFORE text did not?

THE ORIGINAL IS THE ONLY STANDARD OF ACCURACY. The BEFORE text is a translation and may itself be wrong. Correcting it is the edit working, not damage.

Rules:
- A change that brings the AFTER text CLOSER to the ORIGINAL is NEVER damage, however much text it rewrites.
- Content the AFTER text drops is damage ONLY IF THE ORIGINAL SUPPORTS IT. Dropping wording the ORIGINAL never had is a correct repair, not an omission.
- Wording the AFTER text adds is damage only if the ORIGINAL does not support it.
- "It was in the BEFORE text" is NOT a reason. Say what the ORIGINAL says and how the AFTER text departs from it.
- Do NOT report a listed pre-existing issue merely because the replacement failed to fix it. That is not damage.
- Do NOT report a defect that is present in BOTH the BEFORE text and the AFTER text. It was not introduced.`;

/**
 * Rules and reply contract following the per-kind clause.
 */
const PROBE_RULES_TAIL = `- Stylistic preference is NOT a defect. A different word being nicer is not damage. Report only concrete loss of accuracy, grammar, coherence, or consistency.

Verdicts:
- introduced-defect: the replacement caused a specific defect absent from BEFORE
- no-introduced-defect-found: you looked and found no defect the replacement caused; the region may still be imperfect
- uncertain: you cannot tell from what you were shown

For introduced-defect, anchor the claim with EXACTLY ONE of these, never both:
- "evidence": the exact damaged wording quoted FROM THE AFTER TEXT, when the edit ADDED or altered something. Leave "omittedText" empty.
- "omittedText": the exact wording quoted FROM THE BEFORE TEXT that the edit DROPPED, when the defect is missing content. Leave "evidence" empty.
Quote verbatim. A paraphrase cannot be checked and the claim will be discarded.
Say in "reason" what the ORIGINAL says and how the AFTER text departs from it. A reason that only cites the BEFORE text has not judged accuracy at all.
Leave "evidence", "omittedText", "category", "severity" and "reason" as empty strings for other verdicts.
Reply with ONLY a JSON object of shape {"checks": [{"region": 1, "verdict": "no-introduced-defect-found", "category": "", "severity": "", "evidence": "", "omittedText": "", "reason": ""}]}. No prose, no code fences.
Every region number must appear exactly once in checks.`;

/**
 * Composes the prober's system prompt for one edit kind.
 *
 * Composed rather than substituted into a placeholder: the framing is prose
 * built from a closed set, and a template with a marker in it is a small
 * grammar that arbitrary text could later be interpolated into.
 *
 * @param editKind - which edit this run audits
 *
 * @returns System prompt with the matching framing
 *
 * @example
 * ```ts
 * const prompt = probeSystemPrompt({ editKind: 'accuracy-repair', },);
 * ```
 */
function probeSystemPrompt(
  { editKind, }: { readonly editKind: ProbedEditKind; },
): string {
  return `You are a strict bilingual translation reviewer auditing an edit for collateral damage.
${PROBE_FRAMING[editKind]}
${PROBE_RULES_HEAD}
${PROBE_CREATED_CLAUSE[editKind]}
${PROBE_RULES_TAIL}`;
}

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
 * Whether a prober is shown the accepted issues its region was cut for.
 *
 * `rendered` was the only behaviour until it was measured. Listing the issues
 * and forbidding a prober from re-reporting them silenced the stage: across 45
 * verdicts on regions a reader called damaged it raised 2 admissible claims,
 * and the same regions with the list withheld raised 18. It answered
 * undamaged regions the same way, 0.033 against 0.044, so its output barely
 * depended on its input.
 *
 * `withheld` moves that defence to `introduced-defect-screen.ts`, which
 * dismisses a claim quoting wording an accepted issue already complained
 * about. The prober then reads the text without being told what to excuse, and
 * the excusing happens where it can be checked.
 *
 * @example
 * ```ts
 * const disclosure: PriorIssueDisclosure = 'withheld';
 * ```
 */
export type PriorIssueDisclosure = 'rendered' | 'withheld';

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
 * @param editKind - which edit is being audited; defaults to the accuracy
 * repair so the stage this prompt was written for is unchanged
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
    editKind = 'accuracy-repair',
    disclosure = 'rendered',
  }: {
    readonly sourceText: string;
    readonly baselineText: string;
    readonly regions: readonly RepairRegion[];
    readonly issues: readonly AdjudicatedIssue[];
    readonly editKind?: ProbedEditKind;
    readonly disclosure?: PriorIssueDisclosure;
  },
): IntroducedDefectPromptPlan {
  /**
   * Fence no enclosed text can reproduce.
   *
   * Chosen against every text this sheet carries rather than fixed, because all
   * of them are arbitrary prose: a setext heading underline is an ordinary row
   * of equals signs, and a translation may contain one. A fixed fence would let
   * a region close its own block and have the rest of its text read as sheet
   * structure, which is how a corpus paragraph gets to invent a region.
   */
  const fence = selectFence({
    texts: [
      sourceText,
      baselineText,
      ...regions.flatMap(function toTexts(region,) {
        return [
          region.before,
          region.editorAfter,
        ];
      },),
    ],
  },);

  /**
   * Rendered region blocks in numbering order.
   */
  const blocks = regions.map(function toBlock(
    region,
    index,
  ) {
    return `${fence} REGION ${index + 1} ${fence}${
      disclosure === 'rendered'
        ? `
PRE-EXISTING DEFECTS THIS EDIT TARGETED (these are NOT your findings):
${renderPriorIssues({
          region,
          issues,
        },)}`
        : ''
    }
${fence} BEFORE ${String(index + 1,)} ${fence}
${region.before}
${fence} AFTER ${String(index + 1,)} ${fence}
${region.editorAfter}`;
  },);

  return {
    messages: [
      {
        role: 'system',
        content: probeSystemPrompt({ editKind, },),
      },
      {
        role: 'user',
        content: `${fence} ORIGINAL ${fence}
${sourceText}
${fence} BASELINE TRANSLATION ${fence}
${baselineText}
${fence} REPLACED REGIONS ${fence}
${blocks.join('\n\n',)}
${fence} END ${fence}`,
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
   * Wording quoted from the BEFORE text that the edit dropped.
   *
   * Omission damage has no wording in the AFTER text to point at, since its
   * absence IS the defect, so a probe accepting only forward quotes could never
   * corroborate the likeliest kind of collateral damage an editor causes.
   */
  readonly omittedText: string;

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
    'omittedText',
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
              'omittedText',
              'reason',
            ],
            additionalProperties: false,
            properties: {
              region: { type: 'integer', },
              verdict: { type: 'string', },
              category: { type: 'string', },
              severity: { type: 'string', },
              evidence: { type: 'string', },
              omittedText: { type: 'string', },
              reason: { type: 'string', },
            },
          },
        },
      },
    },
  },
};

//endregion Introduced-defect probe wire
