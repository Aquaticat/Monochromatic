import {
  collapseSoftLineBreaks,
  normalizePunctuation,
} from './quote-normalize.ts';
import {
  CANDIDATE_ONLY_CATEGORIES,
  PAIRED_CATEGORIES,
  RENDERING_AUDIT_CATEGORIES,
  type RenderingAuditCategory,
  type RenderingAuditFindingWire,
  RENDERING_AUDIT_VERDICTS,
  type RenderingAuditReportWire,
  type RenderingAuditVerdict,
  SOURCE_ONLY_CATEGORIES,
} from './rendering-audit-wire.ts';

//region Rendering audit screen
// What survives of one auditor's answer once the quotes are checked against the
// texts, deterministically and without asking anybody.
//
// THE PROMPT IS NOT WHAT MAKES THE ARCHIVE IRRELEVANT. It says so, and a model
// follows that unevenly; what enforces it is that an original quote is searched
// in the ORIGINAL and nowhere else, so a claim resting on the archive's wording
// anchors nowhere and is dropped with the finding on it.
//
// EACH CATEGORY PROVES ITSELF FROM THE SIDE IT CAN. Content the candidate never
// rendered has nothing in the candidate to quote, so demanding a candidate span
// for an omission would make omission unprovable, which is the likeliest defect
// a from-scratch rendering has. An addition nothing supports is the mirror. A
// changed number, actor or polarity is stated by both and must quote both.
//
// A QUOTE HAS TO IDENTIFY ITS SPAN, not merely occur. A quote occurring twice in
// the text it names does not say which occurrence was read, and a very short one
// identifies nothing even when it occurs once; the coverage probe accepted the
// single word `September` as evidence and only an ambiguity check stopped it.
// Both rules run here.
//
// A DROPPED CLAIM IS NOT EVIDENCE OF FIDELITY, and the tally says so separately:
// a voice that reported nothing and a voice whose every claim was dropped are
// different facts, and reading them as one would let a run of unanchored
// answers look like agreement that a rendering is sound.

/**
 * Fewest characters a quote may carry, once canonical, when it names Latin
 * text.
 *
 * Short English words identify nothing: `September` occurs in most of these
 * documents more than once, and `the` in all of them.
 */
const MIN_LATIN_QUOTE_CHARS = 12;

/**
 * Fewest characters a quote may carry when it names text with CJK in it.
 *
 * Lower on purpose rather than by oversight: a Chinese clause carries far more
 * per character, and a twelve-character floor would refuse most honest source
 * spans.
 */
const MIN_CJK_QUOTE_CHARS = 4;

/**
 * What `indexOf` answers when a needle is absent.
 */
const NOT_FOUND = -1;

/**
 * First and last code points of the CJK Unified Ideographs block.
 *
 * Read directly rather than through a regex: this is one range test over the
 * code points of a short string, and a character class would say the same thing
 * less legibly while adding a pattern nobody can bound.
 */
const CJK_FIRST = 0x4E_00;

/**
 * Last code point of that block.
 */
const CJK_LAST = 0x9F_FF;

/**
 * Whether a quote carries any CJK character.
 *
 * @param text - quote to inspect
 *
 * @returns True when at least one character is a CJK ideograph
 *
 * @example
 * ```ts
 * const cjk = carriesCjk({ text: '猫猫', },);
 * ```
 */
function carriesCjk({ text, }: { readonly text: string; },): boolean {
  // OVER UTF-16 UNITS, which is exact for this question and not in general:
  // the block tested lies in the basic plane, and a character outside it is
  // stored as two surrogates, both far above this range, so a supplementary
  // character cannot be read as CJK here.
  for (let index = 0; index < text.length; index += 1) {
    /**
     * Code unit at this position.
     */
    const point = text.codePointAt(index,) ?? 0;
    if ((point >= CJK_FIRST) && (point <= CJK_LAST))
      return true;
  }

  return false;
}

/**
 * One quote read in the broadest form the anchoring accepts.
 *
 * @param text - text to canonicalize
 *
 * @returns Same text with punctuation variants folded and soft line breaks read
 * as spaces
 *
 * @example
 * ```ts
 * const canonical = canonicalize({ text: quote, },);
 * ```
 */
function canonicalize({ text, }: { readonly text: string; },): string {
  return collapseSoftLineBreaks({ text: normalizePunctuation({ text, },), },);
}

/**
 * What checking one quote against one text found.
 *
 * @example
 * ```ts
 * const anchor: QuoteAnchor = { anchored: true, evidence: 'The cat sleeps.', };
 * ```
 */
export type QuoteAnchor = {
  /**
   * Quote identifies exactly one span of the text it names.
   */
  readonly anchored: true;

  /**
   * That span as the TEXT ITSELF holds it, rather than as the auditor typed it,
   * so a report never quotes a document back with wording the document does not
   * carry.
   */
  readonly evidence: string;
} | {
  /**
   * Quote proves nothing, for the stated reason.
   */
  readonly anchored: false;

  /**
   * Which check refused, in wording a tally can group by.
   */
  readonly reason: string;
};

/**
 * Checks one quote against the text it claims to come from.
 *
 * @param text - side the quote names
 *
 * @param quote - span the auditor claims
 *
 * @param side - which side this is, for the refusal wording
 *
 * @returns The text's own wording for the span, or why the quote proves nothing
 *
 * @example
 * ```ts
 * const anchor = anchorQuote({ text: sourceText, quote, side: 'source', },);
 * ```
 */
export function anchorQuote(
  {
    text,
    quote,
    side,
  }: {
    readonly text: string;
    readonly quote: string;
    readonly side: string;
  },
): QuoteAnchor {
  /**
   * Quote in the broadest accepted form.
   */
  const needle = canonicalize({ text: quote, },);

  if (needle === '') {
    return {
      anchored: false,
      reason: `empty-quote (${side})`,
    };
  }

  /**
   * Fewest characters this quote must carry to identify anything.
   */
  const floor = carriesCjk({ text: needle, },) ? MIN_CJK_QUOTE_CHARS : MIN_LATIN_QUOTE_CHARS;

  if (needle.length < floor) {
    return {
      anchored: false,
      reason: `unidentifying-quote (${side})`,
    };
  }

  /**
   * Text in the same form, so a quote copied out of a wrapped paragraph still
   * anchors.
   */
  const haystack = canonicalize({ text, },);

  /**
   * Where the quote first occurs, or nowhere.
   */
  const at = haystack.indexOf(needle,);

  if (at === NOT_FOUND) {
    return {
      anchored: false,
      reason: `unanchored-quote (${side})`,
    };
  }

  if (haystack.includes(
    needle,
    at + 1,
  )) {
    return {
      anchored: false,
      reason: `ambiguous-quote (${side})`,
    };
  }

  // BOTH CANONICAL MAPS REPLACE ONE UTF-16 UNIT WITH ONE, which is what lets
  // these offsets index the stored text and return its own characters.
  return {
    anchored: true,
    evidence: text.slice(
      at,
      at + needle.length,
    ),
  };
}

/**
 * One finding that survived screening.
 *
 * @example
 * ```ts
 * const finding: ScreenedFinding = {
 *   category: 'omission',
 *   sourceEvidence: '猫猫没有离开窗台',
 *   candidateEvidence: '',
 *   reason: 'the clause is absent',
 * };
 * ```
 */
export type ScreenedFinding = {
  /**
   * Category, narrowed to the vocabulary.
   */
  readonly category: RenderingAuditCategory;

  /**
   * Original's own wording for the span this rests on, empty where the category
   * proves itself from the candidate alone.
   */
  readonly sourceEvidence: string;

  /**
   * Candidate's own wording, empty where the category proves itself from the
   * original alone.
   */
  readonly candidateEvidence: string;

  /**
   * What the auditor said the two spans amount to.
   */
  readonly reason: string;
};

/**
 * What one auditor's answer amounts to once screened.
 *
 * @example
 * ```ts
 * const screened: ScreenedReport = { verdict: 'defects-found', findings: [], dropped: ['unanchored-quote (source)',], };
 * ```
 */
export type ScreenedReport = {
  /**
   * Verdict, narrowed to the vocabulary, or `uncertain` when the voice cast one
   * this version does not know.
   */
  readonly verdict: RenderingAuditVerdict;

  /**
   * Findings that proved themselves.
   */
  readonly findings: readonly ScreenedFinding[];

  /**
   * Why each dropped claim was dropped, kept because a voice whose every claim
   * fell is a different fact from a voice that claimed nothing.
   */
  readonly dropped: readonly string[];
};

/**
 * Which sides a category must and must not quote.
 *
 * @param category - category to ask about
 *
 * @returns Whether each side is required
 *
 * @example
 * ```ts
 * const { needsSource, } = quotesRequired({ category: 'omission', },);
 * ```
 */
function quotesRequired(
  { category, }: { readonly category: RenderingAuditCategory; },
): {
  readonly needsSource: boolean;
  readonly needsCandidate: boolean;
} {
  if (SOURCE_ONLY_CATEGORIES.some(function names(one,): boolean {
    return one === category;
  },)) {
    return {
      needsSource: true,
      needsCandidate: false,
    };
  }

  if (CANDIDATE_ONLY_CATEGORIES.some(function names(one,): boolean {
    return one === category;
  },)) {
    return {
      needsSource: false,
      needsCandidate: true,
    };
  }

  // EVERY REMAINING CATEGORY IS PAIRED, stated as a check rather than assumed,
  // so a category added to the vocabulary and forgotten here is refused instead
  // of quietly treated as paired.
  if (!PAIRED_CATEGORIES.some(function names(one,): boolean {
    return one === category;
  },))
    throw new Error(`rendering audit category ${category} belongs to no anchoring rule`,);

  return {
    needsSource: true,
    needsCandidate: true,
  };
}

/**
 * Screens one claimed finding against both texts.
 *
 * @param finding - claim as the auditor sent it
 *
 * @param sourceText - original
 *
 * @param candidateText - rendering under audit
 *
 * @returns The finding with the texts' own wording, or why it was dropped
 *
 * @example
 * ```ts
 * const screened = screenFinding({ finding, sourceText, candidateText, },);
 * ```
 */
function screenFinding(
  {
    finding,
    sourceText,
    candidateText,
  }: {
    readonly finding: RenderingAuditFindingWire;
    readonly sourceText: string;
    readonly candidateText: string;
  },
): ScreenedFinding | { readonly dropped: string; } {
  /**
   * Category, when it is one this version names.
   *
   * FOUND RATHER THAN ASSERTED: the member comes back out of the vocabulary
   * itself, so nothing here claims a string is a category it never checked.
   */
  const category = RENDERING_AUDIT_CATEGORIES.find(function isNamed(one,): boolean {
    return one === finding.category;
  },);

  if (category === undefined)
    return { dropped: `unknown-category (${finding.category})`, };

  /**
   * Which sides this category has to prove itself from.
   */
  const {
    needsSource,
    needsCandidate,
  } = quotesRequired({ category, },);

  /**
   * What the original says, when this category rests on it.
   */
  const source = needsSource
    ? anchorQuote({
      text: sourceText,
      quote: finding.sourceQuote,
      side: 'source',
    },)
    : {
      anchored: true,
      evidence: '',
    } as const;

  if (!source.anchored)
    return { dropped: source.reason, };

  /**
   * What the candidate says, when this category rests on it.
   */
  const candidate = needsCandidate
    ? anchorQuote({
      text: candidateText,
      quote: finding.candidateQuote,
      side: 'candidate',
    },)
    : {
      anchored: true,
      evidence: '',
    } as const;

  if (!candidate.anchored)
    return { dropped: candidate.reason, };

  return {
    category,
    sourceEvidence: source.evidence,
    candidateEvidence: candidate.evidence,
    reason: finding.reason,
  };
}

/**
 * Screens one auditor's whole answer.
 *
 * @param report - reply as the wire guard accepted it
 *
 * @param sourceText - original
 *
 * @param candidateText - rendering under audit
 *
 * @returns Findings that proved themselves, and why the rest fell
 *
 * @example
 * ```ts
 * const screened = screenRenderingAudit({ report, sourceText, candidateText, },);
 * ```
 */
export function screenRenderingAudit(
  {
    report,
    sourceText,
    candidateText,
  }: {
    readonly report: RenderingAuditReportWire;
    readonly sourceText: string;
    readonly candidateText: string;
  },
): ScreenedReport {
  /**
   * Every claim, screened.
   */
  const screened = report.findings
    .map(function screenOne(finding,) {
      return screenFinding({
        finding,
        sourceText,
        candidateText,
      },);
    },);

  return {
    // A VERDICT THIS VERSION DOES NOT KNOW READS AS `uncertain` rather than as a
    // refusal of the whole answer: the findings underneath it are checked
    // against the texts either way, and a mis-cast verdict is not a reason to
    // discard evidence that anchors.
    verdict: RENDERING_AUDIT_VERDICTS.find(function isCast(one,): boolean {
      return one === report.verdict;
    },) ?? 'uncertain',
    findings: screened.filter(function survived(one,): one is ScreenedFinding {
      return !('dropped' in one);
    },),
    dropped: screened
      .filter(function fell(one,): one is { readonly dropped: string; } {
        return 'dropped' in one;
      },)
      .map(function toReason(one,): string {
        return one.dropped;
      },),
  };
}

//endregion Rendering audit screen
