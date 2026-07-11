/**
 * Final-newline ordinary Git patch construction.
 *
 * @module
 */
import type {
  CandidateFileMode,
  GitObjectId,
  PolicyPatch,
} from '../api/policy-types.ts';

/**
 * Strict decoder after normalization has established UTF-8 content.
 */
const DECODER = new TextDecoder(
  'utf-8',
  { fatal: true, },
);
/**
 * Patch byte encoder.
 */
const ENCODER = new TextEncoder();

/**
 * Converts text to complete patch lines without terminal split artifact.
 *
 * @param text - valid UTF-8 candidate text
 *
 * @returns complete logical lines
 *
 * @example
 * ```ts
 * completePatchLines('value\n');
 * // => ['value']
 * ```
 */
function completePatchLines(text: string,): readonly string[] {
  /**
   * Split lines including possible terminal artifact.
   */
  const lines = text.split('\n',);
  return text.endsWith('\n',) ? lines.slice(
    0,
    -1,
  ) : lines;
}

/**
 * Builds one full-content ordinary Git patch.
 *
 * @param targetId - invocation-local candidate identity
 *
 * @param path - repository-relative candidate path
 *
 * @param revision - exact candidate blob identity
 *
 * @param mode - ordinary candidate mode
 *
 * @param original - exact current text bytes
 *
 * @param replacement - exact canonical text bytes
 *
 * @returns engine-owned single-path patch
 *
 * @example
 * ```ts
 * createFinalNewlinePatch({ targetId: 't', path: 'a.txt', revision: 'abc', mode: 'regular', original, replacement });
 * ```
 */
export function createFinalNewlinePatch({
  targetId,
  path,
  revision,
  mode,
  original,
  replacement,
}: Readonly<{
  targetId: string;
  path: string;
  revision: GitObjectId;
  mode: Extract<CandidateFileMode, 'regular' | 'executable'>;
  original: Uint8Array;
  replacement: Uint8Array;
}>,): PolicyPatch {
  /**
   * Decoded original text established as valid UTF-8 by classifier.
   */
  const originalText = DECODER.decode(original,);
  /**
   * Decoded canonical replacement text.
   */
  const replacementText = DECODER.decode(replacement,);
  /**
   * Complete old lines represented by removal hunk.
   */
  const originalLines = completePatchLines(originalText,);
  /**
   * Complete new lines represented by addition hunk.
   */
  const replacementLines = completePatchLines(replacementText,);
  /**
   * Git ordinary-file mode corresponding to candidate semantics.
   */
  const gitMode = mode === 'executable' ? '100755' : '100644';
  /**
   * New-object placeholder constrained to current hash width.
   */
  const replacementOid = '0'.repeat(revision.length,);
  /**
   * Complete destination-grammar patch lines.
   */
  const lines = [
    `diff --git a/${path} b/${path}`,
    `index ${revision}..${replacementOid} ${gitMode}`,
    `--- a/${path}`,
    `+++ b/${path}`,
    `@@ -1,${String(originalLines.length,)} +1,${String(replacementLines.length,)} @@`,
    ...originalLines.map(function removeLine(line,) { return `-${line}`; }),
    ...(originalText.endsWith('\n',) ? [] : [String.raw`\ No newline at end of file`,]),
    ...replacementLines.map(function addLine(line,) { return `+${line}`; }),
    '',
  ];
  return {
    kind: 'git-unified',
    targetId,
    path,
    bytes: ENCODER.encode(lines.join('\n',),),
  };
}
