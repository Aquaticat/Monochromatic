import {
  type BallotVerdict,
  isPanelVoteState,
  type PanelBallot,
} from './adjudicate-model.ts';
import type { JsonSchemaResponseFormat, } from './chat-contract.ts';
import { isIssueSeverity, } from './issue-taxonomy.ts';
import {
  isJsonArray,
  isJsonRecord,
} from './json-guard.ts';

//region Adjudication wire format
// What panelists actually emit: integer claim references, closed-vocabulary
// votes, optional severity re-grades, and same-defect group opinions.
// Resolution maps integers back to ids through the prompt plan and fails
// closed per item: a bad verdict becomes a finding and an abstention, never
// an exception, because ballot irregularities are scorecard data.

/**
 * One verdict as a panelist reports it.
 *
 * @example
 * ```ts
 * const wire: PanelVerdictWire = { claim: 1, vote: 'supported', };
 * ```
 */
export type PanelVerdictWire = {
  /**
   * One-based claim number from the prompt sheet.
   */
  readonly claim: number;

  /**
   * Vote string; validated against the closed vocabulary at resolution.
   */
  readonly vote: string;

  /**
   * Optional severity re-grade; validated at resolution.
   */
  readonly severity?: string;
};

/**
 * One group opinion as a panelist reports it.
 *
 * @example
 * ```ts
 * const wire: PanelGroupWire = { group: 1, sameDefect: true, };
 * ```
 */
export type PanelGroupWire = {
  /**
   * One-based group number from the prompt sheet.
   */
  readonly group: number;

  /**
   * Whether the group's claims describe one single defect.
   */
  readonly sameDefect: boolean;
};

/**
 * Whole ballot on the wire.
 *
 * @example
 * ```ts
 * const wire: PanelBallotWire = { verdicts: [], groups: [], };
 * ```
 */
export type PanelBallotWire = {
  /**
   * Every verdict cast.
   */
  readonly verdicts: readonly PanelVerdictWire[];

  /**
   * Group opinions; optional because single-claim sheets have none.
   */
  readonly groups?: readonly PanelGroupWire[];
};

/**
 * Guards one wire verdict.
 *
 * @param value - candidate from parsed model JSON
 *
 * @returns Whether value carries the required verdict fields
 *
 * @example
 * ```ts
 * isPanelVerdictWire({ claim: 1, vote: 'supported', },);
 * ```
 */
function isPanelVerdictWire(value: unknown,): value is PanelVerdictWire {
  if (!isJsonRecord(value,))
    return false;

  /**
   * Claim reference as reported; integerness checked on the primitive copy.
   */
  const { claim, } = value;
  if ((typeof claim) !== 'number')
    return false;
  if ((claim % 1) !== 0)
    return false;
  if ((typeof value.vote) !== 'string')
    return false;
  return (value.severity === undefined) || ((typeof value.severity) === 'string');
}

/**
 * Guards one wire group opinion.
 *
 * @param value - candidate from parsed model JSON
 *
 * @returns Whether value carries the required group fields
 *
 * @example
 * ```ts
 * isPanelGroupWire({ group: 1, sameDefect: false, },);
 * ```
 */
function isPanelGroupWire(value: unknown,): value is PanelGroupWire {
  if (!isJsonRecord(value,))
    return false;

  /**
   * Group reference as reported; integerness checked on the primitive copy.
   */
  const { group, } = value;
  if ((typeof group) !== 'number')
    return false;
  if ((group % 1) !== 0)
    return false;
  return (typeof value.sameDefect) === 'boolean';
}

/**
 * Guards a whole ballot.
 *
 * @param value - parsed model JSON
 *
 * @returns Whether value is a wire ballot
 *
 * @example
 * ```ts
 * const outcome = await client.chatJson({ ..., validate: isPanelBallotWire, },);
 * ```
 */
export function isPanelBallotWire(value: unknown,): value is PanelBallotWire {
  if (!isJsonRecord(value,))
    return false;
  if (!isJsonArray(value.verdicts,))
    return false;
  if (!value.verdicts
    .every(function eachVerdict(verdict,) {
    return isPanelVerdictWire(verdict,);
  },))
    return false;
  if (value.groups === undefined)
    return true;
  if (!isJsonArray(value.groups,))
    return false;
  return value.groups
    .every(function eachGroup(group,) {
    return isPanelGroupWire(group,);
  },);
}

/**
 * Structured-output constraint for panel calls;
 * client-side validation through {@link isPanelBallotWire} stays regardless,
 * because per-model schema strictness is unverified.
 */
export const ADJUDICATION_RESPONSE_FORMAT: JsonSchemaResponseFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'panel_ballot',
    schema: {
      type: 'object',
      required: ['verdicts',],
      additionalProperties: false,
      properties: {
        verdicts: {
          type: 'array',
          items: {
            type: 'object',
            required: [
              'claim',
              'vote',
            ],
            additionalProperties: false,
            properties: {
              claim: { type: 'integer', },
              vote: { type: 'string', },
              severity: { type: 'string', },
            },
          },
        },
        groups: {
          type: 'array',
          items: {
            type: 'object',
            required: [
              'group',
              'sameDefect',
            ],
            additionalProperties: false,
            properties: {
              group: { type: 'integer', },
              sameDefect: { type: 'boolean', },
            },
          },
        },
      },
    },
  },
};

/**
 * Resolves one wire ballot into id-keyed verdicts through the prompt plan.
 * Fails closed per item: out-of-range or duplicate references and unknown
 * votes become findings, an invalid severity drops only the re-grade, and
 * claims left without a verdict are recorded and abstain at tally time.
 *
 * @param wire - ballot as the panelist reported it
 *
 * @param claimIds - claim ids in prompt numbering order
 *
 * @param clusterIds - cluster ids in prompt numbering order
 *
 * @returns Resolved ballot with findings as data
 *
 * @example
 * ```ts
 * const ballot = resolvePanelBallot({ wire, claimIds, clusterIds, },);
 * ```
 */
export function resolvePanelBallot(
  {
    wire,
    claimIds,
    clusterIds,
  }: {
    readonly wire: PanelBallotWire;
    readonly claimIds: readonly string[];
    readonly clusterIds: readonly string[];
  },
): PanelBallot {
  /**
   * Findings accumulated across every wire item.
   */
  const findings: string[] = [];

  /**
   * Resolved verdicts keyed by claim id; first occurrence wins.
   */
  const verdicts: Record<string, BallotVerdict> = {};
  for (const verdict of wire.verdicts) {
    /**
     * Claim id referenced by this verdict's one-based number.
     */
    const claimId = claimIds[verdict.claim - 1];
    if ((verdict.claim < 1) || (claimId === undefined)) {
      findings.push(`verdict-index-out-of-range (${verdict.claim})`,);
      continue;
    }
    if (verdicts[claimId] !== undefined) {
      findings.push(`duplicate-verdict (${verdict.claim})`,);
      continue;
    }
    if (!isPanelVoteState(verdict.vote,)) {
      findings.push(`unknown-vote (${verdict.vote})`,);
      continue;
    }
    if ((verdict.severity !== undefined) && (!isIssueSeverity(verdict.severity,))) {
      findings.push(`unknown-regrade-severity (${verdict.severity})`,);
      verdicts[claimId] = { vote: verdict.vote, };
      continue;
    }
    verdicts[claimId] = {
      vote: verdict.vote,
      ...(verdict.severity === undefined ? {} : { severity: verdict.severity, }),
    };
  }
  for (const [index, claimId,] of claimIds.entries()) {
    if (verdicts[claimId] === undefined)
      findings.push(`missing-verdict (${index + 1})`,);
  }

  /**
   * Resolved group opinions keyed by cluster id; first occurrence wins.
   */
  const mergeOpinions: Record<string, boolean> = {};
  for (const group of wire.groups ?? []) {
    /**
     * Cluster id referenced by this opinion's one-based number.
     */
    const clusterId = clusterIds[group.group - 1];
    if ((group.group < 1) || (clusterId === undefined)) {
      findings.push(`group-index-out-of-range (${group.group})`,);
      continue;
    }
    if (mergeOpinions[clusterId] !== undefined) {
      findings.push(`duplicate-group-opinion (${group.group})`,);
      continue;
    }
    mergeOpinions[clusterId] = group.sameDefect;
  }

  return {
    verdicts,
    mergeOpinions,
    findings,
  };
}

//endregion Adjudication wire format
