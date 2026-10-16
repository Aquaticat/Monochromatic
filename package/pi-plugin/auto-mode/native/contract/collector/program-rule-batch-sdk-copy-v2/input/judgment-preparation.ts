/**
 Original preparation seals sources and complete membership within one judgment lifetime. @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { createQuestionSelection } from '../../../lifecycle/claim-evidence-batch-selection/selection-owner.ts';
import { JudgmentConstructionError } from './judgment-error.ts';
import { capturePreparedJudgmentJSON } from './judgment-prepared-input.ts';
import { publishJudgmentMembers } from './judgment-preparation-publication.ts';
import type {
  JudgmentPreparationInput,
  JudgmentPreparationState,
  JudgmentPreparation,
  JudgmentPreparationSources,
} from './judgment-preparation-types.ts';

/**
 Preparation diagnostics omit native member arguments, source contents, and request bodies.
 */
const l = tagged({ tag: 'auto-mode-judgment-preparation' });

//region Complete preparation publishes once and keeps original failures terminal.
/**
 Bind original source sealing, dependencies, selection, and complete native member publication.

 @param input - original native preparation capabilities and shared member maps

 @returns original preparation operation, known selection, and retained phase state

 @example createJudgmentPreparation(input);
 */
export function createJudgmentPreparation<const Source extends JudgmentPreparationSources>(input: JudgmentPreparationInput<Source>): JudgmentPreparation {
  /**
   Entry diagnostics do not inspect original source or prepared-member contents.
   */
  const rl = tagged({
    tag: createJudgmentPreparation.name,
    l
  });
  rl.debug('binding original judgment preparation');
  /**
   Original capabilities remain fixed while their live source and dependency reads stay lazy.
   */
  const {
    active,
    budget,
    declaredNames,
    observer,
    response,
    receipt,
    readJudgmentSources,
    publishJudgmentSources,
    facade,
    signal,
    parentJSON,
    catalogText,
    catalogSHA256,
    resolveBinding,
    bindings,
    byMember,
  } = input;
  /**
   Preparation outcome remains distinct from later assessment and evidence closure.
   */
  const state: JudgmentPreparationState = {
    prepared: false,
    preparing: false,
    preparationFailed: false,
  };
  /**
   Require the original selection created by this preparation attempt.

   @returns original selection without replacing its identity

   @throws JudgmentConstructionError before selection has been constructed
   */
  function knownSelection(): ReturnType<JudgmentPreparation['knownSelection']> {
    if (!state.selection) throw new JudgmentConstructionError('Judgment question selection was not prepared');
    return state.selection;
  }
  /**
   Seal original sources and dependencies before publishing complete prepared membership.

   @param members - original final native members in declaration order

   @throws JudgmentConstructionError for reentry, replaced membership, changed sources, or missing mandatory policy
   */
  function prepare(members: Parameters<JudgmentPreparation['prepare']>[0]): void {
    active();
    if (state.prepared || state.preparing) throw new JudgmentConstructionError('Prepared judgment membership cannot be replaced or reentered');
    state.preparing = true;
    /**
     Every successful and failed exit releases only the transient preparation flag.
     */
    using preparation = { [Symbol.dispose](): void { 
      state.preparing = false; 
    } };
    try {
      /**
       Complete immutable inputs are serialized before any source sealing or dependency preparation.
       */
      const preparedJSON = capturePreparedJudgmentJSON({
        members,
        declaredNames
      });
      /**
       Original truthiness selects the source-sealing path without invoking its presence marker.
       */
      const hasSourceSeal = Boolean(observer.beginJudgmentSources);
      if (hasSourceSeal) {
        /**
         Prepared sources must still belong to the original request receipt.
         */
        const binding = observer.sealJudgmentSources(response);
        if (binding.request !== receipt) throw new JudgmentConstructionError('Prepared sources lost their original request receipt');
        publishJudgmentSources(binding.sources);
      }
      /**
       Dependencies retain the original signal and are finalized before selection construction.
       */
      const dependencyHandle = facade.prepare({ signal });
      active();
      facade.finalize(dependencyHandle);
      budget.checkpoint();
      /**
       Original mandatory policy is retained by identity after its existing completeness check.
       */
      const {mandatoryPolicy} = readJudgmentSources();
      if ((!mandatoryPolicy) || (!Object.isFrozen(mandatoryPolicy))
        || ((typeof mandatoryPolicy.content) !== 'string')) {
        throw new JudgmentConstructionError('Original request lacks complete owned mandatory policy');
      }
      /**
       Frozen selection context preserves original serialized inputs and source projections.
       */
      const sources=readJudgmentSources();
      if(sources.decisionContext?.selection?.failure)throw new JudgmentConstructionError('Project policy relevance could not be classified; this operation needs manual review',{cause:sources.decisionContext.selection.failure});
      /** Current assessment sources retain the same original read and snapshot identity. */
      const envelope = Object.freeze({
        parentJSON,
        preparedJSON,
        requestBody: receipt.request
          .body,
        mandatoryPolicy,
        governingSources: sources.decisionContext?.sources ?? sources.governingSources,
        policyMaterial:sources.decisionContext?.selection?.material,
        instructionAuthority: 'not-established',
      });
      state.selection = createQuestionSelection({
        catalogText,
        catalogSHA256,
        budget,
        resolveBinding,
        envelope
      });
      active();
      budget.checkpoint();
      publishJudgmentMembers({
        members,
        bindings,
        byMember,
        signal
      });
      state.handle = dependencyHandle;
      state.prepared = true;
    } catch (error) {
      state.preparationFailed = true;
      state.preparationFailure = error;
      throw error;
    }
  }
  return {
    state,
    prepare,
    knownSelection
  };
}
//endregion
