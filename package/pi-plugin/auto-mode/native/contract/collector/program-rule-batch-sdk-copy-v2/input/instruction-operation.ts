/**
 Whole-operation decisions retain the original request identity without exposing its archived request body. @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { retainInstructionHandle } from './instruction-ownership.ts';
import type { InstructionContext, InstructionRecord } from './instruction-types.ts';

/** Operation claim diagnostics omit original instructions and command contents. */
const l = tagged({ tag: 'auto-mode-operation-decision-claim' });

//region The judgment envelope owns every prepared member and selected source.

/**
 Bind a final operation decision to the original judgment occurrence.

 @param context - original request, claim selection, and private binding owner

 @returns canonical whole-operation claim declaration
 */
export function createOperationDecisionClaim({ input, state }: InstructionContext): () => object {
  /** Original capabilities remain lazy until the decision fallback is needed. */
  const { ready, receipt, knownSelection } = input;
  /** Factory diagnostics preserve their original module boundary. */
  const rl = tagged({ tag: createOperationDecisionClaim.name, l });
  rl.debug('binding whole-operation decision claim');
  /**
   Declare the complete prepared operation under its unchanged request identity.

   @returns original claim handle for assessment under the existing judgment budget
   */
  function claimOperationDecision(): object {
    tagged({ tag: claimOperationDecision.name, l: rl }).debug('declaring original whole-operation decision');
    ready();
    /** The envelope, rather than a caller-supplied member array, supplies complete operation content. */
    const { request } = receipt;
    /**
     Retain an opaque original identity and a scope-only wire projection.

     @returns original request dependency and its bound question projection
     */
    function createRecord(): InstructionRecord {
      return {
        kind: 'whole-operation-decision',
        request,
        binding: Object.freeze({
          identity: request,
          projection: Object.freeze({ claimScope: 'complete-prepared-operation' }),
        }),
      };
    }
    /** Canonical identity prevents repeated sampling through another equivalent claim. */
    const bindingHandle = retainInstructionHandle({
      state,
      map: state.programInstructionPairs,
      key: request,
      createRecord,
    });
    return knownSelection().declare({ definitionId: 'operation_decision', bindingHandle });
  }
  return claimOperationDecision;
}

//endregion Original operation identity
