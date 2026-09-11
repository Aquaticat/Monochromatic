//region Naming evidence failures
// Expected lack of qualification is a finding; broken input or transport throws.

/**
 * Closed failure boundaries, never corpus-derived diagnostic prose.
 *
 * @example
 * ```ts
 * const kind: ArchiveNamingFailure = 'anchor-mismatch';
 * ```
 */
export type ArchiveNamingFailure =
  | 'archive-mismatch'
  | 'anchor-mismatch'
  | 'history-read'
  | 'history-shape';

/**
 * Signals invalid archive evidence or an unsuccessful provenance read.
 *
 * @example
 * ```ts
 * throw new ArchiveNamingEvidenceError({ kind: 'anchor-mismatch', relPath });
 * ```
 */
export class ArchiveNamingEvidenceError extends Error {
  /**
   * Message contains only a closed failure kind and the operator-supplied archive path.
   */
  readonly messageNamesOnly: true = true;

  /**
   * Closed boundary that failed, without exposing history or document content.
   */
  readonly kind: ArchiveNamingFailure;

  /**
   * Names the affected archive and failed operation.
   *
   * @param kind - closed boundary category
   *
   * @param relPath - operator-supplied archive path
   *
   * @param cause - original failure retained for local diagnosis
   *
   * @example
   * ```ts
   * new ArchiveNamingEvidenceError({ kind: 'history-read', relPath, cause });
   * ```
   */
  public constructor({
    kind,
    relPath,
    cause,
  }: {
    readonly kind: ArchiveNamingFailure;
    readonly relPath: string;
    readonly cause?: unknown;
  },) {
    super(
      `archive naming evidence ${kind} for ${relPath}; check the pinned archive, initial anchors and Git read.`,
      cause === undefined ? undefined : { cause, },
    );
    this.name = 'ArchiveNamingEvidenceError';
    this.kind = kind;
  }
}

//endregion Naming evidence failures
