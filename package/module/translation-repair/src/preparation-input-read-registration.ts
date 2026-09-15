import { blockPairingQuestionKey, } from './block-pairing-question-key.ts';
import { hashContent, } from './document-node.ts';
import { preparationInputDefinitionOrder, } from './preparation-input-read-domain.ts';
import { preparationInputQuestion, } from './preparation-input-read-question.ts';
import { preparationInputRegistrationIdentity, } from './preparation-input-read-registration-identity.ts';
import {
  preparationInputDigest,
  preparationInputFields,
  preparationInputLiteral,
  preparationInputObject,
  preparationInputProperty,
  type PreparationInputField,
} from './preparation-input-read-value.ts';
import { PreparationRootError, } from './preparation-root-error.ts';
import type { PreparationDefinitionDomain, } from './preparation-definition-model.ts';
import type { PreparationReceiptQuestion, } from './preparation-receipt-model.ts';
import type {
  PreparationRootDefinitionOrder,
  PreparationRootRegistration,
} from './preparation-root-registration-model.ts';

//region Closed registration variants retain structural records without manufacturing questions

/**
 Native identity fields shared by queried, empty-side and implicit registrations.
 */
const IDENTITY_KEYS = [
  'parentId',
  'entryId',
  'roles',
  'sourceHash',
  'targetHash',
  'pairIndex',
  'sourceIndex',
  'targetIndex',
  'definitionDomain',
] as const;

/**
 Checks queried dispatch and the cardinality and range of its separate definition-index domains.
 Exact definition-node correspondence remains a whole-root check against population metadata.

 @param question - decoded native question

 @param order - decoded explicit local-index arrays

 @param domain - decoded global definition-node identities

 @param path - authored registration position

 @throws PreparationRootError when dispatch, definition cardinality or local bounds differ

 @example
 ```ts
 verifyQueriedRegistration({ question, order, domain, path });
 ```
 */
function verifyQueriedRegistration({
  question,
  order,
  domain,
  path,
}: {
  readonly question: PreparationReceiptQuestion;
  readonly order: PreparationRootDefinitionOrder;
  readonly domain: PreparationDefinitionDomain;
  readonly path: string;
}): void {
  /**
   Native preparation emits no question for empty sides or a structural singleton pair.
   */
  const {
    sourceBlocks,
    targetBlocks,
  } = question;
  if ((sourceBlocks.length === 0)
    || (targetBlocks.length === 0)
    || ((sourceBlocks.length === 1) && (targetBlocks.length === 1)))
    throw new PreparationRootError({
      kind: 'input-relations',
      input: `${path}.question`,
    });
  /**
   Each local-index list names precisely its own side's represented definition inventory.
   */
  const sides = [
    {
      name: 'source',
      indexes: order.source,
      identities: domain.sourceIds,
      blocks: sourceBlocks,
    },
    {
      name: 'target',
      indexes: order.target,
      identities: domain.targetIds,
      blocks: targetBlocks,
    },
  ];
  for (const side of sides) {
    /**
     Source and target range checks cannot borrow the other side's block count.
     */
    const {
      indexes,
      identities,
      blocks,
    } = side;
    if ((indexes.length !== identities.length) || (!indexes.every(function inRange(index): boolean {
      return index < blocks.length;
    })))
      throw new PreparationRootError({
        kind: 'input-relations',
        input: `${path}.freeOrder.${side.name}`,
      });
  }
}

/**
 Decodes every registration field and checks queried identities against the actual native question.
 Structural records have no question fields and cannot carry acquired outcomes.

 @internal

 @param value - invocation-owned parsed registration

 @param path - authored registration position

 @returns Frozen complete native registration without granting acquisition or receipt authority

 @throws PreparationRootError when variant, identity, question or interpretation metadata differs

 @example
 ```ts
 const registration = preparationInputRegistration({ value, path });
 ```
 */
export function preparationInputRegistration({
  value,
  path,
}: PreparationInputField): PreparationRootRegistration {
  /**
   Ordinary object shape is checked before reading the closed dispatch discriminator.
   */
  const record = preparationInputObject({
    value,
    path,
  });
  /**
   Unsupported dispatch does not become an empty or implicit record by default.
   */
  const dispatch = preparationInputLiteral({
    ...preparationInputProperty({
      value: record,
      path,
      key: 'dispatch',
    }),
    choices: [
      'queried',
      'empty',
      'implicit',
    ],
  });
  /**
   Only queried records have numbered questions and their separate identity and order metadata.
   */
  const field = preparationInputFields({
    value,
    path,
    keys: [
      ...IDENTITY_KEYS,
      'dispatch',
      ...(dispatch === 'queried' ? [
        'question' as const,
        'questionKey' as const,
        'questionDigest' as const,
        'freeOrder' as const,
      ] : []),
    ],
  });
  /**
   Shared identity rebuilding preserves definition-only and writer responsibilities independently.
   */
  const identity = preparationInputRegistrationIdentity({
    field,
    path,
  });
  if (dispatch !== 'queried')
    return Object.freeze({
      ...identity,
      dispatch,
    });
  /**
   Complete numbered blocks and native protocol are checked before identity derivation.
   */
  const question = preparationInputQuestion(field('question'));
  /**
   Corrected explicit arrays remain interpretation metadata rather than substantive prompt content.
   */
  const freeOrder = preparationInputDefinitionOrder(field('freeOrder'));
  verifyQueriedRegistration({
    question,
    order: freeOrder,
    domain: identity.definitionDomain,
    path,
  });
  /**
   Historical encoding is intentionally shared with production, including its separate known ambiguity.
   */
  const questionKey = blockPairingQuestionKey(question);
  if (preparationInputDigest({
    ...field('questionKey'),
    algorithm: 'sha256',
  }) !== questionKey)
    throw new PreparationRootError({
      kind: 'input-relations',
      input: `${path}.questionKey`,
    });
  /**
   Complete native question bytes remain distinct from the historical cache encoding.
   */
  const questionDigest = hashContent({ content: JSON.stringify(question), });
  if (preparationInputDigest({
    ...field('questionDigest'),
    algorithm: 'sha256',
  }) !== questionDigest)
    throw new PreparationRootError({
      kind: 'input-relations',
      input: `${path}.questionDigest`,
    });
  return Object.freeze({
    ...identity,
    dispatch,
    question,
    questionKey,
    questionDigest,
    freeOrder,
  });
}

//endregion Closed registration variants retain structural records without manufacturing questions
