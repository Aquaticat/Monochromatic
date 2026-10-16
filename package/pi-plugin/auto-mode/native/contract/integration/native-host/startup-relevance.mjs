import {homedir} from 'node:os';
import {join} from 'node:path';
import {tagged} from '@monochromatic-dev/module-logger/ts';
import {createAssessmentSender} from '../maintained-policy.mjs';
import {ruleAssessmentModel} from '../action-policy/assessment-model.ts';
import {parseBatchAnswer} from '../../research/instruction-prerequisite-relation/protocol.mjs';

//region Startup uses independent bounded classification with the incumbent cache and transport.
/** Bind project-local cache identity without including the full policy in classifier requests. */
export function createStartupRelevance({root,parse}){
 const l=tagged({tag:createStartupRelevance.name});
 const now=()=>performance.now();
 const send=createAssessmentSender({fetchImpl:globalThis.fetch,now,readCredential:()=>process.env.AUTO_MODE_LLMGATEWAY_API_KEY});
 async function assessBatch({request,signal}){
  const al=tagged({tag:assessBatch.name,l});
  const answers=[];
  // Each HTTP request fits the provider question limit and retains its own deadline.
  for(let offset=0;offset<request.rules.length;offset+=200){
   signal?.throwIfAborted();
   const rules=request.rules.slice(offset,offset+200);
   const questions=Object.fromEntries(rules.map(function question(rule,index){
    return [`rule_${index}`,{type:'noul',instructions:{predicate:request.definition.question,selectedRule:{id:rule.id,text:rule.text,headings:rule.headings}},criteria:request.definition.criteria}];
   }));
   const lifetime=AbortSignal.timeout(15_000);
   const body=JSON.stringify({model:ruleAssessmentModel,state:{remit:request.definition.remit},questions});
   al.debug(`classifying ${rules.length} changed policy rules`);
   const raw=await send({body,signal:signal?AbortSignal.any([signal,lifetime]):lifetime,deadlineAt:now()+15_000,attempt:1});
   const result=parseBatchAnswer({raw,plan:{model:ruleAssessmentModel,questions}});
   answers.push(...rules.map(function answer(rule,index){return {id:rule.id,probability:result.scalars[`rule_${index}`]};}));
  }
  return answers;
 }
 return Object.freeze({
  directory:join(process.env.PI_CODING_AGENT_DIR??join(homedir(),'.pi','agent'),'rule-relevance'),
  namespace:{repository:root,primaryBranch:'project-policy'},
  parse,
  profile:{model:ruleAssessmentModel,questionVersion:'permission-boundaries-2',remitVersion:'human-readable-inputs-1',qualificationVersion:'positive-relevance-0.60-1'},
  assessBatch,
  trace(event){tagged({tag:'relevance-cache',l}).debug(JSON.stringify(event));}
 });
}
//endregion
