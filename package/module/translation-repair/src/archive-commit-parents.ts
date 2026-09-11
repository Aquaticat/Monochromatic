import { isArchiveGitObjectId, } from './archive-blame.ts';
import { ArchiveNamingEvidenceError, } from './archive-naming-error.ts';

//region Intrinsic commit ancestry
// Parent headers are parsed from the object, never from an effective grafted view.

/**
 * Reads consecutive intrinsic parent headers after the required tree header.
 * Commit messages and continuation headers cannot introduce parents.
 *
 * @param object - raw `git cat-file commit` output
 *
 * @param relPath - archive named for malformed provenance
 *
 * @returns Intrinsic parent IDs, retaining root and merge cardinality
 *
 * @throws {@link ArchiveNamingEvidenceError} for malformed object headers
 *
 * @example
 * ```ts
 * const parents = archiveCommitParents({ object, relPath });
 * ```
 */
export function archiveCommitParents({ object, relPath, }: {
  readonly object: string;
  readonly relPath: string;
},): readonly string[] {
  /**
   * The first blank line ends metadata, regardless of message contents.
   */
  const headerEnd = object.indexOf('\n\n',);
  /**
   * Header lines before any commit message.
   */
  const headers = object.slice(0, headerEnd,).split('\n',);
  /**
   * Required tree identity preceding parent headers.
   */
  const tree = headers[0] ?? '';
  if (headerEnd === -1 || !tree.startsWith('tree ',)
    || !isArchiveGitObjectId(tree.slice('tree '.length,),)) {
    throw new ArchiveNamingEvidenceError({ kind: 'history-shape', relPath, },);
  }
  /**
   * Owned parent list follows Git's consecutive-header grammar.
   */
  const parents: string[] = [];
  for (const line of headers.slice(1,)) {
    if (!line.startsWith('parent ',))
      break;
    /**
     * Parent identity, not an arbitrary revision expression.
     */
    const parent = line.slice('parent '.length,);
    if (!isArchiveGitObjectId(parent,))
      throw new ArchiveNamingEvidenceError({ kind: 'history-shape', relPath, },);
    parents.push(parent,);
  }
  return parents;
}

//endregion Intrinsic commit ancestry
