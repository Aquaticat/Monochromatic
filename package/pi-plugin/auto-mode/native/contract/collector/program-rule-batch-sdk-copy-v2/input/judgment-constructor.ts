/**
 Original judgment construction composes independently owned native capabilities. @module
 */
import {tagged} from '@monochromatic-dev/module-logger/ts';
import type {
  JudgmentConstructorSources,
  JudgmentConstructorInput,
  JudgmentConstructionInput
} from './judgment-constructor-types.ts';
import type {JudgmentPublicAPI} from './judgment-api-types.ts';
import {createJudgmentFoundation} from './judgment-foundation.ts';
import type { QuestionSelection } from '../../../lifecycle/claim-evidence-batch-selection/selection-owner.ts';
import {publishJudgment} from './judgment-publication.ts';
import {createJudgmentInstructions} from './instruction-owner.ts';
import {createJudgmentDependencyChecks} from './judgment-dependencies.ts';

import {readMainAgentRequest} from "../../request-producer-group-consumer/request.ts";

import {createJudgmentPrograms} from './program-owner.ts';
import {createJudgmentLifecycle} from './judgment-lifecycle.ts';
import {createJudgmentPreparation} from './judgment-preparation.ts';
import {createJudgmentInspection} from './judgment-inspection.ts';

/**
 Construction logs never serialize native inputs or original source collections.
 */
const l=tagged({tag:'auto-mode-judgment-constructor'});

//region Fixed session-bound creator; all inputs come from the owned native JSON/prepared-member profile.
/**
 Bind one native consumer to source/root/file observers, fixed catalog and owned transport dependencies.

 @param options - fixed bootstrap capabilities retained across original occurrences

 @returns original occurrence constructor with independent ownership and lifetime

 @example createJudgmentConstructor(options);
 */
export function createJudgmentConstructor<const Source extends JudgmentConstructorSources, const Root extends object>(options: JudgmentConstructorInput<Source, Root>): (input: JudgmentConstructionInput) => JudgmentPublicAPI<Source> {
  /**
   Fixed bootstrap capabilities are captured once for original judgment construction.
   */
  const {
    now,
    producerOwner,
    observer,
    collector,
    rootAdapter,
    rootDirectory,
    files,
    catalogText,
    catalogSHA256,
    send,
    isRetryableTransportFailure,
    trace,
    parsePolicy
  } = options;
  /**
   Constructor diagnostics omit source values and native occurrence identities.
   */
  const rl = tagged({
    tag:createJudgmentConstructor.name,
    l
  });
  rl.debug('binding original judgment constructor');
  return function construct({
    startedAt,
    signal,
    response,
    stream,
    group
  }: JudgmentConstructionInput): JudgmentPublicAPI<Source> {
    /**
     Selection remains lazy until original preparation publishes it.

     @returns original prepared question selection
     */
    function knownSelection(): QuestionSelection { 
      return preparation.knownSelection(); 
    }
    /**
     Construction starts without reading source or response contents for diagnostics.
     */
    const cl = tagged({
      tag:construct.name,
      l:rl
    });
    cl.debug('constructing original judgment');
    /**
     Original foundation preserves budget, source, membership, and facade ordering.
     */
    /**
     Original owner capabilities retain captured method identities.
     */
    const {
      budget,
      requestInput,
      sourceOwner,
      receipt,
      readCurrentSourceBinding,
      parentJSON,
      declaredNames,
      facade,
      bindings,
      byMember,
      childGroups,
      executions,
      preparedJSON
    }=createJudgmentFoundation({
      now,
      producerOwner,
      observer,
      collector,
      rootAdapter,
      rootDirectory,
      files,
      isRetryableTransportFailure,
      trace,
      startedAt,
      signal,
      response,
      stream,
      group,
      assertDependenciesCurrent(){return assertDependenciesCurrent();}
    });
    /**
     Original owner capabilities retain captured method identities.
     */
    const {
      active,
      ready,
      dependencyCheck,
      bindingSegment,
      assertDependenciesCurrent,
      isBindingSegmentActive
    } = createJudgmentDependencyChecks({
      budget,
      readOriginalRequest(){
        return readMainAgentRequest(requestInput);
      },
      receipt,
      facade,
      byMember,
      bindings,
      trace,
      readPreparation() {
        /**
         Original owner capabilities retain captured method identities.
         */
    const {
      prepared,
      preparationFailed,
      preparationFailure,
      handle
    }=preparation.state;
        return {
          prepared,
          preparationFailed,
          preparationFailure,
          finished:lifecycle.state
            .finished,
          closeFailed:lifecycle.state
            .closeFailed,
          finalRecord:lifecycle.state
            .finalRecord,
          handle
        };
      }
    });
    /**
     Original lifecycle shares preparation and dependency boundaries.
     */
    const lifecycle=createJudgmentLifecycle({
      knownSelection,
      ready,
      active,
      bindingSegment,
      assertDependenciesCurrent,
      budget,
      finalizeDependencies(dependencyHandle){
        return facade.finalize(dependencyHandle);
      },
      readDependencyHandle(){
        return preparation.state
          .handle;
      },
      parentJSON,
      send
    });
    /**
     Original owner capabilities retain captured method identities.
     */
    const {
      operation,
      issue
    }=lifecycle;
    /**
     Original owner capabilities retain captured method identities.
     */
    const instructions=createJudgmentInstructions({
      ready,
      bindingSegment,
      isBindingSegmentActive,
      readJudgmentSources:sourceOwner.readSourceSnapshot,
      declaredNames,
      byMember,
      bindings,
      knownSelection,
      parsePolicy,
      receipt,
      issue
    });
    /**
     Captured original methods link subsequent owners without invoking them.
     */
    const {resolveBinding}=instructions;

    /**
     Original preparation remains lazy until native members are complete.
     */
    const preparation=createJudgmentPreparation({
      parsePolicy,
      active,
      budget,
      declaredNames,
      observer,
      response,
      receipt,
      readJudgmentSources:sourceOwner.readSourceSnapshot,
      publishJudgmentSources:sourceOwner.publishJudgmentSources,
      facade,
      signal,
      parentJSON,
      catalogText,
      catalogSHA256,
      resolveBinding,
      bindings,
      byMember,
      preparedJSON
    });
    /**
     Original owner capabilities retain captured method identities.
     */
    const {prepare}=preparation;

    /**
     Captured original methods link subsequent owners without invoking them.
     */
    const {
      knownMember,
      knownExecution,
      parentCurrent
    }=executions;
    /**
     Original owner capabilities retain captured method identities.
     */
    const programs=createJudgmentPrograms({
      readJudgment() { 
        return judgment; 
      },
      response,
      stream,
      signal,
      knownMember,
      knownExecution,
      ready,
      dependencyCheck,
      assertDependenciesCurrent,
      parentCurrent,
      bindings,
      childGroups,
      operation
    });
    /**
     Captured original methods link subsequent owners without invoking them.
     */
    const {
      inspectProgram,
      inspectReachedGroup
    }=programs;
    /**
     Original owner capabilities retain captured method identities.
     */
    const inspection=createJudgmentInspection({
      preparation:preparation.state,
      lifecycle:lifecycle.state,
      budget,
      byMember,
      bindings,
      childGroups,
      knownMember,
      assertDependenciesCurrent,
      parentCurrent,
      ready,
      originalFile(input){
        return facade.originalFile(input);
      },
      inspectProgram,
      inspectReachedGroup
    });
    budget.checkpoint();
    /**
     Public ownership is published after the final construction checkpoint.
     */
    const judgment=publishJudgment({
      programs,
      executions,
      lifecycle,
      instructions,
      inspection,
      sourceOwner,
      prepare,
      knownSelection,
      active,
      assertDependenciesCurrent,
      readCurrentSourceBinding
    });
    return judgment;
  };
}
//endregion
