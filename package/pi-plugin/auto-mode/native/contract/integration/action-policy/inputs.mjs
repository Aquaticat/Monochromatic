import {bindRegisteredPolicy} from '../policy-source/registered-authority.mjs';
import {inspectNativeSourceDomain} from '../policy-source/source-domain.mjs';

import {PolicyInputBindingError} from '../maintained-policy.mjs';

export {PolicyInputBindingError} from '../maintained-policy.mjs';

/**
 Read clauses and implementation facts from the original judgment's existing owners.
 Fact scope is retained verbatim: member-level absence never implies complete
 enclosing-program coverage, and indexing never establishes instruction authority.
 */
export async function capturePolicyInputs({
  judgment,
  effectOwnerFor,
  sourceContext
}){
 judgment.assertDependenciesCurrent();
 judgment.checkpoint();
 const sourceBinding=sourceContext===undefined?undefined:bindRegisteredPolicy({
   ...sourceContext,
   judgment
 });
 const sources=sourceBinding?[
   sourceBinding,
   ...sourceBinding.additionalSources
 ]:[];
 const instructionSources=Object.freeze(sources.map(function readSourceView(source) { return (source.view); }));
 const instructionCarriers=sourceBinding?.instructionCarriers??Object.freeze([]);
 const requestObservation=sourceBinding?.view
   .request;
 const requestSourceContributions=requestObservation?.sourceContributions??Object.freeze([]);
 const runInstructionCarriers=sourceBinding?.runInstructionCarriers??Object.freeze([]);
 const instructionAuthorities=Object.freeze(sources.filter(function hasSourceAuthority(source) { return (source.authority); })
   .map(function readSourceAuthority(source) { return (source.authority); }));
 const {
  ruleCandidates:candidates,
  instructionCandidates,
  headingContextCandidates,
  unitAdoptionPairs,
  ruleSourceCoverage
 }=judgment.readPolicySelection();
 function readRule(handle){return judgment.readRuleCandidate(handle);}
 function sourceViewFor(handle){
  const rule=readRule(handle);
  for(const source of sources){
   source.assertCurrent(source.view);
   if(rule.sourceOccurrence
     ===source.view
     .sourceOccurrence)return source.view;
  }
  return Object.freeze({
    kind:'unresolved-instruction-source',
    permission:false
  });
 }
 function authorityFor(handle){
  const rule=readRule(handle);
  for(const source of sources){
   if(!source.authority)continue;
   source.assertAuthorityCurrent(source.authority);
   if(rule.sourceOccurrence
     ===source.authority
     .sourceOccurrence)return source.authority;
  }
  return Object.freeze({
    kind:'unresolved-instruction-authority',
    permission:false
  });
 }
 const states=judgment.inspect()
   .memberExecutions;
 if(states.some(function hasEnteredMember(value) { return (value.state!=='unentered'); }))throw new PolicyInputBindingError('Policy facts must be captured before the prepared group starts');
 const members=[];
 for(const {id} of states){
  const member=judgment.memberFor(id);
  const {prepared} = judgment.preparedMemberFor(member);
  const programInspection=judgment.preparedProgramFor?.(member);
  const owner=effectOwnerFor?.({
    judgment,
    member,
    prepared
  });
  const evidence=owner
   ?await owner.capture(member)
   :Object.freeze({
     kind:'unresolved-effect',
     reason:'No implementation fact provider for this prepared member',
     permission:false
   });
  if(owner)owner.assertCurrent(evidence);
  members.push(Object.freeze({
    member,
    prepared,
    owner,
    evidence,
    programInspection
  }));
  judgment.assertDependenciesCurrent();
  judgment.checkpoint();
 }
 const effects=Object.freeze(members);const inputState={failure:undefined};
 function assertCurrent(){
  if(inputState.failure)throw new PolicyInputBindingError(
    'Original policy inputs lost eligibility',
    {cause:inputState.failure.cause}
  );
  try{
   judgment.assertDependenciesCurrent();
   sourceBinding?.assertAllCurrent();
   // Closed judgments retain dependency checks, but cannot reopen candidate selection.
   if(!judgment.inspect()
     .finalRecord){
    const current=judgment.readPolicySelection();
    if(current.ruleCandidates!==candidates)throw new PolicyInputBindingError('Original instruction candidates changed');
    if(current.instructionCandidates!==instructionCandidates)throw new PolicyInputBindingError('Original retained instruction candidates changed');
    if(current.headingContextCandidates!==headingContextCandidates)throw new PolicyInputBindingError('Original heading-context candidates changed');
    if(current.unitAdoptionPairs!==unitAdoptionPairs)throw new PolicyInputBindingError('Original unit-adoption pairs changed');
   }
   for(const {
     member,
     prepared,
     owner,
     evidence,
     programInspection
   } of effects){
    if(judgment.preparedMemberFor(member)
      .prepared
      !==prepared)throw new PolicyInputBindingError('Original prepared effect input changed');
    if(judgment.preparedProgramFor?.(member)!==programInspection)throw new PolicyInputBindingError('Original prepared program inspection changed');
    if(owner)owner.assertCurrent(evidence);
   }
  }catch(error){inputState.failure={cause:error};throw error;}
 }
 function inspectSourceDomain(){
  assertCurrent();
  if(!sourceBinding)return undefined;
  return inspectNativeSourceDomain({
    snapshot:sourceBinding.view
      .sources,
    instructionSources,
    sourceCoverage:ruleSourceCoverage
  });
 }
 assertCurrent();
 return Object.freeze({
   inspectSourceDomain,
   ruleCandidates:candidates,
   instructionCandidates,
   headingContextCandidates,
   unitAdoptionPairs,
   ruleSourceCoverage,
   readRule,
   sourceViewFor,
   authorityFor,
   instructionSources,
   instructionCarriers,
   requestObservation,
   requestSourceContributions,
   runInstructionCarriers,
   instructionAuthorities,
   effects,
   assertCurrent
 });
}
