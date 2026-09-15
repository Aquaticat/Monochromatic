import { preparationInputDefinitionDomain, } from './preparation-input-read-domain.ts';
import { preparationInputEntryId, } from './preparation-input-read-identity.ts';
import {
  preparationInputDigest,
  preparationInputInteger,
  preparationInputItems,
  preparationInputLiteral,
  preparationInputString,
  type PreparationInputField,
} from './preparation-input-read-value.ts';
import { PreparationRootError, } from './preparation-root-error.ts';
import type {
  PreparationRootParentIdentity,
  PreparationRootParentRole,
} from './preparation-root-registration-model.ts';

//region Registered identities retain writer membership and definition responsibilities separately

/**
 Selector bound to an already checked registration key inventory.

 @internal
 */
export type PreparationInputRegistrationField = (key: keyof PreparationRootParentIdentity) => PreparationInputField;

/**
 Reads one supported membership role without deriving it from dispatch or model outcomes.

 @param field - invocation-owned parsed role and authored array position

 @returns Matching native role literal

 @throws PreparationRootError when role spelling is unsupported

 @example
 ```ts
 const role = readRegistrationRole(field);
 ```
 */
function readRegistrationRole(field: PreparationInputField): PreparationRootParentRole {
  return preparationInputLiteral({
    ...field,
    choices: [
      'writer-parent',
      'footnote-definitions',
    ],
  });
}

/**
 Rebuilds the identity shared by structural and queried registrations.
 Selection membership and complete-document hash correspondence remain whole-root checks.

 @internal

 @param field - selector restricted to decoded registration fields

 @param path - authored registration position

 @returns Frozen canonical parent identity with ordered, definition-consistent roles

 @throws PreparationRootError when identity fields or role/domain relationships differ

 @example
 ```ts
 const identity = preparationInputRegistrationIdentity({ field, path });
 ```
 */
export function preparationInputRegistrationIdentity({
  field,
  path,
}: {
  readonly field: PreparationInputRegistrationField;
  readonly path: string;
}): PreparationRootParentIdentity {
  /**
   Registered source and target hashes identify complete documents, not parent-side text.
   */
  const identity: PreparationRootParentIdentity = {
    parentId: preparationInputString(field('parentId')),
    entryId: preparationInputEntryId(field('entryId')),
    roles: preparationInputItems({
      ...field('roles'),
      read: readRegistrationRole,
    }),
    sourceHash: preparationInputDigest({
      ...field('sourceHash'),
      algorithm: 'sha256',
    }),
    targetHash: preparationInputDigest({
      ...field('targetHash'),
      algorithm: 'sha256',
    }),
    pairIndex: preparationInputInteger(field('pairIndex')),
    sourceIndex: preparationInputInteger(field('sourceIndex')),
    targetIndex: preparationInputInteger(field('targetIndex')),
    definitionDomain: preparationInputDefinitionDomain(field('definitionDomain')),
  };
  /**
   Canonical spelling refers to independent side indexes rather than combined pair position.
   */
  const {
    parentId,
    entryId,
    sourceIndex,
    targetIndex,
    roles,
    definitionDomain,
  } = identity;
  if (parentId !== `${entryId}/source-section/${String(sourceIndex)}/target-section/${String(targetIndex)}`)
    throw new PreparationRootError({
      kind: 'input-relations',
      input: `${path}.parentId`,
    });
  /**
   Definition responsibility exists precisely when either native definition inventory is nonempty.
   */
  const {
    sourceIds,
    targetIds,
  } = definitionDomain;
  /**
   Writer membership is preserved for subsequent comparison with the frozen selection.
   */
  const writer = roles.includes('writer-parent');
  /**
   Neither empty definitions nor a queried dispatch can create definition authority.
   */
  const definitions = (sourceIds.length > 0) || (targetIds.length > 0);
  /**
   Native registration emits writer membership first and definition responsibility second.
   */
  const expected: readonly PreparationRootParentRole[] = [
    ...(writer ? ['writer-parent' as const] : []),
    ...(definitions ? ['footnote-definitions' as const] : []),
  ];
  if ((roles.length === 0)
    || (roles.length !== expected.length)
    || (!roles.every(function matchesRole(
      role,
      index,
    ): boolean {
      return role === expected[index];
    })))
    throw new PreparationRootError({
      kind: 'input-relations',
      input: `${path}.roles`,
    });
  return Object.freeze(identity);
}

//endregion Registered identities retain writer membership and definition responsibilities separately
