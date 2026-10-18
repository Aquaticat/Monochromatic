import {RuleAssessmentWireError,sha,isRuleCode} from './wire-source.mjs';

//region Preserve source-specific candidate identity and complete source-span checks.
export function appendClauseQuestion({sources,head,binding,definition,index,seen,membership,questions,pairs,operation,categorical,clauseRelations,question,proposedOperation}){
  if((!binding)||(Object.keys(binding)
    .toSorted()
    .join(',')
    !=='claimScope,governingRule')
    ||(binding.claimScope!==(operation?'program-instruction':'instruction')))throw new RuleAssessmentWireError('Question scope differs from its original relation definition');
  const rule=binding.governingRule;
    const ordinal=rule?.sourceOrdinal;
  if((!Number.isSafeInteger(ordinal))||(ordinal<0)
    ||(ordinal>=sources.length))throw new RuleAssessmentWireError('Selected clause has no original source ordinal');
  const source=sources[ordinal];
  const unclassified=rule.kind==='unclassified-source-span';
  if(unclassified?((rule.code!==undefined)||(head.definitionId!=='clause_operation_relation')
    ||((typeof rule.nodeType)!=='string')
    ||(!rule.nodeType)):(!isRuleCode(rule.code)))throw new RuleAssessmentWireError('Selected instruction candidate has no supported original classification');
  if((rule.sourceSHA256!==source.sha256)||(!Number.isSafeInteger(rule.start))
    ||(!Number.isSafeInteger(rule.end))
    ||(rule.start<0)
    ||(rule.end<=rule.start)
    ||(rule.end
      >source.content
      .length)
    ||(source.content
      .slice(
        rule.start,
        rule.end
      )
      !==rule.text)
    ||(sha(rule.text)!==rule.textSHA256)
    ||(!Array.isArray(rule.headings))
    ||(!rule.headings
      .every(function isRuleHeadingText(value) { return ((typeof value)==='string'); })))throw new RuleAssessmentWireError('Selected clause differs from its complete source');
  const candidateKey=`${ordinal}:${
    unclassified?`span:${rule.start}:${rule.end}`:`code:${rule.code}`}`;
  const key=`${head.definitionId}:${
    candidateKey}`;
  if(seen.has(key))throw new RuleAssessmentWireError('Mixed batch repeats a source-specific logical question');
  seen.add(key);membership.hasOperation||=head.definitionId==='operation_violates_rule';
  if(categorical)clauseRelations.add(candidateKey);
  const slot=`head_${index}`;
  const selectedRule={
    ...(unclassified?{
      kind:rule.kind,
      nodeType:rule.nodeType,
      start:rule.start,
      end:rule.end
    }:{id:rule.code}),
    sourceOrdinal:ordinal,
    text:rule.text,
    headings:rule.headings
  };
  const instructions=categorical
   ?{
     predicate:definition.instructions,
     selectedRule,
     proposedOperation
   }
   :operation
    ?{
      question,
      assessmentContext:'Apply `assessmentGuidance` in the shared state to this question.',
      selectedRule
    }
    :{
      predicate:definition.instructions,
      selectedRule
    };
  questions[slot]={
    type:definition.type,
    instructions,
    criteria:definition.criteria
  };
  pairs.push({
    slot,
    id:head.id,
    type:definition.type
  });
}
//endregion
