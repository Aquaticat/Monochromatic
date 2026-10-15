import {MISSING_AUTHORIZATION_EVIDENCE} from './authorization-inputs.mjs';
import {lowerEstablishedClause} from './clause-lowering.mjs';
import {inspectPolicyPremises} from './premises.mjs';
import {SemanticAdmissionPolicyError} from './semantic-policy.ts';
import {consumeHeadingContexts} from './heading-context.mjs';
import {consumeSourceAssociations} from './source-association.mjs';
import {consumeUnitAdoptions} from './unit-adoption.mjs';
import {matchesSemanticProgramProfile} from '../maintained-policy.mjs';

/** Package derived resolver inputs and diagnostics without changing any original estimate or source record. */
function compilation({
  issues,
  rules,
  authorizationRequirements,
  clauses,
  scope,
  headingContextInterpretations=Object.freeze([]),
  sourceUses,
  unitAdoptionInterpretations=Object.freeze([])
}){
 issues=[
   ...issues,
   ...sourceUses.issues
 ];
 const missingPremises=Object.freeze([...new Set(issues.map(function readIssuePremise(issue) { return (issue.premise); }))]);
 const program=Object.freeze({
   premises:missingPremises.length > 0?'incomplete':'complete',
   rules:Object.freeze(rules),
   authorizationRequirements:Object.freeze(authorizationRequirements)
 });
 return Object.freeze({
   program,
   missingPremises,
   premiseIssues:Object.freeze(issues),
   clauses:Object.freeze(clauses),
   semanticAdmission:scope,
   headingContextInterpretations,
   requestSourceAssociationUses:sourceUses.uses,
   unitAdoptionInterpretations
 });
}

/**
 Compile the original whole-program clause batch under fixed bootstrap code policy.
 The original judgment authenticates evidence; ordered pairing only correlates the owner's all-clause issuance.
 An admitted estimate is usable under this code policy, not certified semantic truth or source authority.
 Source, delegation, implementation and authorization gaps remain independent of estimate admission.
 */
export function compileBoundClauseProgram({
  judgment,
  inputs,
  authorizationInputs,
  pendingSessionApproval,
  policy,
  scope,
  evidence,
  headingPolicy,
  headingScope,
  unitPolicy,
  unitScope
}){
 authorizationInputs?.assertCurrent();
 const base=inspectPolicyPremises(inputs);
   const sourceUses=consumeSourceAssociations(inputs);
   const rules=[];
   const authorizationRequirements=[];
   const clauses=[];
 const candidates=inputs.instructionCandidates??inputs.ruleCandidates;
 const interpreted=new Set();
 const clauseEnabled=scope.state==='matching';
   const headingEnabled=headingScope?.state==='matching';
   const unitEnabled=unitScope?.state==='matching';
 const headingCandidates=inputs.headingContextCandidates??[];
 if((!clauseEnabled)
   &&(!headingEnabled)
   &&(!unitEnabled))return compilation({
   issues:[...base.issues],
   rules,
   authorizationRequirements,
   clauses,
   scope,
   sourceUses
 });
 judgment.assertBatchEvidence(evidence);
 const clauseCount=clauseEnabled?candidates.length:0;
 const headingStart=clauseCount;
 const headingCount=headingEnabled?headingCandidates.length:0;
 const adoptionStart=headingStart+headingCount;
 const adoptionPairs=unitEnabled?inputs.unitAdoptionPairs:[];
 if((!Array.isArray(evidence))||(evidence.length!==(adoptionStart
   +adoptionPairs.length)))throw new SemanticAdmissionPolicyError('Original clause estimate batch differs from the complete indexed candidate set and selected content uses');
 // These references remain part of the authenticated full batch; a sliced array is not an evidence capability.
 const clauseEvidence=evidence.slice(
   0,
   clauseCount
 );
 // Multiple root programs need the original dispatcher schedule, not order inferred from their array positions.
 // Legacy single-member inputs have no outer inter-member scheduling obligation.
 const groupExecutionMode=inputs.effects[0]
   ?.prepared
   .groupExecutionMode;
 const scheduled=[
   'parallel',
   'sequential'
 ].includes(groupExecutionMode)
   &&inputs.effects
   .every(function matchesGroupExecutionMode(effect) { return (effect.prepared
     .groupExecutionMode
     ===groupExecutionMode); });
 const singleLegacy=(inputs.effects
   .length
   ===1)&&(groupExecutionMode===undefined);
 // Independent implementation-fact contracts keep their gaps until their concrete uses are modeled.
 const operation=clauseEnabled
   &&(inputs.effects
     .length
     >0)
   &&(scheduled||singleLegacy)
   &&inputs.effects
   .every(function matchesUnownedProgramProfile(effect) { return ((effect.owner===undefined)&&matchesSemanticProgramProfile({
     configured:policy.programProfile,
     inspected:effect.programInspection
       ?.declaration
       .profile
   })); })
  ?Object.freeze({
    preparedOperations:inputs.effects,
    groupExecutionMode
  }):undefined;
 const issues=clauseEnabled?base.issues
   .filter(function retainIndependentPremise(issue) { return ((issue.premise!=='qualified-rule-interpretation')&&(!(operation&&(issue.premise==='complete-operation-coverage')))); }):[...base.issues];
 function unresolvedOperationUse({
   rule,
   evidence
 }){
  if(operation)issues.push(Object.freeze({
    premise:'complete-operation-coverage',
    kind:'clause-operation-interpretation',
    rule,
    evidence,
    operation,
    reason:'No admitted relationship supplies this original clause\'s application to the complete inspected operation.'
  }));
 }
 const sources=new Map(inputs.instructionSources
   .map(function indexSourceOccurrence(source) { return ([
     source.sourceOccurrence,
     source
   ]); }));
 const authorities=new Map(inputs.instructionAuthorities
   .map(function indexAuthorityOccurrence(authority) { return ([
     authority.sourceOccurrence,
     authority
   ]); }));
 const sourceNeedsAuthority=new Map();
 for(const [index,record] of clauseEvidence.entries()){
  if((record.definitionId!==policy.definitionId)||(record.definition
    .type
    !=='choice')
    ||(record.binding
      .claimScope
      !=='program-instruction'))throw new SemanticAdmissionPolicyError('Estimate is not the original whole-operation clause relationship selected by this compiler');
  const rule=candidates[index];
    const projection=record.binding
      .governingRule; const id=`clause-${index}`;
  const source=sources.get(projection.sourceOccurrence);
    const authority=authorities.get(projection.sourceOccurrence);
  // Registered source priority does not independently resolve quotation, structured-content or delegation scope.
  // Original heading candidates are top-level orphans; contextual groups cannot be claimed as individual clauses.
  const directSourceUnit=(projection.kind!=='unclassified-source-span')||[
    'paragraph',
    'heading'
  ].includes(projection.nodeType);
  const priority=directSourceUnit&&source
    &&(authority?.kind==='registered-instruction-authority')
    &&(authority.scope
      .kind
      ==='original-request')
    &&(authority.scope
      .request
      ===source.request)?authority.priority:undefined;
  let admitted=false;
  const matchingModel=record.model===policy.model;
  if((record.answer
    .status
    ==='estimate')&&matchingModel){
   admitted=policy.accepts(record.answer
     .value);
   if((typeof admitted)!=='boolean')throw new SemanticAdmissionPolicyError('Semantic acceptance policy must synchronously return admit or abstain, not facts, coverage or a verdict');
  }else if(![
    'estimate',
    'unresolved'
  ].includes(record.answer
    .status)){
   throw new SemanticAdmissionPolicyError('Original clause evidence is not a usable estimate or an explicit unresolved answer');
  }
  const needsAuthority=(!admitted)||(record.answer
    .value
    .choice
    !=='none');
  sourceNeedsAuthority.set(
    projection.sourceOccurrence,
    (sourceNeedsAuthority.get(projection.sourceOccurrence)??false)||needsAuthority
  );
  if(!admitted){
   const reason=record.answer
     .status
     ==='unresolved'?'The original relation answer explicitly leaves this clause unresolved.':matchingModel?'The configured code policy did not admit a relationship for this original clause.':'The original estimate lacks matching serving-model attribution for the configured code policy.';
   issues.push(Object.freeze({
     premise:'qualified-rule-interpretation',
     kind:'clause-interpretation-not-admitted',
     rule,
     evidence:record,
     reason
   }));
   unresolvedOperationUse({
     rule,
     evidence:record
   });
   clauses.push(Object.freeze({
     rule,
     evidence:record,
     admission:'abstained'
   }));
   continue;
  }
  const authorization=record.answer
    .value
    .choice
    ==='fresh-session-approval'
    ?pendingSessionApproval?.authorization:record.answer
      .value
      .choice
      ==="prerequisite"?authorizationInputs?.forClause(rule):undefined;
  const lowered=lowerEstablishedClause({
    id,
    priority,
    relation:record.answer
      .value
      .choice,
    ...((authorization!==undefined)&&(authorization!==MISSING_AUTHORIZATION_EVIDENCE)?{authorization}:{})
  });
  rules.push(...lowered.rules);authorizationRequirements.push(...lowered.authorizationRequirements);
  for(const premise of lowered.missingPremises){
   issues.push(Object.freeze({
     premise,
     kind:premise==='qualified-rule-interpretation'?'clause-relation-interpretation':'clause-source-use-scope',
     scopeReason:(projection.kind==='unclassified-source-span')&&(projection.nodeType==='blockquote')
       &&source
       &&(authority?.scope
         .kind
         ==='original-request')
       &&(authority.scope
         .request
         ===source.request)?'unresolved-quoted-unit-use':'source-authority-or-request-scope',
     rule,
     evidence:record,
     reason:premise==='qualified-rule-interpretation'?'The admitted response retains unknown or unsupported clause semantics.':'The original candidate has no established instruction authority and request scope; source registration does not resolve remaining unit-level delegation.'
   }));
  }
  const represented=[
    'permission',
    'prohibition',
    'prerequisite',
    'fresh-session-approval',
    'none'
  ].includes(record.answer
    .value
    .choice);
  if(!represented)unresolvedOperationUse({
    rule,
    evidence:record
  });
  else interpreted.add(rule);
  // Admission supplies estimated operation application for this clause, never code-established effects.
  const operationApplication=operation&&represented?Object.freeze({
    kind:'admitted-whole-operation-estimate',
    ...operation
  }):undefined;
  clauses.push(Object.freeze({
    rule,
    evidence:record,
    admission:'admitted',
    lowered,
    ...(operationApplication?{operationApplication}:{})
  }));
 }
 const adopted=consumeUnitAdoptions({
   records:evidence.slice(adoptionStart),
   pairs:adoptionPairs,
   inputs,
   policy:unitPolicy,
   clauses
 });
 rules.push(...adopted.rules);authorizationRequirements.push(...adopted.authorizationRequirements);issues.push(...adopted.issues);
 for(const adopter of adopted.adopters)interpreted.add(adopter);
 for(const interpretation of adopted.interpretations){
  if((interpretation.admission!=='admitted')||(interpretation.relation!=='none'))sourceNeedsAuthority.set(
    inputs.readRule(interpretation.adopter)
      .sourceOccurrence,
    true
  );
 }
 for(const issue of base.issues){
  if((!clauseEnabled)||(issue.premise!=='qualified-rule-interpretation'))continue;
  const unclassified=Object.freeze(issue.unclassified
    .filter(function hasUninterpretedSpan(source) { return (source.unclassified
      .some(function isUninterpretedCandidate(span) { return (!interpreted.has(span.candidate)); })); }));
  if((unclassified.length > 0)||(inputs.instructionSources
    .length
    ===0)){
   issues.push(Object.freeze({
     ...issue,
     rules:Object.freeze([]),
     unclassified,
     reason:'Retained source spans or unavailable source bindings still require interpretation; admitted original candidates do not cover that remainder.'
   }));
  }
 }
 const headingContextInterpretations=headingEnabled?consumeHeadingContexts({
   records:evidence.slice(
     headingStart,
     adoptionStart
   ),
   candidates:headingCandidates,
   policy:headingPolicy
 }):Object.freeze([]);
 const headingUses=new Map(headingContextInterpretations.map(function indexCandidateInterpretation(interpretation) { return ([
   interpretation.candidate,
   interpretation
 ]); }));
 // Policy callbacks cannot publish a program after changing the original inputs or exhausting their budget.
 inputs.assertCurrent();authorizationInputs?.assertCurrent();judgment.assertBatchEvidence(evidence);
 // Only consumed none relationships are tier-independent. This does not close the governing-source inventory.
 const requiredIssues=issues.filter(function retainUnresolvedAdoptionIssue(issue) {
  if(adopted.adopters
    .has(issue.rule)
    &&[
      'clause-interpretation-not-admitted',
      'clause-relation-interpretation',
      'clause-operation-interpretation'
    ].includes(issue.kind))return false;
  if(adopted.targets
    .has(issue.rule)
    &&(issue.kind==='clause-source-use-scope')
    &&(issue.scopeReason==='unresolved-quoted-unit-use'))return false;
  const heading=issue.kind==='source-heading-context'?headingUses.get(issue.candidate):undefined;
  if((heading?.admission==='admitted')&&(heading.relation==='none'))return false;
  if(issue.kind==='source-local-instruction-use')return !issue.candidates
    .every(function hasCandidateInterpretation(candidate) { return (interpreted.has(candidate)); });
  return (issue.premise!=='instruction-authority-and-scope')||(!issue.source)
    ||(sourceNeedsAuthority.get(issue.source
      .sourceOccurrence)!==false);
 });
 const headingIssues=requiredIssues.map(function attachHeadingInterpretation(issue) {
  const interpretation=issue.kind==='source-heading-context'?headingUses.get(issue.candidate):undefined;
  return interpretation?Object.freeze({
    ...issue,
    headingContextInterpretation:interpretation,
    reason:'The original heading group was assessed, but its independent normative content remains potential, unknown or unadmitted; no directive meaning or delegation is inferred.'
  }):issue;
 });
 return compilation({
   issues:headingIssues,
   rules,
   authorizationRequirements,
   clauses:clauses.map(function applyAdoptedClauseUpdate(clause) { return (adopted.updates
     .get(clause.rule)
     ??clause); }),
   scope,
   headingContextInterpretations,
   sourceUses,
   unitAdoptionInterpretations:adopted.interpretations
 });
}
