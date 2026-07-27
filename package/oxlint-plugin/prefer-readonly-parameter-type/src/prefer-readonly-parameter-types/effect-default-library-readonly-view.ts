/**
 * Exact semantic classification for default-library collection members.
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

import {
  defaultLibraryViewMembers,
  READONLY_VIEW_INTERFACE_PREFIX,
} from './effect-default-library-view-members.ts';

/**
 * Member leaves the receiver's own structure intact.
 */
export const COLLECTION_STRUCTURE_PRESERVED: unique symbol = Symbol(
  'default-library member preserves receiver structure',
);

/**
 * Member restructures the receiver.
 */
export const COLLECTION_STRUCTURE_MUTATED: unique symbol = Symbol(
  'default-library member restructures receiver',
);

/**
 * Member belongs to no collection whose structural effect is derivable.
 */
export const COLLECTION_UNRECOGNIZED: unique symbol = Symbol(
  'declaration is not a derivable default-library collection member',
);

/**
 * How a default-library collection member treats its receiver's structure.
 */
export type CollectionStructureClaim =
  | typeof COLLECTION_STRUCTURE_PRESERVED
  | typeof COLLECTION_STRUCTURE_MUTATED
  | typeof COLLECTION_UNRECOGNIZED;

/**
 * Classify a resolved declaration's effect on its receiver's structure.
 *
 * Two cases are derivable, both from upstream's own declarations. A member of a
 * `Readonly*` view preserves structure by definition, since the view exists to
 * name the operations available to a holder that may not mutate. A member of a
 * mutable collection preserves structure when the paired view declares the same
 * name, and restructures the receiver when it does not: TypeScript builds each
 * view by removing exactly the mutators, so the difference between the two
 * interfaces is upstream's own mutator list.
 *
 * Measured against TypeScript 7.0.2, that difference is `add`, `clear` and
 * `delete` for `Set`; `clear`, `delete`, `getOrInsert`, `getOrInsertComputed`
 * and `set` for `Map`; and `copyWithin`, `fill`, `pop`, `push`, `reverse`,
 * `shift`, `sort`, `splice` and `unshift` for `Array`. No view declares a member
 * its mutable interface lacks, so the partition is exact in both directions.
 *
 * A collection with no paired view, `WeakMap`, `WeakSet`, a typed array, or any
 * host interface, is unrecognized and keeps failing closed.
 *
 * This answers only what happens to the receiver's structure. What user code the
 * member can run remains a separate obligation for the caller.
 *
 * @param project - TypeScript project proving default-library ownership.
 *
 * @param declaration - Selected callable declaration.
 *
 * @returns structural claim derivable for declaration.
 *
 * @example
 * ```typescript
 * collectionStructureClaim({ project, declaration }) === COLLECTION_STRUCTURE_MUTATED;
 * ```
 */
export function collectionStructureClaim({
  project,
  declaration,
}: {
  readonly project: Project;
  readonly declaration: Node;
}): CollectionStructureClaim {
  if ((!isMethodSignatureDeclaration(declaration,))
    || (!isIdentifier(declaration.name,))
    || (!project
      .program
      .isSourceFileDefaultLibrary(declaration.getSourceFile(),)))
    return COLLECTION_UNRECOGNIZED;
  /**
   * Default-library interface selected as method owner.
   */
  const owner = declaration.parent;
  if ((!isInterfaceDeclaration(owner,)) || (!isIdentifier(owner.name,)))
    return COLLECTION_UNRECOGNIZED;
  /**
   * Owner interface name deciding which claim is derivable.
   */
  const ownerName = owner
    .name
    .text;
  if (ownerName.startsWith(READONLY_VIEW_INTERFACE_PREFIX,))
    return COLLECTION_STRUCTURE_PRESERVED;
  /**
   * Member names on the read-only view paired with this owner, when one exists.
   */
  const pairedViewMembers = defaultLibraryViewMembers({ project, },)
    .get(`${READONLY_VIEW_INTERFACE_PREFIX}${ownerName}`,);
  if (pairedViewMembers === undefined)
    return COLLECTION_UNRECOGNIZED;
  /**
   * Member name deciding whether the paired view retains this operation.
   */
  const memberName = declaration.name
    .text;
  return pairedViewMembers.has(memberName,)
    ? COLLECTION_STRUCTURE_PRESERVED
    : COLLECTION_STRUCTURE_MUTATED;
}
