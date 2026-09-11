//region Initial archive observations
// An occurrence's use is distinct from naming correctness or entity identity.

/**
 * Closed classifications for exact spans in the initial English archive.
 *
 * @example
 * ```ts
 * const kind: ArchiveUseKind = 'group-reference-name';
 * ```
 */
export type ArchiveUseKind =
  | 'person-reference-name'
  | 'group-reference-name'
  | 'place-reference-name'
  | 'creative-work-title'
  | 'mentioned-form'
  | 'ordinary-prose'
  | 'unresolved';

/**
 * Reference uses eligible for local naming-revision evidence.
 *
 * @example
 * ```ts
 * const kind: ArchiveReferenceKind = 'group-reference-name';
 * ```
 */
export type ArchiveReferenceKind = Extract<ArchiveUseKind,
  'person-reference-name' | 'group-reference-name' | 'place-reference-name'>;

/**
 * Exact occurrence in the immutable, normalized initial English archive.
 * Coordinates are UTF-16 offsets in that archive, never in a generated candidate.
 *
 * @example
 * ```ts
 * const anchor: InitialArchiveAnchor = { nodeId, nodeHash, startOffset, endOffset, quotedText };
 * ```
 */
export type InitialArchiveAnchor = {
  /**
   * Parsed initial-archive block containing the complete occurrence.
   */
  readonly nodeId: string;
  /**
   * Hash of that block's exact text.
   */
  readonly nodeHash: string;
  /**
   * Inclusive initial-archive character offset.
   */
  readonly startOffset: number;
  /**
   * Exclusive initial-archive character offset.
   */
  readonly endOffset: number;
  /**
   * Exact substring at these coordinates, including its supplied markup.
   */
  readonly quotedText: string;
};

/**
 * One independent reader's classification, not a translation-quality vote.
 *
 * @example
 * ```ts
 * const ballot: ArchiveUseBallot = { modelId: 'reader-a', kind: 'mentioned-form' };
 * ```
 */
export type ArchiveUseBallot = {
  /**
   * Shell-owned reader identity; repeated identities cannot add support.
   */
  readonly modelId: string;
  /**
   * Observed function of this exact occurrence.
   */
  readonly kind: ArchiveUseKind;
};

/**
 * Initial-archive use observation with the electorate needed to audit it.
 * Qualification checks the reading rather than trusting a claimed consensus.
 *
 * @example
 * ```ts
 * const use: InitialArchiveUse = { archiveHash, anchor, configuredModelIds, ballots };
 * ```
 */
export type InitialArchiveUse = {
  /**
   * Hash of the complete immutable normalized archive carrying the anchor.
   */
  readonly archiveHash: string;
  /**
   * Literal occurrence that every reader classified.
   */
  readonly anchor: InitialArchiveAnchor;
  /**
   * Original configured electorate, including readers who did not answer.
   */
  readonly configuredModelIds: readonly string[];
  /**
   * Actual independent classifications; absence is not an ordinary-prose vote.
   */
  readonly ballots: readonly ArchiveUseBallot[];
};

//endregion Initial archive observations

//region Qualified naming revisions
// History qualifies only a corroborated complete reference occurrence.

/**
 * Verified historical change to one complete current archive reference name.
 * This is local document evidence, not an official name or reusable alias.
 *
 * @example
 * ```ts
 * const name = revision.currentFragment;
 * ```
 */
export type QualifiedArchiveNamingRevision = {
  /**
   * Corpus commit whose archive was inspected.
   */
  readonly archiveCommit: string;
  /**
   * Repository-relative archive path, unchanged across the qualifying revision.
   */
  readonly archivePath: string;
  /**
   * Revision introducing the current line.
   */
  readonly originCommit: string;
  /**
   * Its sole parent, supplying the removed line.
   */
  readonly parentCommit: string;
  /**
   * Hash of the immutable normalized initial archive.
   */
  readonly archiveHash: string;
  /**
   * Complete occurrence, never a partial name or surrounding role words.
   */
  readonly anchor: InitialArchiveAnchor;
  /**
   * Corroborated reference use whose naming convention is relevant.
   */
  readonly useKind: ArchiveReferenceKind;
  /**
   * Original configured readers and their unmodified evidence.
   */
  readonly reading: Pick<InitialArchiveUse, 'configuredModelIds' | 'ballots'>;
  /**
   * One-based normalized initial archive line carrying the occurrence.
   */
  readonly currentLine: number;
  /**
   * One-based pinned file line before placeholder stripping.
   */
  readonly pinnedLine: number;
  /**
   * One-based line in the origin revision.
   */
  readonly originLine: number;
  /**
   * Initial normalized archive offset where the current line begins.
   */
  readonly currentLineStartOffset: number;
  /**
   * Current normalized line, retained for scope verification after preparation.
   */
  readonly currentLineText: string;
  /**
   * Physical pinned EOF state, never inferred from Git protocol output.
   */
  readonly pinnedHasFinalNewline: boolean;
  /**
   * Unchanged physical separator state for the complete qualifying line.
   */
  readonly lineTerminated: boolean;
  /**
   * Predecessor line under the same normalization, retained for reconstruction.
   */
  readonly previousLineText: string;
  /**
   * Removed fragment in the same one-line replacement.
   */
  readonly previousFragment: string;
  /**
   * Added fragment, exactly equal to the complete current occurrence.
   */
  readonly currentFragment: string;
};

/**
 * Qualified revisions plus reasons other occurrences supplied no usable evidence.
 * Withholding is data; failed Git reads, invalid anchors and malformed Git output throw.
 *
 * @example
 * ```ts
 * const { revisions, findings } = await readQualifiedArchiveNamingRevisions(input);
 * ```
 */
export type ArchiveNamingRevisionResult = {
  /**
   * Exact qualified occurrence revisions, in initial archive order.
   */
  readonly revisions: readonly QualifiedArchiveNamingRevision[];
  /**
   * Names-only explanations for withheld or unavailable provenance.
   */
  readonly findings: readonly string[];
};

//endregion Qualified naming revisions
