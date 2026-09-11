import { ArchiveNamingEvidenceError, } from './archive-naming-error.ts';

//region Ordinary zero-context hunks
// Ranges describe Git's textual replacement, not its semantic purpose.

/**
 * One ordinary hunk with exact removed and added lines.
 *
 * @example
 * ```ts
 * const candidate = hunks.find(hunk => hunk.newStart === originLine);
 * ```
 */
export type ArchiveDiffHunk = {
  /** First predecessor line; zero is allowed for an empty side. */
  readonly oldStart: number;
  /** Declared predecessor line count. */
  readonly oldCount: number;
  /** First current line; zero is allowed for an empty side. */
  readonly newStart: number;
  /** Declared current line count. */
  readonly newCount: number;
  /** Removed lines without diff prefixes. */
  readonly removed: readonly string[];
  /** Added lines without diff prefixes. */
  readonly added: readonly string[];
};

/** Owned mutable arrays while one hunk is being decoded. */
type PendingHunk = Omit<ArchiveDiffHunk, 'removed' | 'added'> & {
  /** Removed lines collected in source order. */
  readonly removed: string[];
  /** Added lines collected in source order. */
  readonly added: string[];
};

/**
 * Reads a decimal protocol field without accepting exponent or whitespace syntax.
 *
 * @param text - one Git numeric field
 * @param relPath - archive named when the protocol is malformed
 * @returns Nonnegative safe integer
 * @throws {@link ArchiveNamingEvidenceError} for invalid decimal fields
 * @example
 * ```ts
 * const line = archiveGitInteger({ text: '12', relPath });
 * ```
 */
export function archiveGitInteger({ text, relPath, }: {
  readonly text: string;
  readonly relPath: string;
},): number {
  /** Parsed count after restricting its lexical form. */
  const value = Number(text,);
  if (text.length === 0 || !Array.from(text,).every(function decimal(character,): boolean {
    return '0123456789'.includes(character,);
  },) || !Number.isSafeInteger(value,) || value < 0) {
    throw new ArchiveNamingEvidenceError({ kind: 'history-shape', relPath, },);
  }
  return value;
}

/**
 * Parses one explicitly signed ordinary hunk range.
 *
 * @param token - minus or plus range field
 * @param sign - expected side marker
 * @param relPath - archive named for malformed input
 * @returns First line and count
 * @throws {@link ArchiveNamingEvidenceError} for malformed ranges
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
  /** Decimal range parts after its required marker. */
  const fields = token.slice(1,).split(',',);
  if (!token.startsWith(sign,) || fields.length > 2)
    throw new ArchiveNamingEvidenceError({ kind: 'history-shape', relPath, },);
  return {
    start: archiveGitInteger({ text: fields[0] ?? '', relPath, },),
    count: archiveGitInteger({ text: fields[1] ?? '1', relPath, },),
  };
}

/**
 * Decodes ordinary zero-context patches with exact declared-count checks.
 *
 * @param patch - complete uncolored, unconverted diff output
 * @param relPath - requested archive path
 * @returns Hunks in emitted order
 * @throws {@link ArchiveNamingEvidenceError} for malformed or combined hunks
 * @example
 * ```ts
 * const hunks = archiveDiffHunks({ patch, relPath });
 * ```
 */
export function archiveDiffHunks({ patch, relPath, }: {
  readonly patch: string;
  readonly relPath: string;
},): readonly ArchiveDiffHunk[] {
  /** Owned hunk builders; only finalized readonly views leave this function. */
  const hunks: PendingHunk[] = [];
  /** Current hunk, absent while reading file headers. */
  let pending: PendingHunk | undefined;
  for (const line of patch.split('\n',)) {
    if (line.startsWith('diff --git ',)) {
      pending = undefined;
      continue;
    }
    if (line.startsWith('@@',)) {
      /** Ordinary header fields; function-context suffixes are not range data. */
      const fields = line.split(' ',);
      if (fields[0] !== '@@' || fields[3] !== '@@')
        throw new ArchiveNamingEvidenceError({ kind: 'history-shape', relPath, },);
      /** Predecessor range. */
      const old = hunkRange({ token: fields[1] ?? '', sign: '-', relPath, },);
      /** Current range. */
      const current = hunkRange({ token: fields[2] ?? '', sign: '+', relPath, },);
      pending = { oldStart: old.start, oldCount: old.count,
        newStart: current.start, newCount: current.count, removed: [], added: [], };
      hunks.push(pending,);
      continue;
    }
    if (pending === undefined)
      continue;
    if (line.startsWith('-',))
      pending.removed.push(line.slice(1,),);
    else if (line.startsWith('+',))
      pending.added.push(line.slice(1,),);
    else if (line !== '' && line !== '\\ No newline at end of file')
      throw new ArchiveNamingEvidenceError({ kind: 'history-shape', relPath, },);
  }
  for (const hunk of hunks) {
    if (hunk.removed.length !== hunk.oldCount || hunk.added.length !== hunk.newCount)
      throw new ArchiveNamingEvidenceError({ kind: 'history-shape', relPath, },);
  }
  return hunks;
}

//endregion Ordinary zero-context hunks
