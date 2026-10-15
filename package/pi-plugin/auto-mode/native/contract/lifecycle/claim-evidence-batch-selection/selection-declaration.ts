/**
 Canonicalize fixed predicates against original occurrence identities. @module
 */
import { nonNullishOrThrow } from '@monochromatic-dev/module-or-throw/ts';
import { QuestionSelectionError } from './selection-error.ts';
import type { QuestionCatalog } from './selection-definition-types.ts';
import type {
  QuestionDeclaration,
  SelectionOwner
} from './selection-owner-types.ts';

/**
 Original judgment bounds all declarations, including claims never issued.
 */
const MAX_CLAIMS = 1_536;

//region Canonical claim identity is scoped to one predicate and original binding.
/**
 Bind declaration to the admitted catalog and original judgment owner.
 
 @param owner - original membership and lifetime capabilities
 
 @param catalog - pinned definitions and per-predicate identity indexes
 
 @returns canonical claim declaration operation
 
 @example createClaimDeclaration({ owner, catalog });
 */
export function createClaimDeclaration({
  owner,
  catalog
}: Readonly<{
  owner: SelectionOwner;
  catalog: QuestionCatalog;
}>): (input: QuestionDeclaration) => Readonly<object> {
  /**
   Select an original predicate without reissuing or rebinding an existing claim.
   
   @param definitionId - untrusted pinned predicate name
   
   @param bindingHandle - original enclosing occurrence handle
   
   @returns frozen opaque claim handle
   
   @throws QuestionSelectionError for absent definitions, changed bindings, or exceeded claim bounds
   */
  function declare({
    definitionId,
    bindingHandle
  }: QuestionDeclaration): Readonly<object> {
    return owner.atomic(function selectOriginalClaim(): Readonly<object> {
      /**
       Catalog membership precedes resolver invocation.
       */
      const definition = (typeof definitionId) === 'string' ? catalog.definitions
        .get(definitionId) : undefined;
      if ((!definition) || ((typeof definitionId) !== 'string')) throw new QuestionSelectionError('Selected question definition is not in the pinned catalog');
      /**
       Retain the exact resolver record and its per-definition canonical index.
       */
      const binding = owner.resolve(bindingHandle);
      /**
       Every admitted definition has its own identity index from catalog construction.
       */
      const canonical = nonNullishOrThrow(catalog.byDefinition
        .get(definitionId));
      /**
       Existing claims stay canonical even after issuance or settlement.
       */
      const existing = canonical.get(binding.identity);
      if (existing) {
        /**
         Reusing identity never permits replacing its original record.
         */
        const claim = owner.knownClaim(existing);
        if (claim.binding !== binding) throw new QuestionSelectionError('Binding identity was reused for a different record');
        owner.budget
          .checkpoint();
        return existing;
      }
      if (owner.state
        .declaredCount
        >= MAX_CLAIMS) throw new QuestionSelectionError('Judgment exceeds the declared total claim bound');
      owner.budget
        .checkpoint();
      /**
       Opaque handles reveal neither mutable retention nor occurrence projections.
       */
      const handle = Object.freeze({});
      owner.claims
        .set(
          handle,
          { definitionId, definition, bindingHandle, binding, issued: false }
        );
      canonical.set(
        binding.identity,
        handle
      );
      owner.state
        .declaredCount += 1;
      return handle;
    });
  }
  return declare;
}
//endregion
