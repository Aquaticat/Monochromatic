import assert from 'node:assert/strict';
import {readRelationEstimate} from '../../lifecycle/claim-evidence-batch-selection/selection.mjs';
//region Fixed questions and deterministic interpretation; no final verdict from the model.
/** Strict model and complete answer-ID validation precede typed estimate retention, never policy admission. */
export function parseBatchAnswer({ raw, plan }) {
  const value=JSON.parse(raw);
  assert.equal(value.model,plan.model,'Drex serving model differs from exact requested version');
  assert(value.answers && typeof value.answers==='object' && !Array.isArray(value.answers));
  assert.deepEqual(Object.keys(value.answers).sort(),Object.keys(plan.questions).sort(),'Answer identities differ');
  const scalars={},choices={};
  for(const id of Object.keys(plan.questions)){
    const answer=value.answers[id],definition=plan.questions[id];
    assert.equal(answer.type,definition.type);
    const estimate=readRelationEstimate({definition,value:answer.type==='noul'?answer.noul:{choice:answer.choice,probabilities:answer.probabilities}});
    if(answer.type==='noul')scalars[id]=estimate;
    else choices[id]=estimate;
  }
  assert(Number.isSafeInteger(value.usage?.input_tokens) && value.usage.input_tokens>=0);
  assert(Number.isSafeInteger(value.usage.input_tokens*50),'Reported usage cannot be represented as exact nano-USD at the frozen rate');
  assert(Number.isSafeInteger(value.usage?.output_tokens) && value.usage.output_tokens>=0);
  return {model:value.model,scalars,...(Object.keys(choices).length?{choices}:{}),usage:{input_tokens:value.usage.input_tokens,output_tokens:value.usage.output_tokens}};
}
/** Bands remain diagnostic and cannot be adopted or revised from these outputs. */
export function summarizeBatch({ parsed, plan }) {
  return plan.diagnosticBands.map(band=>{
    const rows=Object.entries(plan.expectedBooleans).map(([id,expected])=>{
      const value=parsed.scalars[id];
      const predicted=value>=band.high?true:value<=band.low?false:null;
      return {id,expected,value,predicted,outcome:predicted===null?'unresolved':predicted===expected?'correct':'wrong'};
    });
    return {...band,correct:rows.filter(r=>r.outcome==='correct').length,wrong:rows.filter(r=>r.outcome==='wrong').length,unresolved:rows.filter(r=>r.outcome==='unresolved').length,rows,productionThresholdAdopted:false};
  });
}
//endregion
