import {
  isJsonArray,
  isJsonRecord,
} from './json-guard.ts';
import type {
  GradableClaim,
  GradableIssue,
  GradableSpan,
} from './sample-grading.ts';

//region Artifact reading
// Parses a run artifact's JSON back into the accepted issues that form the
// precision denominator. This is a MEASUREMENT INSTRUMENT, not a lenient
// deserializer: a malformed accepted issue is surfaced loudly (thrown), never
// skipped, because silently dropping one would shrink the accepted population
// and bias the graded precision. Non-accepted issues (rejected, needs-human)
// are legitimately excluded -- they are not accepted, so not in the
// denominator. Category and severity stay plain display strings, so no
// off-taxonomy value is ever a reason to drop an issue.

/**
 * Thrown when an artifact, or an accepted issue within it, is structurally
 * malformed. Aborting loudly is deliberate: a skipped accepted issue would
 * bias the precision denominator without a trace.
 */
export class ArtifactParseError extends Error {
  /**
   * Builds failure naming the malformed path.
   *
   * @param path - dotted path to the malformed value
   *
   * @param reason - what the value was expected to be
   *
   * @example
   * ```ts
   * throw new ArtifactParseError({ path: 'Kitten issues[3].issue.status', reason: 'a string', },);
   * ```
   */
  public constructor(
    {
      path,
      reason,
    }: {
      readonly path: string;
      readonly reason: string;
    },
  ) {
    super(`artifact parse failed at ${path}: expected ${reason}.`,);
    this.name = 'ArtifactParseError';
  }
}

/**
 * Reads a required string, throwing when the value is any other shape.
 *
 * @param value - value to check
 *
 * @param path - dotted path for the error message
 *
 * @returns The value as a string
 */
function requireString(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): string {
  if ((typeof value) !== 'string')
    throw new ArtifactParseError({
      path,
      reason: 'a string',
    },);
  return value;
}

/**
 * Reads a required record, throwing when the value is any other shape.
 *
 * @param value - value to check
 *
 * @param path - dotted path for the error message
 *
 * @returns The value as a record
 */
function requireRecord(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): Record<string, unknown> {
  if (!isJsonRecord(value,))
    throw new ArtifactParseError({
      path,
      reason: 'an object',
    },);
  return value;
}

/**
 * Reads a required array, throwing when the value is any other shape.
 *
 * @param value - value to check
 *
 * @param path - dotted path for the error message
 *
 * @returns The value as an array
 */
function requireArray(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): readonly unknown[] {
  if (!isJsonArray(value,))
    throw new ArtifactParseError({
      path,
      reason: 'an array',
    },);
  return value;
}

/**
 * Parses one span, requiring a known side and a quoted-text string.
 *
 * @param value - the span JSON
 *
 * @param path - dotted path for the error message
 *
 * @returns The gradable span
 */
function parseSpan(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): GradableSpan {
  /**
   * The span as a record.
   */
  const record = requireRecord({
    value,
    path,
  },);

  /**
   * The claimed document side; only source and target are valid.
   */
  const {side} = record;
  if ((side !== 'source') && (side !== 'target'))
    throw new ArtifactParseError({
      path: `${path}.side`,
      reason: "'source' or 'target'",
    },);

  return {
    side,
    quotedText: requireString({
      value: record.quotedText,
      path: `${path}.quotedText`,
    },),
  };
}

/**
 * Parses one member claim wrapper into its gradable claim.
 *
 * @param value - the member (aggregated-claim) JSON
 *
 * @param path - dotted path for the error message
 *
 * @returns The wrapped gradable claim
 */
function parseMember(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): { readonly claim: GradableClaim; } {
  /**
   * The member as a record.
   */
  const member = requireRecord({
    value,
    path,
  },);

  /**
   * The inner claim as a record.
   */
  const claim = requireRecord({
    value: member.claim,
    path: `${path}.claim`,
  },);

  /**
   * The claim's anchored spans.
   */
  const spans = requireArray({
    value: claim.spans,
    path: `${path}.claim.spans`,
  },)
    .map(function parseSpanAt(
      spanValue,
      spanIndex,
    ) {
      return parseSpan({
        value: spanValue,
        path: `${path}.claim.spans[${String(spanIndex,)}]`,
      },);
    },);

  return {
    claim: {
      category: requireString({
        value: claim.category,
        path: `${path}.claim.category`,
      },),
      summary: requireString({
        value: claim.summary,
        path: `${path}.claim.summary`,
      },),
      spans,
    },
  };
}

/**
 * Parses one accepted issue into its gradable shape.
 *
 * @param issue - the issue record (already confirmed accepted)
 *
 * @param path - dotted path for the error message
 *
 * @returns The gradable issue
 */
function parseAcceptedIssue(
  {
    issue,
    path,
  }: {
    readonly issue: Readonly<Record<string, unknown>>;
    readonly path: string;
  },
): GradableIssue {
  return {
    issueId: requireString({
      value: issue.issueId,
      path: `${path}.issueId`,
    },),
    severity: requireString({
      value: issue.severity,
      path: `${path}.severity`,
    },),
    claims: requireArray({
      value: issue.claims,
      path: `${path}.claims`,
    },)
      .map(function parseMemberAt(
        memberValue,
        memberIndex,
      ) {
        return parseMember({
          value: memberValue,
          path: `${path}.claims[${String(memberIndex,)}]`,
        },);
      },),
  };
}

/**
 * One artifact's settled identity and its accepted issues.
 *
 * @example
 * ```ts
 * const parsed: ParsedArtifact = {
 *   id: 'MushroomGuuuu',
 *   status: 'repaired',
 *   acceptedIssues: [],
 * };
 * ```
 */
export type ParsedArtifact = {
  /**
   * Corpus entry id.
   */
  readonly id: string;

  /**
   * Settled status the artifact carries (repaired, unchanged, or blocked).
   */
  readonly status: string;

  /**
   * Every accepted issue, the precision denominator for this entry.
   */
  readonly acceptedIssues: readonly GradableIssue[];
};

/**
 * Parses a run artifact into its accepted issues. Every issue is inspected: a
 * malformed accepted issue throws {@link ArtifactParseError} rather than being
 * skipped, so the accepted population is never silently short. Non-accepted
 * issues are excluded because they are not part of the precision denominator.
 *
 * @param value - the artifact JSON, freshly parsed and still untyped
 *
 * @returns The entry id, status, and accepted issues
 *
 * @throws {@link ArtifactParseError} when the artifact or an accepted issue is
 * structurally malformed
 *
 * @example
 * ```ts
 * const parsed = parseSettledArtifact({
 *   value: JSON.parse(await readFile(path, 'utf8',),),
 * },);
 * ```
 */
export function parseSettledArtifact(
  { value, }: { readonly value: unknown; },
): ParsedArtifact {
  /**
   * The artifact as a record.
   */
  const artifact = requireRecord({
    value,
    path: 'artifact',
  },);

  /**
   * Entry id, used both in the result and in nested error paths.
   */
  const id = requireString({
    value: artifact.id,
    path: 'artifact.id',
  },);

  /**
   * Settled status string.
   */
  const status = requireString({
    value: artifact.status,
    path: `${id}.status`,
  },);

  /**
   * Accepted issues gathered across every issue record.
   */
  const acceptedIssues: readonly GradableIssue[] = requireArray({
    value: artifact.issues,
    path: `${id}.issues`,
  },)
    .flatMap(function acceptedAt(
      recordValue,
      recordIndex,
    ) {
      /**
       * The issue record wrapper at this index.
       */
      const record = requireRecord({
        value: recordValue,
        path: `${id}.issues[${String(recordIndex,)}]`,
      },);

      /**
       * The adjudicated issue inside the record.
       */
      const issue = requireRecord({
        value: record.issue,
        path: `${id}.issues[${String(recordIndex,)}].issue`,
      },);

      /**
       * The issue's fate; must be readable to classify it.
       */
      const issueStatus = requireString({
        value: issue.status,
        path: `${id}.issues[${String(recordIndex,)}].issue.status`,
      },);

      if (issueStatus !== 'accepted')
        return [];

      return [
        parseAcceptedIssue({
          issue,
          path: `${id}.issues[${String(recordIndex,)}].issue`,
        },),
      ];
    },);

  return {
    id,
    status,
    acceptedIssues,
  };
}

//endregion Artifact reading
