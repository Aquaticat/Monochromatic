import type { JsonSchemaResponseFormat, } from './chat-contract.ts';
import type {
  DocumentSide,
  IssueClaim,
  SpanAnchor,
} from './issue-model.ts';
import {
  isIssueCategory,
  isIssueSeverity,
} from './issue-taxonomy.ts';
import {
  isJsonArray,
  isJsonRecord,
} from './json-guard.ts';
import {
  type AnchorTarget,
  validateIssueClaim,
} from './validate-issue.ts';

//region Critic wire format
// What critics actually emit: category, severity, one-sentence summary, and exact
// quotes. Models cannot know node ids or hashes, so anchoring is deterministic
// resolution work done here: locate each quote, reject absence and ambiguity, bind
// to the containing block, and gate the result through span validation. Resolution
// failures are data for the scorecard, never exceptions.

/**
 * One issue as a critic reports it on the wire.
 *
 * @example
 * ```ts
 * const wire: CriticIssueWire = {
 *   category: 'accuracy/omission',
 *   severity: 'major',
 *   summary: 'Second clause is untranslated.',
 *   sourceQuote: '也喜欢追蝴蝶',
 *   targetQuote: 'The cat likes to nap in the sun.',
 * };
 * ```
 */
export type CriticIssueWire = {
  /**
   * Category slug; validated against the closed taxonomy at resolution.
   */
  readonly category: string;

  /**
   * Severity; validated at resolution.
   */
  readonly severity: string;

  /**
   * One-sentence statement of the single defect claimed.
   */
  readonly summary: string;

  /**
   * Exact substring of the original document, when the defect has a
   * source-side anchor.
   */
  readonly sourceQuote?: string;

  /**
   * Exact substring of the translation, when the defect has a
   * target-side anchor.
   */
  readonly targetQuote?: string;
};

/**
 * Whole critic reply on the wire.
 *
 * @example
 * ```ts
 * const report: CriticReportWire = { issues: [], };
 * ```
 */
export type CriticReportWire = {
  /**
   * Every issue found; empty means the critic found nothing.
   */
  readonly issues: readonly CriticIssueWire[];
};

/**
 * Guards one wire issue.
 *
 * @param value - candidate from parsed model JSON
 *
 * @returns Whether value carries the required wire fields
 *
 * @example
 * ```ts
 * isCriticIssueWire({ category: 'x', severity: 'y', summary: 'z', },);
 * ```
 */
function isCriticIssueWire(value: unknown,): value is CriticIssueWire {
  if (!isJsonRecord(value,))
    return false;
  if ((typeof value.category) !== 'string')
    return false;
  if ((typeof value.severity) !== 'string')
    return false;
  if ((typeof value.summary) !== 'string')
    return false;
  if ((value.sourceQuote !== undefined) && ((typeof value.sourceQuote) !== 'string'))
    return false;
  return (value.targetQuote === undefined) || ((typeof value.targetQuote) === 'string');
}

/**
 * Guards a whole critic reply.
 *
 * @param value - parsed model JSON
 *
 * @returns Whether value is a wire report
 *
 * @example
 * ```ts
 * const outcome = await client.chatJson({ ..., validate: isCriticReportWire, },);
 * ```
 */
export function isCriticReportWire(value: unknown,): value is CriticReportWire {
  if (!isJsonRecord(value,))
    return false;
  if (!isJsonArray(value.issues,))
    return false;
  return value
    .issues
    .every(function eachIssue(issue,) {
      return isCriticIssueWire(issue,);
    },);
}

/**
 * Structured-output constraint for critic calls;
 * client-side validation through {@link isCriticReportWire} stays regardless,
 * because per-model schema strictness is unverified.
 */
export const CRITIC_RESPONSE_FORMAT: JsonSchemaResponseFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'critic_report',
    schema: {
      type: 'object',
      required: ['issues',],
      additionalProperties: false,
      properties: {
        issues: {
          type: 'array',
          items: {
            type: 'object',
            required: [
              'category',
              'severity',
              'summary',
            ],
            additionalProperties: false,
            properties: {
              category: { type: 'string', },
              severity: { type: 'string', },
              summary: { type: 'string', },
              sourceQuote: { type: 'string', },
              targetQuote: { type: 'string', },
            },
          },
        },
      },
    },
  },
};

/**
 * Outcome of resolving one wire issue into an anchored claim.
 *
 * @example
 * ```ts
 * const resolution: CriticIssueResolution = { resolved: false, reason: 'quote-not-found (target)', };
 * ```
 */
export type CriticIssueResolution =
  | {
    /**
     * Every quote anchored and validated.
     */
    readonly resolved: true;

    /**
     * Anchored atomic claim ready for adjudication or grading.
     */
    readonly claim: IssueClaim;
  }
  | {
    /**
     * Some step refused; the reason feeds the scorecard.
     */
    readonly resolved: false;

    /**
     * Which step failed and why, in scorecard-stable wording.
     */
    readonly reason: string;
  };

/**
 * Locates one exact quote inside one document and binds it to its block.
 *
 * @param document - side being searched
 *
 * @param side - which side the anchor belongs to
 *
 * @param quote - exact substring the critic claims
 *
 * @returns Anchor, or the failure reason
 *
 * @example
 * ```ts
 * const located = locateQuote({ document, side: 'target', quote, },);
 * ```
 */
function locateQuote(
  {
    document,
    side,
    quote,
  }: {
    readonly document: AnchorTarget;
    readonly side: DocumentSide;
    readonly quote: string;
  },
):
  | {
    readonly located: true;
    readonly anchor: SpanAnchor;
  }
  | {
    readonly located: false;
    readonly reason: string;
  }
{
  if (quote === '') {
    return {
      located: false,
      reason: `empty-quote (${side})`,
    };
  }

  /**
   * First occurrence of the quote.
   */
  const at = document
    .text
    .indexOf(quote,);
  if (at === (-1)) {
    return {
      located: false,
      reason: `quote-not-found (${side})`,
    };
  }
  if (document
    .text
    .includes(
      quote,
      at + 1,
    ))
  {
    return {
      located: false,
      reason: `ambiguous-quote (${side})`,
    };
  }

  /**
   * End of the quoted region.
   */
  const end = at + quote.length;

  /**
   * Block containing the whole quote, when the quote does not cross blocks.
   */
  const node = document
    .nodes
    .find(function containing(candidate,) {
      return (at >= candidate.startOffset) && (end <= candidate.endOffset);
    },);
  if (node === undefined) {
    return {
      located: false,
      reason: `quote-crosses-blocks (${side})`,
    };
  }

  return {
    located: true,
    anchor: {
      side,
      nodeId: node.id,
      nodeHash: node.contentHash,
      startOffset: at,
      endOffset: end,
      quotedText: quote,
    },
  };
}

/**
 * Resolves one wire issue into an anchored, validated claim.
 * Category and severity must belong to the closed vocabularies;
 * each present quote must locate uniquely inside one block;
 * the assembled claim must pass deterministic span validation.
 *
 * @param wire - issue as the critic reported it
 *
 * @param documents - current pair anchors resolve against
 *
 * @returns Anchored claim, or the failure reason as data
 *
 * @example
 * ```ts
 * const resolution = resolveCriticIssue({ wire, documents, },);
 * if (resolution.resolved) grade(resolution.claim,);
 * ```
 */
export function resolveCriticIssue(
  {
    wire,
    documents,
  }: {
    readonly wire: CriticIssueWire;
    readonly documents: Readonly<Record<DocumentSide, AnchorTarget>>;
  },
): CriticIssueResolution {
  if (!isIssueCategory(wire.category,)) {
    return {
      resolved: false,
      reason: `unknown-category (${wire.category})`,
    };
  }
  if (!isIssueSeverity(wire.severity,)) {
    return {
      resolved: false,
      reason: `unknown-severity (${wire.severity})`,
    };
  }

  /**
   * Quotes present on the wire, paired with their sides.
   */
  const quotes: readonly {
    readonly side: DocumentSide;
    readonly quote: string;
  }[] = [
    ...(wire.sourceQuote === undefined
      ? []
      : [{
        side: 'source' as const,
        quote: wire.sourceQuote,
      },]),
    ...(wire.targetQuote === undefined
      ? []
      : [{
        side: 'target' as const,
        quote: wire.targetQuote,
      },]),
  ];
  if (quotes.length === 0) {
    return {
      resolved: false,
      reason: 'no-quotes',
    };
  }

  /**
   * Located anchors in side order; first failure wins.
   */
  const anchors: SpanAnchor[] = [];
  for (
    const {
      side,
      quote,
    } of quotes
  ) {
    /**
     * Location attempt for this side's quote.
     */
    const located = locateQuote({
      document: documents[side],
      side,
      quote,
    },);
    if (!located.located) {
      return {
        resolved: false,
        reason: located.reason,
      };
    }
    anchors.push(located.anchor,);
  }

  /**
   * Assembled claim awaiting the deterministic gate.
   */
  const claim: IssueClaim = {
    category: wire.category,
    severity: wire.severity,
    summary: wire.summary,
    spans: anchors,
  };

  /**
   * Final deterministic gate; failures here mean resolution built a bad
   * anchor, and the claim must not pass as if it were validated.
   */
  const rejections = validateIssueClaim({
    claim,
    documents,
  },);
  if (rejections.length > 0) {
    return {
      resolved: false,
      reason: `anchor-validation (${
        rejections.map(function toKind(rejection,) {
          return rejection.kind;
        },)
          .join(',',)
      })`,
    };
  }

  return {
    resolved: true,
    claim,
  };
}

//endregion Critic wire format
