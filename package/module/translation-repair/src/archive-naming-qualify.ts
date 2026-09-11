import { archiveChangedSpan, } from './archive-changed-span.ts';
import { ArchiveNamingEvidenceError, } from './archive-naming-error.ts';
import type { ArchiveRevisionHistory, } from './archive-naming-history.ts';
import type {
  ArchiveNamingRevisionResult,
  QualifiedArchiveNamingRevision,
} from './archive-naming-model.ts';
import type { ArchiveNamingScope, } from './archive-naming-scope.ts';
import type { CorpusPin, } from './corpus-source.ts';
import { foldInvisibleVariants, } from './invisible-variants.ts';

//region Whole-reference revision qualification
// Corroborated use and exact history are separately necessary facts.

/**
 * Joins only whole reference occurrences to unambiguous one-line replacements.
 *
 * @param scopes - exact immutable occurrence and pinned-line mappings
 *
 * @param histories - verified single-parent ordinary history
 *
 * @param pin - commit whose archive is being qualified
 *
 * @param relPath - literal same path throughout the proof
 *
 * @returns Qualified revisions and reasons other scopes were withheld
 *
 * @throws {@link ArchiveNamingEvidenceError} for inconsistent history content
 *
 * @example
 * ```ts
 * const result = qualifyArchiveNamingScopes({ scopes, histories, pin, relPath });
 * ```
 */
export function qualifyArchiveNamingScopes({
  scopes,
  histories,
  pin,
  relPath,
}: {
  readonly scopes: readonly ArchiveNamingScope[];
  readonly histories: ReadonlyMap<string, ArchiveRevisionHistory>;
  readonly pin: CorpusPin;
  readonly relPath: string;
},): ArchiveNamingRevisionResult {
  /**
   * Expected lack of qualification remains visible as data.
   */
  const findings: string[] = [];
  /**
   * Each scope contributes either one complete record or no naming evidence.
   */
  const revisions = scopes.flatMap(function qualify(scope,): readonly QualifiedArchiveNamingRevision[] {
    /**
     * Ordinary history is absent for explicitly withheld root/merge origins.
     */
    const history = histories.get(scope.origin
      .commit,);
    if (history === undefined)
      return [];
    /**
     * Hunks covering the origin line, not merely mentioning the same spelling.
     */
    const matching = history.hunks
      .filter(function covers(hunk,): boolean {
      return (hunk.newStart
        <= scope.origin
        .originalLine)
        && (scope.origin
          .originalLine
          < (hunk.newStart
          + hunk.newCount));
    },);
    /**
     * Strictly unique textual replacement.
     */
    const hunk = matching.length === 1 ? matching[0] : undefined;
    if ((hunk === undefined) || (hunk.removed
      .length
      !== 1)
      || (hunk.added
        .length
        !== 1)) {
      findings.push(`archive-revision-withheld (${scope.reference
        .use
        .anchor
        .nodeId}: no unique single-line replacement)`,);
      return [];
    }
    if ((hunk.oldTerminated !== hunk.newTerminated)
      || (hunk.newTerminated !== scope.lineTerminated)) {
      findings.push(`archive-revision-withheld (${scope.reference
        .use
        .anchor
        .nodeId}: physical line ending changed)`,);
      return [];
    }
    /**
     * Raw predecessor line, already subject to the shared CRLF fold.
     */
    const [previousRaw,] = hunk.removed;
    /**
     * Raw origin line must exactly match line-porcelain evidence.
     */
    const [currentRaw,] = hunk.added;
    if ((previousRaw === undefined) || (currentRaw === undefined)
      || (currentRaw
        !== scope.origin
        .text))
      throw new ArchiveNamingEvidenceError({
        kind: 'history-shape',
        relPath,
      },);
    /**
     * Previous line under the same normalization as initial-archive occurrences.
     */
    const previous = foldInvisibleVariants({ text: previousRaw, },)
      .text;
    /**
     * Current line under that same normalization.
     */
    const current = foldInvisibleVariants({ text: currentRaw, },)
      .text;
    if (current !== scope.text)
      throw new ArchiveNamingEvidenceError({
        kind: 'history-shape',
        relPath,
      },);
    /**
     * Textual change; its semantic use still comes only from independent observation.
     */
    const change = archiveChangedSpan({
      previous,
      current,
    },);
    /**
     * Immutable initial occurrence to which the change must be exactly equal.
     */
    const { anchor, } = scope.reference
      .use;
    if ((change.removed === '') || (change.added === '')) {
      findings.push(`archive-revision-withheld (${anchor.nodeId}: insertion or deletion only)`,);
      return [];
    }
    if (((scope.startOffset + change.start) !== anchor.startOffset)
      || ((scope.startOffset
        + change.start
        + change.added
        .length) !== anchor.endOffset)
      || (change.added !== anchor.quotedText)) {
      findings.push(`archive-revision-withheld (${anchor.nodeId}: change does not equal complete reference occurrence)`,);
      return [];
    }
    // Reconstruction verifies the relation before exposing a naming-specific description.
    if ((current.slice(
      0,
      change.start,
    ) + change.removed
      + current.slice(change.start
        + change.added
        .length,)) !== previous) {
      throw new ArchiveNamingEvidenceError({
        kind: 'history-shape',
        relPath,
      },);
    }
    return [{
      archiveCommit: pin.commitSha,
      archivePath: relPath,
      originCommit: scope.origin
        .commit,
      parentCommit: history.parentCommit,
      archiveHash: scope.reference
        .use
        .archiveHash,
      anchor,
      useKind: scope.reference
        .kind,
      reading: {
        configuredModelIds: scope.reference
          .use
          .configuredModelIds,
        ballots: scope.reference
          .use
          .ballots,
      },
      currentLine: scope.lineNumber,
      pinnedLine: scope.origin
        .finalLine,
      originLine: scope.origin
        .originalLine,
      currentLineStartOffset: scope.startOffset,
      currentLineText: current,
      pinnedHasFinalNewline: scope.pinnedHasFinalNewline,
      lineTerminated: scope.lineTerminated,
      previousLineText: previous,
      previousFragment: change.removed,
      currentFragment: change.added,
    }];
  },);
  return {
    revisions,
    findings,
  };
}

//endregion Whole-reference revision qualification
