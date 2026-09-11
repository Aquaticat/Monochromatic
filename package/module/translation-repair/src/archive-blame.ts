import { archiveGitInteger, } from './archive-diff-hunks.ts';
import { foldGitDocumentLine, } from './archive-git-line.ts';
import { ArchiveNamingEvidenceError, } from './archive-naming-error.ts';

//region Pinned line origins
// Keep literal path, line and revision facts; never retain author or commit-message data.

/**
 * Complete SHA-1 object-name width.
 */
const SHA1_WIDTH = 40;
/**
 * Complete SHA-256 object-name width.
 */
const SHA256_WIDTH = 64;
/**
 * Ordinary porcelain header without an explicit group count.
 */
const MINIMUM_HEADER_FIELDS = 3;
/**
 * Ordinary porcelain header with its optional group count.
 */
const MAXIMUM_HEADER_FIELDS = 4;

/**
 * Exact line-porcelain origin for a pinned archive line.
 *
 * @example
 * ```ts
 * const origin = origins[currentLine - 1];
 * ```
 */
export type ArchiveLineOrigin = {
  /**
   * Intrinsic commit responsible for the current line.
   */
  readonly commit: string;
  /**
   * One-based line in that origin commit.
   */
  readonly originalLine: number;
  /**
   * One-based line in the requested pin.
   */
  readonly finalLine: number;
  /**
   * Filename in Git's canonical quoted spelling.
   */
  readonly filename: string;
  /**
   * Root or shallow traversal boundary.
   */
  readonly boundary: boolean;
  /**
   * Ignored or unassignable origin.
   */
  readonly ignored: boolean;
  /**
   * Exact current line after shared corpus CRLF normalization.
   */
  readonly text: string;
};

/**
 * Required filename is explicitly missing until metadata supplies it.
 */
type OriginFilename = { readonly kind: 'missing'; } | {
  /**
   * Filename was supplied exactly once.
   */
  readonly kind: 'known';
  /**
   * Exact wire spelling, not a decoded alias.
   */
  readonly value: string;
};

/**
 * Owned origin metadata awaiting its document line.
 */
type PendingOrigin = Omit<ArchiveLineOrigin, 'filename' | 'text' | 'boundary' | 'ignored'> & {
  /**
   * Required metadata state.
   */
  filename: OriginFilename;
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
 * Parser state distinguishes a header from an in-progress metadata record.
 */
type OriginState = { readonly kind: 'header'; } | {
  /**
   * One line's metadata is being collected.
   */
  readonly kind: 'metadata';
  /**
   * Owned record completed by its following tab-prefixed document line.
   */
  readonly record: PendingOrigin;
};

/**
 * Checks complete intrinsic IDs, excluding synthetic all-zero uncommitted origins.
 *
 * @param value - proposed object ID
 *
 * @returns Whether it is a complete nonzero lowercase Git object name
 *
 * @example
 * ```ts
 * if (!isArchiveGitObjectId(commit)) throw malformed;
 * ```
 */
export function isArchiveGitObjectId(value: string,): boolean {
  if ((value.length !== SHA1_WIDTH && value.length !== SHA256_WIDTH)
    || value === '0'.repeat(value.length,)) {
    return false;
  }
  for (let index = 0; index < value.length; index += 1) {
    if (!'0123456789abcdef'.includes(value.charAt(index,),))
      return false;
  }
  return true;
}

/**
 * Reads a strict ordinary header without accepting revision expressions.
 *
 * @param line - metadata header, not document prose
 *
 * @param relPath - archive named for malformed output
 *
 * @returns Owned pending origin
 *
 * @throws {@link ArchiveNamingEvidenceError} for invalid headers
 *
 * @example
 * ```ts
 * const pending = originHeader({ line, relPath });
 * ```
 */
function originHeader({ line, relPath, }: {
  readonly line: string;
  readonly relPath: string;
},): PendingOrigin {
  /**
   * Named fields avoid accidentally accepting extra metadata as a group count.
   */
  const fields = line.split(' ',);
  /**
   * Header's object and numeric tokens.
   */
  const [commit = '', original = '', final = '', group = '1',] = fields;
  /**
   * Origin's one-based line.
   */
  const originalLine = archiveGitInteger({ text: original, relPath, },);
  /**
   * Pin's one-based line.
   */
  const finalLine = archiveGitInteger({ text: final, relPath, },);
  /**
   * Optional group count remains validated.
   */
  const count = archiveGitInteger({ text: group, relPath, },);
  if (!isArchiveGitObjectId(commit,) || originalLine === 0 || finalLine === 0 || count === 0
    || fields.length < MINIMUM_HEADER_FIELDS || fields.length > MAXIMUM_HEADER_FIELDS) {
    throw new ArchiveNamingEvidenceError({ kind: 'history-shape', relPath, },);
  }
  return { commit, originalLine, finalLine, filename: { kind: 'missing', }, boundary: false, ignored: false, };
}

/**
 * Reads full-file porcelain and verifies every current line and its physical termination.
 *
 * @param porcelain - complete raw protocol output
 *
 * @param archiveText - pinned archive after shared corpus CRLF normalization
 *
 * @param relPath - literal requested path
 *
 * @returns Ordered origins without author metadata
 *
 * @throws {@link ArchiveNamingEvidenceError} for incomplete or inconsistent output
 *
 * @example
 * ```ts
 * const origins = archiveBlameOrigins({ porcelain, archiveText, relPath });
 * ```
 */
export function archiveBlameOrigins({ porcelain, archiveText, relPath, }: {
  readonly porcelain: string;
  readonly archiveText: string;
  readonly relPath: string;
},): readonly ArchiveLineOrigin[] {
  /**
   * Physical EOF state cannot be inferred from porcelain's output newline.
   */
  const terminated = archiveText.endsWith('\n',);
  /**
   * Git omits the phantom line after a terminating separator.
   */
  const lines = archiveText === '' ? [] : archiveText.split('\n',);
  if (terminated)
    lines.pop();
  /**
   * Completed origins in pinned line order.
   */
  const origins: ArchiveLineOrigin[] = [];
  /**
   * Explicit owned parse state, never a nullish pending-record sentinel.
   */
  const cursor: { state: OriginState; } = { state: { kind: 'header', }, };
  for (const line of porcelain.split('\n',)) {
    /**
     * State before consuming this protocol line.
     */
    const { state, } = cursor;
    if (state.kind === 'header') {
      if (line !== '')
        cursor.state = { kind: 'metadata', record: originHeader({ line, relPath, },), };
      continue;
    }
    /**
     * Metadata belongs to exactly one forthcoming document line.
     */
    const pending = state.record;
    if (line.startsWith('\t',)) {
      /**
       * Restore only the physical separator proven by the pinned blob.
       */
      const text = foldGitDocumentLine({ text: line.slice(1,),
        terminated: pending.finalLine < lines.length || terminated, },);
      if (pending.filename.kind !== 'known' || pending.finalLine !== origins.length + 1
        || text !== lines[pending.finalLine - 1]) {
        throw new ArchiveNamingEvidenceError({ kind: 'history-shape', relPath, },);
      }
      origins.push({ commit: pending.commit, originalLine: pending.originalLine,
        finalLine: pending.finalLine, boundary: pending.boundary, ignored: pending.ignored,
        filename: pending.filename.value, text, },);
      cursor.state = { kind: 'header', };
      continue;
    }
    if (line.startsWith('filename ',)) {
      if (pending.filename.kind === 'known')
        throw new ArchiveNamingEvidenceError({ kind: 'history-shape', relPath, },);
      pending.filename = { kind: 'known', value: line.slice('filename '.length,), };
    }
    if (line === 'boundary')
      pending.boundary = true;
    if (line === 'ignored' || line === 'unblamable')
      pending.ignored = true;
  }
  if (cursor.state.kind !== 'header' || origins.length !== lines.length)
    throw new ArchiveNamingEvidenceError({ kind: 'history-shape', relPath, },);
  return origins;
}

//endregion Pinned line origins
