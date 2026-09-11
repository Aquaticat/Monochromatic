import type { ArchiveLineOrigin, } from './archive-blame.ts';
import { sameGitPath, } from './archive-git-path.ts';
import { archiveLineMap, } from './archive-line-map.ts';
import type { ArchiveRetainedLine, } from './corpus-run/archive-stub.ts';
import { ArchiveNamingEvidenceError, } from './archive-naming-error.ts';
import type { InitialArchiveUse, } from './archive-naming-model.ts';
import type { CorroboratedArchiveReference, } from './archive-use-corroborate.ts';
import { hashContent, } from './document-node.ts';
import { foldInvisibleVariants, } from './invisible-variants.ts';
import { parseDocument, } from './parse-document.ts';

//region Immutable occurrence scopes
// Anchor validation precedes history joining; generated text cannot become an initial convention.

/**
 * Complete reference occurrence joined to one unchanged pinned line.
 *
 * @example
 * ```ts
 * const changedStart = scope.startOffset + change.start;
 * ```
 */
export type ArchiveNamingScope = {
  /**
   * Independent initial-use evidence.
   */
  readonly reference: CorroboratedArchiveReference;
  /**
   * One-based normalized initial archive line.
   */
  readonly lineNumber: number;
  /**
   * Normalized initial archive line start.
   */
  readonly startOffset: number;
  /**
   * Exact normalized line containing the whole occurrence.
   */
  readonly text: string;
  /**
   * Unique pinned origin whose normalized current line matches.
   */
  readonly origin: ArchiveLineOrigin;
  /**
   * Physical termination of the pinned file, before archive normalization.
   */
  readonly pinnedHasFinalNewline: boolean;
  /**
   * Physical termination of this pinned line, independent of porcelain output.
   */
  readonly lineTerminated: boolean;
};

/**
 * Counts duplicate initial occurrences independently of their claimed use kinds.
 *
 * @param use - occurrence whose multiplicity is tested
 *
 * @param uses - all initial observations, including non-reference kinds
 *
 * @returns Whether exactly one observation owns this initial range
 *
 * @example
 * ```ts
 * const unique = uniqueInitialUse({ use, uses });
 * ```
 */
function uniqueInitialUse({
  use,
  uses,
}: {
  readonly use: InitialArchiveUse;
  readonly uses: readonly InitialArchiveUse[];
},): boolean {
  return uses.filter(function sameRange(other,): boolean {
    return (other.archiveHash === use.archiveHash)
      && (other.anchor
        .startOffset
        === use.anchor
        .startOffset)
      && (other.anchor
        .endOffset
        === use.anchor
        .endOffset);
  },)
    .length
    === 1;
}

/**
 * Validates initial anchors and joins each complete occurrence to one literal origin.
 *
 * @param archiveText - immutable normalized initial archive
 *
 * @param lines - retained pinned positions from the same archive normalization
 *
 * @param uses - all observations for duplicate-range detection
 *
 * @param references - independently corroborated reference uses
 *
 * @param origins - complete pinned line-porcelain records
 *
 * @param pinnedHasFinalNewline - physical EOF state from the pinned blob
 *
 * @param relPath - requested archive path, not an alias lookup
 *
 * @returns Unique same-path scopes and explicit withholding findings
 *
 * @throws {@link ArchiveNamingEvidenceError} for stale or invalid initial anchors
 *
 * @example
 * ```ts
 * const { scopes } = archiveNamingScopes({ archiveText, uses, references, origins, relPath });
 * ```
 */
export function archiveNamingScopes({
  archiveText,
  lines,
  uses,
  references,
  origins,
  pinnedHasFinalNewline,
  relPath,
}: {
  readonly archiveText: string;
  readonly lines: readonly ArchiveRetainedLine[];
  readonly uses: readonly InitialArchiveUse[];
  readonly references: readonly CorroboratedArchiveReference[];
  readonly origins: readonly ArchiveLineOrigin[];
  readonly pinnedHasFinalNewline: boolean;
  readonly relPath: string;
},): {
  readonly scopes: readonly ArchiveNamingScope[];
  readonly findings: readonly string[]
} {
  /**
   * Hash binds observations to the entire initial archive rather than a candidate.
   */
  const archiveHash = hashContent({ content: archiveText, },);
  /**
   * Parsed block identities validate the second layer of scope.
   */
  const document = parseDocument({ text: archiveText, },);
  /**
   * Block lookup avoids rediscovering an occurrence by spelling.
   */
  const nodes = new Map(document.nodes
    .map(function nodeEntry(node,): readonly [
      string,
      typeof node
    ] {
    return [
      node.id,
      node
    ];
  },),);
  /**
   * Withheld mappings remain visible without claiming a revision.
   */
  const findings: string[] = [];
  /**
   * Scope rows that satisfy both initial and pinned-line identity.
   */
  const lineMap = archiveLineMap({
    lines,
    archiveText,
    relPath,
  },);
  /**
   * Public results follow initial archive order, independently of observation order.
   */
  const ordered = references.toSorted(function byPosition(
    left,
    right,
  ): number {
    return left.use
      .anchor
      .startOffset
      - right.use
      .anchor
      .startOffset;
  },);
  /**
   * Exact occurrence coordinates select origins; text equality only verifies them.
   */
  const scopes = ordered.flatMap(function locate(reference,): readonly ArchiveNamingScope[] {
    /**
     * Initial occurrence whose provenance is being resolved.
     */
    const { use, } = reference;
    /**
     * Caller-owned initial range.
     */
    const { anchor, } = use;
    if (use.archiveHash !== archiveHash)
      throw new ArchiveNamingEvidenceError({
        kind: 'archive-mismatch',
        relPath,
      },);
    /**
     * Parsed block named by the initial observation.
     */
    const node = nodes.get(anchor.nodeId,);
    if ((node === undefined) || (node.contentHash !== anchor.nodeHash)
      || (!Number.isSafeInteger(anchor.startOffset,))
      || (!Number.isSafeInteger(anchor.endOffset,))
      || (anchor.startOffset < node.startOffset)
      || (anchor.endOffset > node.endOffset)
      || (anchor.endOffset <= anchor.startOffset)
      || (archiveText.slice(
        anchor.startOffset,
        anchor.endOffset,
      ) !== anchor.quotedText)) {
      throw new ArchiveNamingEvidenceError({
        kind: 'anchor-mismatch',
        relPath,
      },);
    }
    if (!uniqueInitialUse({
      use,
      uses,
    },)) {
      findings.push(`archive-revision-withheld (${anchor.nodeId}: repeated initial occurrence)`,);
      return [];
    }
    /**
     * Beginning of the normalized initial line carrying this reference.
     */
    const startOffset = anchor.startOffset === 0 ? 0
      : archiveText.lastIndexOf(
        '\n',
        anchor.startOffset - 1,
      ) + 1;
    /**
     * Following line separator, when present.
     */
    const nextLine = archiveText.indexOf(
      '\n',
      startOffset,
    );
    /**
     * Exclusive end without a line separator.
     */
    const endOffset = nextLine === (-1) ? archiveText.length : nextLine;
    if (anchor.endOffset > endOffset) {
      findings.push(`archive-revision-withheld (${anchor.nodeId}: occurrence crosses a line)`,);
      return [];
    }
    /**
     * Current line with exactly the same invisible-character normalization.
     */
    const text = archiveText.slice(
      startOffset,
      endOffset,
    );
    /**
     * Shared normalization supplied this exact line's pinned position.
     */
    const mapped = lineMap.get(startOffset,);
    if ((mapped === undefined) || (mapped.text !== text))
      throw new ArchiveNamingEvidenceError({
        kind: 'archive-mismatch',
        relPath,
      },);
    /**
     * Blame is selected only by coordinates, even when several lines have identical text.
     */
    const origin = origins[mapped.pinnedLine - 1];
    if ((origin === undefined) || (origin.finalLine !== mapped.pinnedLine)
      || (foldInvisibleVariants({ text: origin.text, },)
        .text
        !== text)) {
      throw new ArchiveNamingEvidenceError({
        kind: 'history-shape',
        relPath,
      },);
    }
    if (origin.boundary || origin.ignored
      || (!sameGitPath({
        wirePath: origin.filename,
        relPath,
      },))) {
      findings.push(`archive-revision-withheld (${anchor.nodeId}: root, ignored or renamed origin)`,);
      return [];
    }
    return [{
      reference,
      text,
      startOffset,
      origin,
      pinnedHasFinalNewline,
      lineTerminated: (origin.finalLine < origins.length) || pinnedHasFinalNewline,
      lineNumber: mapped.lineNumber,
    }];
  },);
  return {
    scopes,
    findings,
  };
}

//endregion Immutable occurrence scopes
