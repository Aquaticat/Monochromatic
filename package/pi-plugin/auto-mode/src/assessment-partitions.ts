/**
 Execute complete question partitions through judgment-owned parallel bundles. @module
 */
import {tagged} from '@monochromatic-dev/module-logger/ts';
import {
  AssessmentTransportError,
  type AssessmentTransportInput
} from './assessment-transport.ts';
import {decodeDecisionResponse} from './decision-response.ts';
import {
  partitionDecisionRequest,
  mergeDecisionResponses
} from './decision-partitions.ts';

/**
 Assessment lifecycle logs exclude all provider and source content.
 */
const l=tagged({tag:'auto-mode-assessment-partitions'});
/** Judgment allowance includes sequential bundles and their parallel calls. */
const transportAllowance = { calls: 9, parallel: 3, } as const;

//region Every bundle retains one shared performance target and actual call accounting.
/**
 Send complete partitions without publishing partial assessment evidence.

 @param input - original lifetime and owned bundle dispatcher
 
 @param sendHttp - fixed provider transport
 
 @param assertLifetime - original cancellation and clock check
 
 @returns complete attributed original answer map
 
 @throws AssessmentTransportError for missing bundle ownership or exhausted bundle allowance

 @example
 ```ts
 await sendAssessmentPartitions({ input, sendHttp, assertLifetime });
 ```
 */
export async function sendAssessmentPartitions({
  input,
  sendHttp,
  assertLifetime
}: {
 readonly input: AssessmentTransportInput;
 readonly sendHttp: (input: AssessmentTransportInput)=>Promise<string>;
 readonly assertLifetime: (input: AssessmentTransportInput)=>void;
}): Promise<string> {
 /**
  Bound diagnostics identify this partition scheduler.
  */
 const rl=tagged({
   tag:sendAssessmentPartitions.name,
   l
 });
 /**
  Each encoded request keeps the complete source state.
  */
 const partitions=partitionDecisionRequest(input.body);
 assertLifetime(input);
 if(partitions.length>transportAllowance.calls)throw new AssessmentTransportError('Complete assessment needs more than the authorized three bundles of three provider calls; no question was dropped');
 if((!input.runBundle) && (partitions.length>1))throw new AssessmentTransportError('Partitioned assessment requires the original judgment bundle owner');
 /**
  Responses stay private until every original question has its attributed answer.
  */
 const responses: string[]=[];
 /**
  Bounded bundle recursion has at most three frames and preserves sequential completion.
  
  @param offset - next unsent partition
  */
 async function sendNextBundle(offset: number): Promise<void> {
  assertLifetime(input);
  /**
   The next bundle contains only previously unsent partitions.
   */
  const selected=partitions.slice(
    offset,
    offset+transportAllowance.parallel
  );
  /**
   Owned transport callbacks receive actual call ordinals and shared cancellation.
   */
  const operations=selected.map(function bindPartition(partition){
   return async function sendPartition(lifetime: {
     readonly signal:AbortSignal;
     readonly targetAt:number;
     readonly attempt:number
   }): Promise<string>{
    /**
     Provider bytes are decoded only while the original judgment remains live.
     */
    const raw=await sendHttp({
      ...input,
      ...lifetime,
      body:partition.body
    });
    assertLifetime(input);
    /**
     Exact question names and ordering bind this response to its partition.
     */
    const response=decodeDecisionResponse({
      raw,
      questions:partition.questions
    });
    assertLifetime(input);
    return response;
   };
  });
  tagged({
    tag:sendNextBundle.name,
    l:rl
  })
    .debug(`dispatching assessment bundle with ${operations.length} calls`);
  if(input.runBundle)responses.push(...await input.runBundle(operations));
  else {
   /**
    Existing standalone consumers can issue only their single request.
    */
   const [operation]=operations;
   if(!operation)throw new AssessmentTransportError('Original assessment partition is missing');
   responses.push(await operation(input));
  }
  /**
   Bounded sequential progression never restarts a completed question.
   */
  const next=offset+selected.length;
  if(next<partitions.length)await sendNextBundle(next);
 }
 await sendNextBundle(0);
 assertLifetime(input);
 return mergeDecisionResponses(responses);
}
//endregion
