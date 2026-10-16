import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createEnvironment} from '../dist/native/contract/integration/native-batch/environment.mjs';
import {createStartupRelevance} from '../dist/native/contract/integration/native-host/startup-relevance.mjs';
import {captureDecisionContext} from '../dist/native/contract/integration/policy-source/decision-context.mjs';
import {createGoverningRuleSet} from '../dist/native/contract/lifecycle/governing-rule-candidates/set-owner.ts';
import {projectPolicyMaterial,projectVisibleOperation} from '../dist/native/contract/integration/action-policy/wire-material.mjs';

//region Built resource initialization and reload drive the original cache and transport.
const policyText='# Fixture permission rules\n\nRUL: Never read restricted.txt.\n\nUNK: Uncertain fixture rule.\n\nFMT: Use sentence case.\n\nEDG: Ask before publishing.\n';
const requests=[];
const scores={RUL:0.9,UNK:0.59,FMT:0.1,EDG:0.6};
const state={fail:false};
const env=await createEnvironment({policyText,createRelevance({root,parse}){
 process.env.AUTO_MODE_LLMGATEWAY_API_KEY='synthetic-startup-fixture';
 globalThis.fetch=async function authoredClassifier(url,init){
  assert.equal(String(url),'https://api.llmgateway.io/v1/decisions');
  const request=JSON.parse(init.body);
  requests.push(request);
  assert.equal(init.body.includes(JSON.stringify(policyText).slice(1,-1)),false);
  assert.equal(init.body.includes('fullPolicy'),false);
  if(state.fail)throw new Error('Authored startup classification failure');
  return Response.json({model:request.model,answers:request.questions.map(function answer(question){
   const selected=JSON.parse(question.instructions).instructions.selectedRule;
   assert.equal(selected.text.startsWith(selected.id+':'),true);
   return {name:question.name,type:'predicate',probability:scores[selected.id]};
  }),usage:{input_tokens:100,output_tokens:0}});
 };
 return createStartupRelevance({root,parse});
}});
await using cleanup={async [Symbol.asyncDispose](){await env.drain();}};
assert.equal(requests.length,1,'Initialization must classify missing rules before the first tool call');
assert.equal(requests[0].questions.length,4);
const first=env.policyInput.readCurrent();
assert.equal(first.relevanceFailure,undefined);
const hidden=Object.freeze({content:'HIDDEN_TOOL_PROMPT',occurrence:Object.freeze({})});
const snapshot={hostGoverningPolicy:first.source,contextPromptInputs:[],hostPromptInput:hidden,resourceSystemInput:hidden,appendPromptInputs:[hidden],forcedPromptInput:hidden,toolGuidelineInputs:[hidden],skillDescriptionInputs:[hidden],builtInPromptInputs:[hidden]};
const decision=captureDecisionContext({snapshot,input:first});
assert.deepEqual(decision.sources,[first.source]);
const excludedRules=decision.selection.excluded.map(function excluded(rule){return {...rule,sourceOrdinal:0};});
const bindings=createGoverningRuleSet({parse:env.parser.parse,readSources(){return decision.sources;},excludedRules});
const selectedCodes=bindings.indexedCandidates().map(function code(handle){return bindings.read(handle).code;});
assert.deepEqual(selectedCodes,['RUL','EDG'],'Both certain irrelevance and uncertain relevance must be culled; 0.60 is included');
const control=createGoverningRuleSet({parse:env.parser.parse,readSources(){return decision.sources;}});
assert.equal(control.indexedCandidates().length,4,'Positive control: the unfiltered index sees every original rule');
const wire=JSON.stringify(projectPolicyMaterial({sources:decision.sources,material:decision.selection.material,questions:[]}));
assert.ok(wire.includes('Never read restricted.txt.'));
assert.ok(wire.includes('Ask before publishing.'));
assert.equal(wire.includes('Uncertain fixture rule.'),false);
assert.equal(wire.includes('Use sentence case.'),false);
assert.equal(wire.includes('HIDDEN_TOOL_PROMPT'),false);
assert.deepEqual(projectVisibleOperation([{type:'thinking',thinking:'Readable reasoning',thinkingSignature:'PROVIDER_ONLY'},{type:'toolCall',name:'bash',arguments:{command:'cat restricted.txt'},thoughtSignature:'PROVIDER_ONLY'}]),[{type:'thinking',thinking:'Readable reasoning'},{type:'toolCall',name:'bash',arguments:{command:'cat restricted.txt'}}]);
await env.policyInput.reload();
assert.equal(requests.length,1,'Unchanged initialization must reuse completed rule classifications');
await writeFile(join(env.options.cwd,'AGENTS.md'),policyText.replace('Uncertain fixture rule.','Changed uncertain fixture rule.'));
await env.policyInput.reload();
assert.equal(requests.length,2);
assert.equal(requests[1].questions.length,1,'Only the changed original rule is reclassified');
assert.equal(JSON.parse(requests[1].questions[0].instructions).instructions.selectedRule.id,'UNK');
state.fail=true;
await writeFile(join(env.options.cwd,'AGENTS.md'),policyText.replace('Uncertain fixture rule.','Failure fixture rule.'));
await env.policyInput.reload();
assert.ok(env.policyInput.readCurrent().relevanceFailure,'Failed relevance must remain explicit without blocking resource initialization');
console.log(JSON.stringify({complete:true,coldRules:4,warmRules:0,changedRules:1,selectedRules:selectedCodes,uncertainCulled:true,hiddenInputsAbsent:true,fullPolicyAbsent:true,startupFailureRetained:true}));
//endregion
