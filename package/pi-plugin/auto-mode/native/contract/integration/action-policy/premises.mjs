import {PolicyInputBindingError} from './inputs.mjs';
import {inspectToolMetadataPremises} from './tool-metadata-premises.mjs';

/**
 Explain what the current captured source and implementation owners establish or leave open.
 This consumes capturePolicyInputs output inside the fixed native reviewer, not caller admission flags.
 It does not authenticate fabricated inputs, qualify model estimates, or introduce an evidence owner.
 */
export function inspectPolicyPremises(inputs){
 inputs.assertCurrent();
 const issues=[];
 const authorities=new Map(inputs.instructionAuthorities
   .map(authority=>[
     authority.sourceOccurrence,
     authority
   ]));
 if(inputs.instructionSources
   .length
   ===0){
  issues.push(Object.freeze({
    premise:'instruction-authority-and-scope',
    reason:'No original governing source binding establishes instruction authority and scope.'
  }));
 }
 for(const source of inputs.instructionSources){
  issues.push(...inspectToolMetadataPremises(source));
  const authority=authorities.get(source.sourceOccurrence);
  if((authority?.kind!=='registered-instruction-authority')||(authority.scope
    ?.kind
    !=='original-request')
    ||(authority.scope
      .request
      !==source.request)){
   issues.push(Object.freeze({
     premise:'instruction-authority-and-scope',
     source,
     reason:'This original source has no established instruction authority and scope; its placement or filename cannot supply them.'
   }));
  }
 }
 const sourceCoverage=inputs.ruleSourceCoverage;
 const unclassified=Object.freeze((sourceCoverage??[]).filter(source=>source.unclassified
   .length
   >0));
 const sourceDomain=inputs.inspectSourceDomain?.();
 // Only original native owner publications can discharge structural domain accounting.
 if((!sourceDomain)||(sourceDomain.gaps
   .length
   > 0))issues.push(Object.freeze({
   premise:'complete-governing-source-coverage-and-delegation',
   kind:'request-source-domain',
   sourceDomain,
   request:inputs.instructionSources[0]
     ?.request,
   sourceCoverage,
   unclassified,
   reason:sourceDomain?.gaps
     .length?sourceDomain.gaps
       .map(gap=>gap.reason)
       .join(' '):sourceCoverage===undefined?'No original rule-source coverage inspection or original-request material accounting is available.'
   :'Original request material outside the represented source units has no established governing-source accounting; source-local interpretation does not establish that domain or delegation.'
 }));
 for(const source of sourceCoverage??[]){
  if((!Array.isArray(source.instructionCandidates))||(!Array.isArray(source.contextualHeadings))){
   issues.push(Object.freeze({
     premise:'complete-governing-source-coverage-and-delegation',
     kind:'source-local-accounting-unavailable',
     sourceCoverage:source,
     reason:'This source inspection does not expose original candidate and contextual-heading accounting.'
   }));
   continue;
  }
  if(source.instructionCandidates
    .length
    > 0)issues.push(Object.freeze({
    premise:'complete-governing-source-coverage-and-delegation',
    kind:'source-local-instruction-use',
    sourceCoverage:source,
    candidates:source.instructionCandidates,
    reason:'Original source candidates still require admitted supported interpretations.'
  }));
  if(source.contextualHeadings
    .length
    > 0)issues.push(Object.freeze({
    premise:'complete-governing-source-coverage-and-delegation',
    kind:'source-heading-context',
    sourceCoverage:source,
    candidate:source.headingContextCandidate,
    headings:source.contextualHeadings,
    reason:'Heading text supplied as candidate context has no established independent normative-use accounting.'
  }));
 }
 if((inputs.ruleCandidates
   .length
   > 0)||(unclassified.length > 0)
   ||(inputs.instructionSources
     .length
     ===0)){
  issues.push(Object.freeze({
    premise:'qualified-rule-interpretation',
    rules:inputs.ruleCandidates,
    unclassified,
    reason:'No established whole-operation meaning is available for the original clauses or unclassified text. Index membership and unqualified semantic estimates are not operative rule facts.'
  }));
 }
 if(inputs.effects
   .length
   ===0){
  issues.push(Object.freeze({
    premise:'complete-operation-coverage',
    reason:'No original prepared operation facts are available.'
  }));
 }
 for(const effect of inputs.effects){
  const {evidence}=effect;
  if(![
    'code-effect',
    'unresolved-effect'
  ].includes(evidence?.kind))throw new PolicyInputBindingError(`Prepared call ${JSON.stringify(effect.prepared
    .id)} supplied an unsupported implementation-evidence kind`);
  issues.push(Object.freeze({
    premise:'complete-operation-coverage',
    effect,
    reason:effect.programInspection?`Prepared call ${JSON.stringify(effect.prepared
      .id)} (${effect.prepared
        .name}) has an original validated outer-program declaration, not established complete effects or instruction applicability.`
    :evidence.kind==='unresolved-effect'?`Prepared call ${JSON.stringify(effect.prepared
      .id)} (${effect.prepared
        .name}) has unresolved implementation facts: ${evidence.reason}`
    :`Prepared call ${JSON.stringify(effect.prepared
      .id)} (${effect.prepared
        .name}) has a scoped member fact, not complete operation coverage. No admitted inspected-form estimate supplies the remaining coverage.`
  }));
 }
 const missingPremises=Object.freeze([...new Set(issues.map(issue=>issue.premise))]);
 inputs.assertCurrent();
 return Object.freeze({
   issues:Object.freeze(issues),
   missingPremises
 });
}
