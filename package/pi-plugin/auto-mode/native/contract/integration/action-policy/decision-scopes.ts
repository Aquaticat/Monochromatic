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

//region Admission questions follow the selected policy and original input candidates.
/** Same-source incorporation needs the original single-member clause interpretation. */
function captureUnitScope({
  inputs,
  unitPolicy,
  scope
}: {
 readonly inputs: AdmissionInputs;
 readonly unitPolicy?: SemanticAdmissionPolicy;
 readonly scope: SemanticAdmissionScope;
}): UnitScope {
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
/** Current selected sources and the retained native program determine which questions are meaningful. */
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
 const scope=semanticAdmissionScope({
   ...(policy===undefined?{}:{policy}),
   inputs
 });
 const inspectedHeading=semanticAdmissionScope({
   ...(headingPolicy===undefined?{}:{policy:headingPolicy}),
   inputs,
   requireCandidates:false
 });
 const headingScope=(inspectedHeading.state==='matching')&&(inputs.headingContextCandidates
   .length
   ===0)
  ?Object.freeze({
    state:'no-heading-context',
    reason:'No original contextual-heading groups need assessment.'
  })
  :inspectedHeading;
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
