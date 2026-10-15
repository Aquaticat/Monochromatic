/**
 Partition transport questions while retaining complete shared assessment context. @module
 */
import {tagged} from '@monochromatic-dev/module-logger/ts';
import {decisionRecord,parseDecisionJson,DecisionWireError} from './decision-data.ts';
import {encodeDecisionRequest} from './decision-request.ts';

const l=tagged({tag:'auto-mode-decision-partitions'});

//region Provider limits constrain requests rather than captured instruction sets.
/**
 Encode every original question exactly once, preserving its name and complete state.

 @param body - original complete assessment wire
 @returns provider requests in original question order
 @throws DecisionWireError for invalid wire or an empty question set
 */
export function partitionDecisionRequest(body: string): readonly ReturnType<typeof encodeDecisionRequest>[] {
 tagged({tag:partitionDecisionRequest.name,l}).debug('partitioning complete assessment into provider requests');
 const request=decisionRecord(parseDecisionJson(body));
 const entries=Object.entries(decisionRecord(request.questions));
 if(entries.length===0)throw new DecisionWireError('Assessment requires original questions');
 const partitions: ReturnType<typeof encodeDecisionRequest>[]=[];
 for(let offset=0;offset<entries.length;offset+=200){
  partitions.push(encodeDecisionRequest(JSON.stringify({
   ...request,
   questions:Object.fromEntries(entries.slice(offset,offset+200))
  })));
 }
 return partitions;
}

/**
 Merge already validated responses without changing names or categorical estimates.

 @param responses - complete canonical partition responses in original request order
 @returns complete canonical assessment with original per-request usage retained
 @throws DecisionWireError for duplicate identities or inconsistent serving models
 */
export function mergeDecisionResponses(responses: readonly string[]): string {
 tagged({tag:mergeDecisionResponses.name,l}).debug('merging attributed partition responses');
 if(responses.length===1)return responses[0]??'';
 if(responses.length===0)throw new DecisionWireError('Assessment has no completed partition responses');
 const records=responses.map(response=>decisionRecord(parseDecisionJson(response)));
 const names=new Set<string>();
 const answers: [string,unknown][]=[];
 const usages: Readonly<Record<string,unknown>>[]=[];
 let inputTokens=0;
 let outputTokens=0;
 const model=records[0]?.model;
 for(const record of records){
  if(record.model!==model)throw new DecisionWireError('Partition serving models differ');
  for(const [name,answer] of Object.entries(decisionRecord(record.answers))){
   if(names.has(name))throw new DecisionWireError('Partition responses repeat an original question');
   names.add(name);
   answers.push([name,answer]);
  }
  const usage=decisionRecord(record.usage);
  if(typeof usage.input_tokens!=='number'||typeof usage.output_tokens!=='number')throw new DecisionWireError('Partition usage is unavailable');
  inputTokens+=usage.input_tokens;
  outputTokens+=usage.output_tokens;
  usages.push(usage);
 }
 if(!Number.isSafeInteger(inputTokens)||!Number.isSafeInteger(outputTokens))throw new DecisionWireError('Partition token totals exceed exact integer accounting');
 return JSON.stringify({model,answers:Object.fromEntries(answers),usage:{input_tokens:inputTokens,output_tokens:outputTokens,requests:usages}});
}
//endregion
