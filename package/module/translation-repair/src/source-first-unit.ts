import type { DocumentNode, } from './document-node.ts';

//region Source-first units
// What one slice's worth of blocks looks like before it becomes a chunk pair.
//
// THE BOUNDARY IS A VALUE, NOT AN INDEX, and that is the whole reason this type
// lives apart from the walk that builds it. An index into "the target blocks"
// is three different numbers depending on who holds it: the section's own
// sequence, the document's, or the alignment's. A boundary that names the BLOCK
// cannot be read against the wrong sequence, cannot go negative, and cannot run
// past the end; the one case with no block to name says so in its own kind
// rather than by being one past the last.

/**
 * Where an untranslated passage's rendering belongs on the target side.
 *
 * @example
 * ```ts
 * const boundary: TargetBoundary = { kind: 'before-block', block, };
 * ```
 */
export type TargetBoundary = {
  /**
   * Rendering belongs immediately before an existing translation block.
   */
  readonly kind: 'before-block';

  /**
   * Block it precedes, whose start offset is where the text goes.
   */
  readonly block: DocumentNode;
} | {
  /**
   * Rendering belongs after every translation block this section carries,
   * which is what a trailing untranslated passage looks like. The caller
   * resolves the offset, since only it knows where the section ends.
   */
  readonly kind: 'after-section';
};

/**
 * One slice's worth of blocks, either paired with existing text or anchored at
 * the boundary where its translation belongs.
 *
 * @example
 * ```ts
 * const unit: SourceFirstUnit = { kind: 'anchored', sourceRun, boundary, };
 * ```
 */
export type SourceFirstUnit = {
  /**
   * Both sides carry blocks, and the target side is a contiguous interval.
   */
  readonly kind: 'paired';

  /**
   * Original-side blocks, in document order.
   */
  readonly sourceRun: readonly DocumentNode[];

  /**
   * Translation-side blocks, contiguous in the whole target sequence.
   */
  readonly targetRun: readonly DocumentNode[];
} | {
  /**
   * Original-side blocks the translation never rendered.
   */
  readonly kind: 'anchored';

  /**
   * Original-side blocks, in document order.
   */
  readonly sourceRun: readonly DocumentNode[];

  /**
   * Place on the target side this unit's translation belongs at.
   */
  readonly boundary: TargetBoundary;
};

//endregion Source-first units
