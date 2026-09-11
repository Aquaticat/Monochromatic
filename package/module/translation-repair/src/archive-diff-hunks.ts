import { foldGitDocumentLine, } from './archive-git-line.ts';
import { ArchiveNamingEvidenceError, } from './archive-naming-error.ts';

//region Ordinary zero-context hunks
// Ranges describe textual replacement; physical line termination remains part of the proof.

/**
 * One ordinary hunk with exact normalized lines and physical final-line endings.
 *
 * @example
 * ```ts
 * const candidate = hunks.find(hunk => hunk.newStart === originLine);
 * ```
 */
export type ArchiveDiffHunk = {
  /**
   * First predecessor line; zero is allowed for an empty side.
   */
  readonly oldStart: number;
  /**
   * Declared predecessor line count.
   */
  readonly oldCount: number;
  /**
   * First current line; zero is allowed for an empty side.
   */
  readonly newStart: number;
  /**
   * Declared current line count.
   */
  readonly newCount: number;
  /**
   * Removed lines without diff prefixes or physical separators.
   */
  readonly removed: readonly string[];
  /**
   * Added lines without diff prefixes or physical separators.
   */
  readonly added: readonly string[];
  /**
   * Whether the last removed line had a physical separator.
   */
  readonly oldTerminated: boolean;
  /**
   * Whether the last added line had a physical separator.
   */
  readonly newTerminated: boolean;
};

/**
 * Owned hunk storage while protocol lines are arriving.
 */
type PendingHunk = Omit<ArchiveDiffHunk, 'removed' | 'added' | 'oldTerminated' | 'newTerminated'> & {
  /**
   * Raw removed lines before termination-aware normalization.
   */
  readonly removed: string[];
  /**
   * Raw added lines before termination-aware normalization.
   */
  readonly added: string[];
  /**
   * Updated only by a valid old-side EOF marker.
   */
  oldTerminated: boolean;
  /**
   * Updated only by a valid new-side EOF marker.
   */
  newTerminated: boolean;
};

/**
 * Protocol state explicitly distinguishes headers from hunk content.
 */
type HunkState = { readonly kind: 'header'; } | {
  /**
   * An ordinary hunk is open.
   */
  readonly kind: 'hunk';
  /**
   * Hunk receiving document lines.
   */
  readonly hunk: PendingHunk;
  /**
   * Only an immediately preceding document line may receive an EOF marker.
   */
  lastSide: 'none' | 'old' | 'new';
};

/**
 * Reads a decimal protocol field without exponent or whitespace syntax.
 *
 * @param text - Git numeric field
 *
 * @param relPath - archive named for malformed output
 *
 * @returns Nonnegative safe integer
 *
 * @throws {@link ArchiveNamingEvidenceError} for invalid decimal fields
 *
 * @example
 * ```ts
 * const line = archiveGitInteger({ text: '12', relPath });
 * ```
 */
export function archiveGitInteger({ text, relPath, }: {
  readonly text: string;
  readonly relPath: string;
},): number {
  /**
   * Parsed value, still subject to lexical and safe-integer validation.
   */
  const value = Number(text,);
  if (text.length === 0 || !Number.isSafeInteger(value,) || value < 0)
    throw new ArchiveNamingEvidenceError({ kind: 'history-shape', relPath, },);
  for (let index = 0; index < text.length; index += 1) {
    if (!'0123456789'.includes(text.charAt(index,),))
      throw new ArchiveNamingEvidenceError({ kind: 'history-shape', relPath, },);
  }
  return value;
}

/**
 * Parses one explicitly signed ordinary range.
 *
 * @param token - minus or plus range
 *
 * @param sign - expected side marker
 *
 * @param relPath - archive named for malformed output
 *
 * @returns First line and declared count
 *
 * @throws {@link ArchiveNamingEvidenceError} for malformed ranges
 *
 * @example
 * ```ts
 * const range = hunkRange({ token: '-1,2', sign: '-', relPath });
 * ```
 */
function hunkRange({ token, sign, relPath, }: {
  readonly token: string;
  readonly sign: '-' | '+';
  readonly relPath: string;
},): { readonly start: number; readonly count: number; } {
  /**
   * Decimal range parts after the required marker.
   */
  const fields = token.slice(1,).split(',',);
  if (!token.startsWith(sign,) || fields.length > 2)
    throw new ArchiveNamingEvidenceError({ kind: 'history-shape', relPath, },);
  return {
    start: archiveGitInteger({ text: fields[0] ?? '', relPath, },),
    count: archiveGitInteger({ text: fields[1] ?? '1', relPath, },),
  };
}

/**
 * Parses zero-context output and validates counts and EOF marker placement.
 *
 * @param patch - complete uncolored, unconverted output with raw protocol newlines
 *
 * @param relPath - requested archive path
 *
 * @returns Ordinary hunks preserving physical EOF state
 *
 * @throws {@link ArchiveNamingEvidenceError} for malformed or combined hunks
 *
 * @example
 * ```ts
 * const hunks = archiveDiffHunks({ patch, relPath });
 * ```
 */
export function archiveDiffHunks({ patch, relPath, }: {
  readonly patch: string;
  readonly relPath: string;
},): readonly ArchiveDiffHunk[] {
  /**
   * Owned hunk builders; normalization occurs only after EOF markers arrive.
   */
  const hunks: PendingHunk[] = [];
  /**
   * Cursor mutation stays owned inside this parser.
   */
  const cursor: { state: HunkState; } = { state: { kind: 'header', }, };
  for (const line of patch.split('\n',)) {
    if (line.startsWith('diff --git ',)) {
      cursor.state = { kind: 'header', };
      continue;
    }
    if (line.startsWith('@@',)) {
      /**
       * Named fields avoid interpreting function-context text as a range.
       */
      const [opening, oldToken, newToken, closing,] = line.split(' ',);
      if (opening !== '@@' || closing !== '@@')
        throw new ArchiveNamingEvidenceError({ kind: 'history-shape', relPath, },);
      /**
       * Predecessor range.
       */
      const old = hunkRange({ token: oldToken ?? '', sign: '-', relPath, },);
      /**
       * Current range.
       */
      const current = hunkRange({ token: newToken ?? '', sign: '+', relPath, },);
      /**
       * Owned raw line arrays and default physical termination.
       */
      const hunk: PendingHunk = { oldStart: old.start, oldCount: old.count,
        newStart: current.start, newCount: current.count, removed: [], added: [],
        oldTerminated: true, newTerminated: true, };
      hunks.push(hunk,);
      cursor.state = { kind: 'hunk', hunk, lastSide: 'none', };
      continue;
    }
    /**
     * Stable state for this protocol line.
     */
    const { state, } = cursor;
    if (state.kind === 'header')
      continue;
    if (line.startsWith('-',)) {
      if (!state.hunk.oldTerminated)
        throw new ArchiveNamingEvidenceError({ kind: 'history-shape', relPath, },);
      state.hunk.removed.push(line.slice(1,),);
      state.lastSide = 'old';
    }
    else if (line.startsWith('+',)) {
      if (!state.hunk.newTerminated)
        throw new ArchiveNamingEvidenceError({ kind: 'history-shape', relPath, },);
      state.hunk.added.push(line.slice(1,),);
      state.lastSide = 'new';
    }
    else if (line === String.raw`\ No newline at end of file`) {
      if (state.lastSide === 'old' && state.hunk.removed.length === state.hunk.oldCount)
        state.hunk.oldTerminated = false;
      else if (state.lastSide === 'new' && state.hunk.added.length === state.hunk.newCount)
        state.hunk.newTerminated = false;
      else
        throw new ArchiveNamingEvidenceError({ kind: 'history-shape', relPath, },);
      state.lastSide = 'none';
    }
    else if (line === '')
      state.lastSide = 'none';
    else
      throw new ArchiveNamingEvidenceError({ kind: 'history-shape', relPath, },);
  }
  return hunks.map(function finalize(hunk,): ArchiveDiffHunk {
    if (hunk.removed.length !== hunk.oldCount || hunk.added.length !== hunk.newCount)
      throw new ArchiveNamingEvidenceError({ kind: 'history-shape', relPath, },);
    return {
      ...hunk,
      removed: hunk.removed.map(function previousLine(text, index,): string {
        return foldGitDocumentLine({ text, terminated: index < hunk.removed.length - 1 || hunk.oldTerminated, },);
      },),
      added: hunk.added.map(function currentLine(text, index,): string {
        return foldGitDocumentLine({ text, terminated: index < hunk.added.length - 1 || hunk.newTerminated, },);
      },),
    };
  },);
}

//endregion Ordinary zero-context hunks
