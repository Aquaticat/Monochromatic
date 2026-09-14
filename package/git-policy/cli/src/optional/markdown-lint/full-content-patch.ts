// Generated from `package/git-policy/markdown-lint/src/full-content-patch.ts` by file-enforcer; edit canonical source owner.
/**
 Full-content Git unified patch for one text candidate.

 Mirrors the shape cli-git's own final-newline policy emits: a single hunk
 that removes every original line and adds every replacement line, which
 `git apply --cached --3way` accepts for a whole-file rewrite.

 @module
 */

import type {
  CandidateFileMode,
  GitObjectId,
  PolicyPatch,
} from '../../api/index.ts';

/**
 Strict decoder; the adapter only patches candidates it already decoded as
 UTF-8, so a failure here is a programmer error.
 */
const DECODER = new TextDecoder(
  'utf-8',
  { fatal: true, },
);

/**
 Patch byte encoder.
 */
const ENCODER = new TextEncoder();

/**
 Marker line Git uses when the previous line lacked a terminal newline.
 */
const NO_NEWLINE_MARKER = String.raw`\ No newline at end of file`;

/**
 Complete logical lines of a text without the terminal split artifact.

 @param text - valid UTF-8 candidate text

 @returns complete lines

 @example
 ```ts
 completeLines('value\n'); // ['value']
 ```
 */
function completeLines(text: string,): readonly string[] {
  /**
   Split lines including a possible terminal artifact.
   */
  const lines = text.split('\n',);
  return text.endsWith('\n',)
    ? lines.slice(
      0,
      -1,
    )
    : lines;
}

/**
 Parameters for {@link createFullContentPatch}.
 */
export type CreateFullContentPatchParams = Readonly<{
  /**
   Invocation-local candidate identity.
   */
  targetId: string;
  /**
   Repository-relative candidate path.
   */
  path: string;
  /**
   Exact candidate blob identity.
   */
  revision: GitObjectId;
  /**
   Ordinary candidate mode.
   */
  mode: Extract<CandidateFileMode, 'regular' | 'executable'>;
  /**
   Exact current text bytes.
   */
  original: Uint8Array;
  /**
   Exact replacement text bytes.
   */
  replacement: Uint8Array;
}>;

/**
 Build one full-content ordinary Git patch.

 @param targetId - invocation-local candidate identity

 @param path - repository-relative candidate path

 @param revision - exact candidate blob identity

 @param mode - ordinary candidate mode

 @param original - exact current text bytes

 @param replacement - exact replacement text bytes

 @returns engine-owned single-path patch

 @example
 ```ts
 createFullContentPatch({ targetId: 't', path: 'README.md', revision: 'abc', mode: 'regular', original, replacement });
 ```
 */
export function createFullContentPatch({
  targetId,
  path,
  revision,
  mode,
  original,
  replacement,
}: CreateFullContentPatchParams,): PolicyPatch {
  /**
   Decoded original text.
   */
  const originalText = DECODER.decode(original,);
  /**
   Decoded replacement text.
   */
  const replacementText = DECODER.decode(replacement,);
  /**
   Complete old lines represented by the removal side of the hunk.
   */
  const originalLines = completeLines(originalText,);
  /**
   Complete new lines represented by the addition side of the hunk.
   */
  const replacementLines = completeLines(replacementText,);
  /**
   Git ordinary-file mode corresponding to the candidate mode.
   */
  const gitMode = mode === 'executable' ? '100755' : '100644';
  /**
   New-object placeholder constrained to the current hash width.
   */
  const replacementOid = '0'.repeat(revision.length,);
  /**
   Complete destination-grammar patch lines.
   */
  const lines = [
    `diff --git a/${path} b/${path}`,
    `index ${revision}..${replacementOid} ${gitMode}`,
    `--- a/${path}`,
    `+++ b/${path}`,
    `@@ -1,${String(originalLines.length,)} +1,${String(replacementLines.length,)} @@`,
    ...originalLines.map(function removeLine(line: string,): string {
      return `-${line}`;
    },),
    ...originalText.endsWith('\n',) ? [] : [NO_NEWLINE_MARKER,],
    ...replacementLines.map(function addLine(line: string,): string {
      return `+${line}`;
    },),
    ...replacementText.endsWith('\n',) ? [] : [NO_NEWLINE_MARKER,],
    '',
  ];
  return {
    kind: 'git-unified',
    targetId,
    path,
    bytes: ENCODER.encode(lines.join('\n',),),
  };
}
