import { preparationInputEntryId, } from './preparation-input-read-identity.ts';
import { preparationInputNode, } from './preparation-input-read-node.ts';
import {
  preparationInputDigest,
  preparationInputFields,
  preparationInputItems,
  preparationInputLiteral,
  preparationInputNonblankString,
  type PreparationInputField,
} from './preparation-input-read-value.ts';
import { PreparationRootError, } from './preparation-root-error.ts';
import type {
  PreparationRootQuestionAliases,
  PreparationRootUnalignedDefinitions,
} from './preparation-root-registration-model.ts';

//region Namespace evidence and question aliases do not create additional authority

/**
 Reads explicit nonempty definition namespace evidence outside native aligned parents.
 Membership and complete-entry text correspondence remain whole-root relation checks.

 @internal

 @param value - invocation-owned parsed unaligned namespace

 @param path - authored namespace position

 @returns Frozen separate source and target definition-node inventories

 @throws PreparationRootError when fields, emptiness, node roles or identity uniqueness differ

 @example
 ```ts
 const namespace = preparationInputUnalignedDefinitions({ value, path });
 ```
 */
export function preparationInputUnalignedDefinitions({
  value,
  path,
}: PreparationInputField): PreparationRootUnalignedDefinitions {
  /**
   Namespace records contain no pairing question, writer role or inferred counterpart.
   */
  const field = preparationInputFields({
    value,
    path,
    keys: [
      'scope',
      'entryId',
      'source',
      'target',
    ],
  });
  /**
   Both sides retain their own node identity and coordinate domains.
   */
  const namespace: PreparationRootUnalignedDefinitions = {
    scope: preparationInputLiteral({
      ...field('scope'),
      choices: ['unaligned-definition-namespace'],
    }),
    entryId: preparationInputEntryId(field('entryId')),
    source: preparationInputItems({
      ...field('source'),
      read: preparationInputNode,
    }),
    target: preparationInputItems({
      ...field('target'),
      read: preparationInputNode,
    }),
  };
  /**
   The producer omits a namespace record when both sides are empty.
   */
  const {
    source,
    target,
  } = namespace;
  if ((source.length === 0) && (target.length === 0))
    throw new PreparationRootError({
      kind: 'input-relations',
      input: path,
    });
  for (const nodes of [
    source,
    target,
  ]) {
    /**
     Uniqueness is side-local; identical source and target ID spelling is legitimate.
     */
    const ids = nodes.map(function identity(node): string {
      return node.id;
    });
    if ((new Set(ids).size !== ids.length) || (!nodes.every(function definition(node): boolean {
      return node.zone === 'footnote-definition';
    })))
      throw new PreparationRootError({
        kind: 'input-relations',
        input: path,
      });
  }
  return Object.freeze(namespace);
}

/**
 Reads shared-question occurrence references without using a digest as occurrence or payload authority.
 Exact question bytes and registry membership remain whole-root relation checks.

 @internal

 @param value - invocation-owned parsed alias group

 @param path - authored alias-group position

 @returns Frozen digest spelling and ordered distinct parent references

 @throws PreparationRootError when alias fields, cardinality or identity uniqueness differ

 @example
 ```ts
 const aliases = preparationInputQuestionAliases({ value, path });
 ```
 */
export function preparationInputQuestionAliases({
  value,
  path,
}: PreparationInputField): PreparationRootQuestionAliases {
  /**
   The historical cache key is deliberately absent from alias accounting.
   */
  const field = preparationInputFields({
    value,
    path,
    keys: [
      'questionDigest',
      'parentIds',
    ],
  });
  /**
   References are resolved against already decoded canonical registry identities later.
   */
  const aliases: PreparationRootQuestionAliases = {
    questionDigest: preparationInputDigest({
      ...field('questionDigest'),
      algorithm: 'sha256',
    }),
    parentIds: preparationInputItems({
      ...field('parentIds'),
      read: preparationInputNonblankString,
    }),
  };
  /**
   One occurrence is not a shared-question alias group.
   */
  const { parentIds, } = aliases;
  if ((parentIds.length < 2) || (new Set(parentIds).size !== parentIds.length))
    throw new PreparationRootError({
      kind: 'input-relations',
      input: path,
    });
  return Object.freeze(aliases);
}

//endregion Namespace evidence and question aliases do not create additional authority
