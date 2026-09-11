import { archiveGitInteger, } from './archive-diff-hunks.ts';
import { ArchiveNamingEvidenceError, } from './archive-naming-error.ts';

//region Pinned line origins
// Keep path, line and revision facts; discard author, email and commit-message data.

/**
 * Width of SHA-1 Git object names.
 */
const SHA1_WIDTH = 40;
/**
 * Width of SHA-256 Git object names.
 */
const SHA256_WIDTH = 64;

/**
 * One line-porcelain origin for a line in the pinned archive.
 *
 * @example
 * ```ts
 * const origin = origins[currentLine - 1];
 * ```
 */
export type ArchiveLineOrigin = {
  /**
   * Commit responsible for the current line.
   */
  readonly commit: string;
  /**
   * One-based line in the origin commit.
   */
  readonly originalLine: number;
  /**
   * One-based line in the requested pin.
   */
  readonly finalLine: number;
  /**
   * Filename metadata, still in Git's canonical quoted spelling.
   */
  readonly filename: string;
  /**
   * Root or shallow traversal boundary.
   */
  readonly boundary: boolean;
  /**
   * Ignored or unassignable origins are not qualification evidence.
   */
  readonly ignored: boolean;
  /**
   * Exact current line, excluding its output prefix and newline.
   */
  readonly text: string;
};

/**
 * Owned metadata while a single porcelain record is assembled.
 */
type PendingOrigin = {
  /**
   * Commit from the header.
   */
  readonly commit: string;
  /**
   * Origin line from the header.
   */
  readonly originalLine: number;
  /**
   * Pinned line from the header.
   */
  readonly finalLine: number;
  /**
   * Required filename, initially absent.
   */
  filename: string | undefined;
  /**
   * Whether Git marked a traversal boundary.
   */
  boundary: boolean;
  /**
   * Whether Git marked unreliable assignment.
   */
  ignored: boolean;
};

/**
 * Checks complete object IDs without accepting revision-expression syntax.
 *
 * @param value - proposed object ID
 *
 * @returns Whether it is a complete lowercase SHA-1 or SHA-256 object name
 *
 * @example
 * ```ts
 * if (!isArchiveGitObjectId(commit)) throw malformed;
 * ```
 */
export function isArchiveGitObjectId(value: string,): boolean {
  return ((value.length === SHA1_WIDTH) || (value.length === SHA256_WIDTH))
    && [...value]
    .every(function hexadecimal(character,): boolean {
      return '0123456789abcdef'.includes(character,);
    },);
}

/**
 * Reads one strict porcelain header.
 *
 * @param line - metadata header, not document text
 *
 * @param relPath - archive named by malformed-output errors
 *
 * @returns Owned record awaiting its filename and text
 *
 * @throws {@link ArchiveNamingEvidenceError} for invalid headers
 *
 * @example
 * ```ts
 * const pending = originHeader({ line, relPath });
 * ```
 */
function originHeader({
  line,
  relPath,
}: {
  readonly line: string;
  readonly relPath: string;
},): PendingOrigin {
  /**
   * Optional group count appears only at a group's first line.
   */
  const fields = line.split(' ',);
  /**
   * Complete commit ID.
   */
  const commit = fields[0] ?? '';
  /**
   * Origin's one-based line.
   */
  const originalLine = archiveGitInteger({
    text: fields[1] ?? '',
    relPath,
  },);
  /**
   * Pin's one-based line.
   */
  const finalLine = archiveGitInteger({
    text: fields[2] ?? '',
    relPath,
  },);
  /**
   * Optional count is still validated even though each line is emitted separately.
   */
  const count = archiveGitInteger({
    text: fields[3] ?? '1',
    relPath,
  },);
  /**
   * Permitted ordinary porcelain header widths.
   */
  const minimumFields = 3;
  /**
   * Header width when Git supplies a group count.
   */
  const maximumFields = 4;
  if ((!isArchiveGitObjectId(commit,)) || (originalLine === 0)
    || (finalLine === 0)
    || (count === 0)
    || (fields.length < minimumFields)
    || (fields.length > maximumFields)) {
    throw new ArchiveNamingEvidenceError({
      kind: 'history-shape',
      relPath,
    },);
  }
  return {
    commit,
    originalLine,
    finalLine,
    filename: undefined,
    boundary: false,
    ignored: false,
  };
}

/**
 * Reads full-file line porcelain and verifies every current line against the pinned read.
 *
 * @param porcelain - complete line-porcelain output
 *
 * @param archiveText - pinned archive after shared CRLF normalization
 *
 * @param relPath - literal requested archive path
 *
 * @returns Ordered line origins without author metadata
 *
 * @throws {@link ArchiveNamingEvidenceError} for incomplete or inconsistent output
 *
 * @example
 * ```ts
 * const origins = archiveBlameOrigins({ porcelain, archiveText, relPath });
 * ```
 */
export function archiveBlameOrigins({
  porcelain,
  archiveText,
  relPath,
}: {
  readonly porcelain: string;
  readonly archiveText: string;
  readonly relPath: string;
},): readonly ArchiveLineOrigin[] {
  /**
   * Git omits the phantom line after a terminating newline.
   */
  const lines = archiveText === '' ? [] : archiveText.split('\n',);
  if (archiveText.endsWith('\n',))
    lines.pop();
  /**
   * Completed origins in pinned line order.
   */
  const origins: ArchiveLineOrigin[] = [];
  /**
   * Pending header and metadata, cleared exactly when its text arrives.
   */
  let pending: PendingOrigin | undefined;
  for (const line of porcelain.split('\n',)) {
    if (pending === undefined) {
      if (line !== '')
        pending = originHeader({
          line,
          relPath,
        },);
      continue;
    }
    if (line.startsWith('\t',)) {
      /**
       * Document line, distinct from metadata that may share its words.
       */
      const text = line.slice(1,);
      if ((pending.filename === undefined) || (pending.finalLine !== (origins.length
        + 1))
        || (text !== lines[pending.finalLine - 1])) {
        throw new ArchiveNamingEvidenceError({
          kind: 'history-shape',
          relPath,
        },);
      }
      origins.push({
        ...pending,
        filename: pending.filename,
        text,
      },);
      pending = undefined;
      continue;
    }
    if (line.startsWith('filename ',)) {
      if (pending.filename !== undefined)
        throw new ArchiveNamingEvidenceError({
          kind: 'history-shape',
          relPath,
        },);
      pending.filename = line.slice('filename '.length,);
    }
    if (line === 'boundary')
      pending.boundary = true;
    if ((line === 'ignored') || (line === 'unblamable'))
      pending.ignored = true;
  }
  if ((pending !== undefined) || (origins.length !== lines.length))
    throw new ArchiveNamingEvidenceError({
      kind: 'history-shape',
      relPath,
    },);
  return origins;
}

//endregion Pinned line origins
