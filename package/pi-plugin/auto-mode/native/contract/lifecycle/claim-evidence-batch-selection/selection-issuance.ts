/**
 Issue bounded original membership exactly once before publishing its request. @module
 */
import { Buffer } from 'node:buffer';
import { QuestionSelectionError } from './selection-error.ts';
import type {
  QuestionRequest,
  SelectionOwner
} from './selection-owner-types.ts';

/**
 One issued request retains at most the original declared batch membership.
 */
const MAX_BATCH_CLAIMS = 512;
/**
 One judgment cannot repeatedly sample uncertain claims.
 */
const MAX_BATCHES = 3;
/**
 The original wire profile bounds serialized request bytes.
 */
const MAX_REQUEST_BYTES = 4_194_304;

/**
 Inspect dense own data properties without invoking member accessors.
 
 @param input - untrusted selection array
 
 @returns original ordered handle values
 
 @throws QuestionSelectionError for nonordinary, sparse, hidden, accessor, or duplicate membership
 */
function readClaimHandles(input: unknown): readonly unknown[] {
  if ((!Array.isArray(input)) || (Object.getPrototypeOf(input) !== Array.prototype)
    || (input.length === 0)
    || (input.length > MAX_BATCH_CLAIMS)
    || (Reflect.ownKeys(input)
      .length
      !== (input.length + 1))) throw new QuestionSelectionError('Question batch needs an ordinary dense claim array within the declared bound');
  /**
   Descriptor values remain untrusted until owner membership authentication.
   */
  const handles: unknown[] = [];
  for (let index = 0; index < input.length; index += 1) {
    /**
     Reading the descriptor cannot execute a member getter.
     */
    const property = Object.getOwnPropertyDescriptor(
      input,
      String(index)
    );
    if ((!property) || (!Object.hasOwn(
      property,
      'value'
    ))
      || (property.enumerable !== true)) throw new QuestionSelectionError('Question batch has an accessor, hidden member or missing member');
    handles.push(property.value);
  }
  if (new Set(handles).size !== handles.length) throw new QuestionSelectionError('Question batch repeats a claim');
  return handles;
}

//region Original issuance publishes only after every membership and wire check succeeds.
/**
 Bind request issuance and dispatch inspection to one original owner.
 
 @param owner - original membership and lifetime capabilities
 
 @param digest - admitted catalog digest
 
 @param envelope - original frozen judgment projection
 
 @returns original issuance and current dispatch operations
 
 @example createQuestionIssuance({ owner, digest, envelope });
 */
export function createQuestionIssuance({
  owner,
  digest,
  envelope
}: Readonly<{
  owner: SelectionOwner;
  digest: string;
  envelope: unknown;
}>): Readonly<{
  issue: (input: unknown) => Readonly<object>;
  requestFor: (handle: unknown) => QuestionRequest;
}> {
  /**
   Publish a bounded request without making failed construction consume claims.
   
   @param input - original claim handles in request order
   
   @returns frozen opaque issued batch handle
   
   @throws QuestionSelectionError for invalid, stale, repeated, or oversized selection
   */
  function issue(input: unknown): Readonly<object> {
    return owner.atomic(function constructOriginalQuestionBatch(): Readonly<object> {
      /**
       Inspect array membership before consuming the judgment's batch budget.
       */
      const handles = readClaimHandles(input);
      if (owner.state
        .batchCount
        >= MAX_BATCHES) throw new QuestionSelectionError('Judgment exceeds the declared question batch bound');
      /**
       Resolve every original handle before testing its issuance and currentness.
       */
      const selected = handles.map(function readOriginalClaim(handle) { return owner.knownClaim(handle); });
      for (const claim of selected) {
        if (claim.issued) throw new QuestionSelectionError('Claim was already issued; uncertainty cannot create another selection');
        owner.current(claim);
      }
      owner.budget
        .checkpoint();
      /**
       Immutable question order retains the original projections and catalog digest.
       */
      const request: QuestionRequest = Object.freeze({
        envelope,
        catalogSHA256: digest,
        questions: Object.freeze(selected.map(function describeSelectedClaim(
          claim,
          index
        ) {
          return Object.freeze({
            id: `q${index}`,
            definitionId: claim.definitionId,
            definition: claim.definition,
            binding: claim.binding
              .projection
          });
        })),
        semanticQualification: 'not-established',
        instructionAuthority: 'not-established',
      });
      if (Buffer.byteLength(JSON.stringify(request)) > MAX_REQUEST_BYTES) throw new QuestionSelectionError('Question request exceeds the four MiB wire profile');
      owner.budget
        .checkpoint();
      /**
       Membership becomes issued only after the final budget check.
       */
      const handle = Object.freeze({});
      for (const claim of selected) claim.issued = true;
      owner.batches
        .set(
          handle,
          { selected, request, settled: false }
        );
      owner.state
        .batchCount += 1;
      return handle;
    });
  }
  /**
   Dispatch only a current original batch that has not reached a terminal response.
   
   @param handle - original issued batch handle
   
   @returns exact original immutable request
   
   @throws QuestionSelectionError for foreign, terminal, or changed batches
   */
  function requestFor(handle: unknown): QuestionRequest {
    return owner.atomic(function retainOriginalBatchRequest(): QuestionRequest {
      /**
       Original membership precedes phase and dependency checks.
       */
      const batch = owner.knownBatch(handle);
      if (batch.settled) throw new QuestionSelectionError('Question batch is terminal; it cannot be dispatched again');
      for (const claim of batch.selected) owner.current(claim);
      owner.budget
        .checkpoint();
      return batch.request;
    });
  }
  return {
    issue,
    requestFor
  };
}
//endregion
