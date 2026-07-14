/**
 * Content-bearing raw diff-tree record parsing shared by landed and pushed delta facts.
 *
 * @module
 */
import type {
  CandidateFileMode,
  GitObjectId,
} from '../api/policy-types.ts';

/**
 * Git tree modes mapped to policy modes.
 */
const RAW_DIFF_MODES: Readonly<Record<string, CandidateFileMode>> = {
  '100644': 'regular',
  '100755': 'executable',
  '120000': 'symlink',
  '160000': 'submodule',
};

/**
 * One retained content-bearing change parsed from raw diff-tree output.
 */
export type RawDiffRecord = Readonly<{
  /**
   * Repository-relative changed path.
   */
  path: string;
  /**
   * New-side Git object ID.
   */
  oid: GitObjectId;
  /**
   * Policy candidate mode.
   */
  mode: CandidateFileMode;
  /**
   * Change classification against the diff baseline.
   */
  change: 'added' | 'modified';
}>;

/**
 * Returns required raw metadata field.
 *
 * @param parts - split metadata fields
 *
 * @param index - required field index
 *
 * @param createError - domain error factory for malformed output
 *
 * @returns present metadata field
 *
 * @throws caller-domain error when field is absent
 */
function requiredDiffPart({
  parts,
  index,
  createError,
}: {
  readonly parts: readonly string[];
  readonly index: number;
  readonly createError: (message: string) => Error;
},): string {
  /**
   * Metadata field at required position.
   */
  const value = parts[index];
  if (value === undefined)
    throw createError('Raw diff-tree record metadata is incomplete.',);
  return value;
}

/**
 * Parses NUL-delimited raw diff-tree output into first-wins per-path records.
 *
 * Deletions publish no content and are dropped; with `-m` a merge lists one
 * diff per parent, so the first record retained per path wins.
 *
 * @param text - decoded NUL-delimited raw diff-tree output
 *
 * @param createError - domain error factory for malformed output
 *
 * @returns retained content-bearing records in first-appearance order
 *
 * @throws caller-domain error when output is malformed
 *
 * @example
 * ```ts
 * parseRawDiffRecords({ text: '', createError: function toError(message,) { return new Error(message,); } });
 * // => []
 * ```
 */
export function parseRawDiffRecords({
  text,
  createError,
}: {
  readonly text: string;
  readonly createError: (message: string) => Error;
},): readonly RawDiffRecord[] {
  /**
   * Alternating metadata and path tokens, excluding terminal empty token.
   */
  const tokens = text.split('\0',)
    .filter(function isToken(token,) {
      return token.length > 0;
    },);
  /**
   * First retained record per path across every listed diff.
   */
  const recordsByPath = new Map<string, RawDiffRecord>();
  // Tokens alternate strictly: one colon-prefixed metadata token, then its path.
  for (let cursor = 0; cursor < tokens.length; cursor += 2) {
    /**
     * Colon-prefixed raw metadata token.
     */
    const meta = tokens[cursor];
    /**
     * Companion repository-relative path token.
     */
    const path = tokens[cursor + 1];
    if ((meta === undefined) || (!meta.startsWith(':',))
      || (path === undefined))
      throw createError('Raw diff-tree output is not metadata/path token pairs.',);
    /**
     * Old mode, new mode, old OID, new OID, and status fields.
     */
    const parts = meta.slice(1,)
      .split(' ',);
    /**
     * New-side tree mode text.
     */
    const modeText = requiredDiffPart({
      parts,
      index: 1,
      createError,
    },);
    /**
     * New-side Git object ID.
     */
    const oid = requiredDiffPart({
      parts,
      index: 3,
      createError,
    },);
    /**
     * Single-letter change status against one diff baseline.
     */
    const status = requiredDiffPart({
      parts,
      index: 4,
      createError,
    },);
    // Deleted paths carry no new-side content and never become candidates.
    if (status === 'D')
      continue;
    if ((status !== 'A') && (status !== 'M')
      && (status !== 'T'))
      throw createError(`Unsupported raw diff status ${status} for ${path}`,);
    /**
     * Policy mode mapped from new-side Git mode.
     */
    const mode = RAW_DIFF_MODES[modeText];
    if (mode === undefined)
      throw createError(`Unsupported raw diff mode ${modeText} for ${path}`,);
    if (!recordsByPath.has(path,))
      recordsByPath.set(
        path,
        {
          path,
          oid,
          mode,
          change: status === 'A' ? 'added' : 'modified',
        },
      );
  }
  return [...recordsByPath.values(),];
}
