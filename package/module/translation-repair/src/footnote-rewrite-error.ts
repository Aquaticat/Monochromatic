//region Footnote rewrite refusals
// These messages name operations, never archive prose or supplied labels.

/**
 * Closed reasons for withholding a footnote rewrite.
 *
 * @example
 * ```ts
 * const kind: FootnoteRewriteFailure = 'collision';
 * ```
 */
export type FootnoteRewriteFailure = 'syntax' | 'position' | 'label' | 'mapping' | 'collision' | 'graph';

/** Actionable diagnostics for each invariant boundary. */
const MESSAGES: Readonly<Record<FootnoteRewriteFailure, string>> = {
  syntax: 'footnote rewrite: document syntax could not be verified; retain the archive or repair its syntax before retrying',
  position: 'footnote rewrite: parsed marker positions do not match raw syntax; retain the archive and investigate the parser boundary',
  label: 'footnote rewrite: a supplied label does not encode exactly one GFM identifier; supply a valid label before retrying',
  mapping: 'footnote rewrite: normalized labels have conflicting destinations; resolve the correspondence before retrying',
  collision: 'footnote rewrite: distinct archive identifiers would merge; close the map before retrying',
  graph: 'footnote rewrite: the transformed marker graph differs from the intended rename; retain the archive and investigate the transformation',
};

/**
 * An operation cannot prove a syntax-preserving and injective rename.
 *
 * @example
 * ```ts
 * throw new FootnoteRewriteError({ kind: 'collision' });
 * ```
 */
export class FootnoteRewriteError extends Error {
  /** Stable diagnostic operation. */
  public override readonly name = 'FootnoteRewriteError';
  /** Diagnostic text is restricted to the closed operation messages. */
  readonly messageNamesOnly: true = true;
  /** Structured refusal for callers that retain unchanged archive bytes. */
  readonly kind: FootnoteRewriteFailure;

  /**
   * Retains the failing operation without interpolating supplied text.
   *
   * @param kind - invariant that could not be established
   * @param cause - original parser failure when available
   * @example
   * ```ts
   * const error = new FootnoteRewriteError({ kind: 'syntax', cause });
   * ```
   */
  public constructor({ kind, cause, }: { readonly kind: FootnoteRewriteFailure; readonly cause?: unknown; },) {
    super(MESSAGES[kind], { cause, },);
    this.kind = kind;
  }
}

//endregion Footnote rewrite refusals
