/**
 Original candidate selections determine which configured questions are meaningful. @module
 */
import { semanticAdmissionScope } from './semantic-policy.ts';
import type {
 SemanticAdmissionInputs,
 SemanticAdmissionPolicy,
 SemanticAdmissionScope
} from '../../../../src/semantic-admission-types.ts';
import type { InstructionPolicySelection } from '../../collector/program-rule-batch-sdk-copy-v2/input/instruction-api.ts';

//region Scope contracts derive their collections from the maintained input producers.
/**
 Candidate collections retain their actual judgment producer types.
 */
type AdmissionInputs = SemanticAdmissionInputs & Pick<InstructionPolicySelection,
 'headingContextCandidates' | 'unitAdoptionPairs'>;

/**
 Question absence is distinct from a configured consumer matching its original inputs.
 */
type UnitScope = SemanticAdmissionScope | Readonly<{
 state: 'no-unit-pairs';
 reason: string;
}>;

/**
 Context-free headings do not need a separate contextual-heading estimate.
 */
type HeadingScope = SemanticAdmissionScope | Readonly<{
 state: 'no-heading-context';
 reason: string;
}>;

/**
 Independently configured consumers retain their own original question selections.
 */
type AdmissionScopes = Readonly<{
 scope: SemanticAdmissionScope;
 headingScope: HeadingScope;
 unitScope: UnitScope;
}>;
//endregion Scope contracts

//region Admission questions follow the selected policy and original input candidates.
/**
 Same-source incorporation needs the original single-member clause interpretation.

 @returns configured original scope or the specific missing incorporation prerequisite
 */
function captureUnitScope({
  inputs,
  unitPolicy,
  scope
}: {
 readonly inputs: AdmissionInputs;
 readonly unitPolicy?: SemanticAdmissionPolicy;
 readonly scope: SemanticAdmissionScope;
}): UnitScope {
 /**
  The maintained consumer checks the selected policy's actual inspection profile first.
  */
 const inspected=semanticAdmissionScope({
   ...(unitPolicy===undefined?{}:{policy:unitPolicy}),
   inputs
 });
 if(inspected.state!=='matching')return inspected;
 if((scope.state!=='matching')||(inputs.effects
   .length
   !==1))
  return Object.freeze({
    state:'out-of-profile',
    reason:'Unit incorporation requires one original member and clause interpretation.'
  });
 if(inputs.unitAdoptionPairs
   .length
   ===0)
  return Object.freeze({
    state:'no-unit-pairs',
    reason:'No bounded original same-source pair needs assessment.'
  });
 return inspected;
}
/**
 Current selected sources and the retained native program determine which questions are meaningful.

 @returns independent clause, heading and incorporation question selections

 @example
 ```ts
 const scopes = captureScopes({ inputs });
 ```
 */
export function captureScopes({
  inputs,
  policy,
  headingPolicy,
  unitPolicy
}: {
 readonly inputs: AdmissionInputs;
 readonly policy?: SemanticAdmissionPolicy;
 readonly headingPolicy?: SemanticAdmissionPolicy;
 readonly unitPolicy?: SemanticAdmissionPolicy;
}): AdmissionScopes {
 /**
  Clause selection remains the prerequisite for same-source incorporation.
  */
 const scope=semanticAdmissionScope({
   ...(policy===undefined?{}:{policy}),
   inputs
 });
 /**
  Contextual headings can require assessment even without indexed clause candidates.
  */
 const inspectedHeading=semanticAdmissionScope({
   ...(headingPolicy===undefined?{}:{policy:headingPolicy}),
   inputs,
   requireCandidates:false
 });
 /**
  Empty contextual-heading collections require no model estimate.
  */
 const headingScope=(inspectedHeading.state==='matching')&&(inputs.headingContextCandidates
   .length
   ===0)
  ?Object.freeze({
    state:'no-heading-context',
    reason:'No original contextual-heading groups need assessment.'
  })
  :inspectedHeading;
 /**
  Same-source incorporation retains the original member and pair prerequisites.
  */
 const unitScope=captureUnitScope({
   inputs,
   ...(unitPolicy===undefined?{}:{unitPolicy}),
   scope
 });
 return {
   scope,
   headingScope,
   unitScope
 };
}
//endregion Admission question selection
