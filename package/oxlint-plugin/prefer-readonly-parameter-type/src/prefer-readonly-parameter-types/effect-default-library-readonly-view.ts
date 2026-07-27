/**
 * Exact semantic recognition for TypeScript's default-library read-only views.
 *
 * @module
 */

import type { Node, } from 'typescript/unstable/ast';
import {
  isIdentifier,
  isInterfaceDeclaration,
  isMethodSignatureDeclaration,
} from 'typescript/unstable/ast/is';
import type { Project, } from 'typescript/unstable/sync';

/**
 * Prefix TypeScript gives every default-library read-only collection view.
 */
const READONLY_VIEW_INTERFACE_PREFIX = 'Readonly';

/**
 * Prove selected declaration is a member of a default-library read-only view.
 *
 * TypeScript declares a read-only view beside each mutable collection and
 * places on it exactly the operations that stay available once the holder may
 * not mutate the value. Membership is therefore upstream's own statement that
 * the member does not mutate the receiver's structure, read off the resolved
 * declaration rather than asserted by a member list here.
 *
 * Measured against TypeScript 7.0.2, `ReadonlyArray`, `ReadonlyMap`,
 * `ReadonlySet` and `ReadonlySetLike` are the whole matching set across 107
 * library files, and none of them declares a mutator. Matching the prefix
 * rather than those four names keeps a view added upstream later covered
 * without an edit here.
 *
 * This proves only that the receiver's own structure survives the call. It says
 * nothing about what user code the member may run, which stays the caller's
 * separate obligation.
 *
 * @param project - TypeScript project proving default-library ownership.
 *
 * @param declaration - Selected callable declaration.
 *
 * @returns Whether declaration is a default-library read-only view member.
 *
 * @example
 * ```typescript
 * isDefaultLibraryReadonlyViewDeclaration({ project, declaration });
 * ```
 */
export function isDefaultLibraryReadonlyViewDeclaration({
  project,
  declaration,
}: {
  readonly project: Project;
  readonly declaration: Node;
}): boolean {
  if ((!isMethodSignatureDeclaration(declaration,))
    || (!project
      .program
      .isSourceFileDefaultLibrary(declaration.getSourceFile(),)))
    return false;
  /**
   * Default-library interface selected as method owner.
   */
  const owner = declaration.parent;
  if ((!isInterfaceDeclaration(owner,)) || (!isIdentifier(owner.name,)))
    return false;
  return owner
    .name
    .text
    .startsWith(READONLY_VIEW_INTERFACE_PREFIX,);
}
