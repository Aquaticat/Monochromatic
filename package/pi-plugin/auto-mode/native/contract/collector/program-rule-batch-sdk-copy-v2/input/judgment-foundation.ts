/**
 Original construction foundation preserves observation and ownership order. @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import {createJudgmentBudget} from '../../../lifecycle/judgment-budget-error-occurrences/controls-private/candidate.ts';
import {createDependencyFacade} from '../../../lifecycle/native-text-read-contract/dependencies.mjs';
import {readMainAgentRequest} from '../../request-producer-group-consumer/request.ts';
import {createJudgmentSources} from './judgment-sources.ts';
import type {
  JudgmentFoundationInput,
  JudgmentFoundation
} from './judgment-foundation-types.ts';
import type {JudgmentConstructorSources} from './judgment-constructor-types.ts';
/**
 Foundation logging omits original request and source values.
 */
const l=tagged({tag:'auto-mode-judgment-foundation'});
//region Original budget and observations precede shared membership allocation.
/**
 Create original budget and retained native observations before dependent owners.

 @param input - original occurrence and captured bootstrap capabilities

 @returns independent budget, source owner, and shared membership records

 @example createJudgmentFoundation(input);
 */
export function createJudgmentFoundation<const Source extends JudgmentConstructorSources,const Root extends object>(input:JudgmentFoundationInput<Source,Root>):JudgmentFoundation<Source>{
/**
 Captured original occurrence supplies every observation without copying its sources.
 */
const {
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
  assertDependenciesCurrent
}=input;
/**
 Diagnostics identify the boundary without inspecting its inputs.
 */
const rl=tagged({
  tag:createJudgmentFoundation.name,
  l
});
rl.debug('creating original judgment foundation');
    /**
     First budget observation retains original decision start time.
     */
    const clockState={firstClockRead:true};
    /**
     Original budget retains observation order and caller identity.
     */
    const budget=createJudgmentBudget({
      now:function readJudgmentClock() {
        if(clockState.firstClockRead){
        clockState.firstClockRead=false;
        return startedAt;
      }
        return now();
      },
      signal,
      isRetryableTransportFailure
    });
    budget.checkpoint();
    /**
     Original requestInput retains observation order and caller identity.
     */
    const requestInput={
      producerOwner,
      observer,
      stream,
      response
    };
    /**
     Original sourceOwner retains observation order and caller identity.
     */
    const sourceOwner=createJudgmentSources({
      observer,
      response,
      signal,
      collector,
      readOriginalRequest(){
        return readMainAgentRequest(requestInput);
      },
      assertDependenciesCurrent(){
        return assertDependenciesCurrent();
      }
    });
    /**
     Original owner results retain source and response identity.
     */
    const {
      receipt,
      readCurrentSourceBinding
    }=sourceOwner;
    /**
     Original owner results retain source and response identity.
     */
    const group=input.group();
    /**
     Original facade retains observation order and caller identity.
     */
    const facade=createDependencyFacade({
      collector:sourceOwner.collector,
      rootAdapter,
      targetAt:budget.diagnostics()
        .targetAt,
      rootDirectory,
      files,
      trace,
      now
    });
return {
  ...group,
  budget,
  requestInput,
  sourceOwner,
  receipt,
  readCurrentSourceBinding,
  facade
};
}
//endregion
