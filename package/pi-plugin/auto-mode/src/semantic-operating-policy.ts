/**
 Adopted native semantic policies fix model, question vocabulary, and inspected program scope.

 @module
 */
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { CLAUSE_RELATIONS, } from './clause-lowering.ts';
import type {
  SemanticAdmissionDefinition,
  SemanticAdmissionPolicy,
} from './semantic-admission-types.ts';
import { admitsOperatingChoice, } from './semantic-operating-choice.ts';

/**
 Catalog labels mirror the implemented fixed native definitions, including unresolved choices.
 */
const labelsByDefinition: Readonly<Record<SemanticAdmissionDefinition, readonly string[]>> = Object.freeze({
  clause_operation_relation: CLAUSE_RELATIONS,
  request_instruction_content: Object.freeze([
    'none',
    'potential-instruction',
    'unknown',
  ],),
  heading_instruction_content: Object.freeze([
    'none',
    'potential-instruction',
    'unknown',
  ],),
  unit_adoption: Object.freeze([
    'adopts',
    'none',
    'unsupported',
    'unknown',
  ],),
},);
/**
 Configuration logs contain no source material or assessment values.
 */
const l = tagged({ tag: 'auto-mode-semantic-operating-policy', },);

/**
 Runtime configuration remains separate for each original semantic consumer.
 */
export type NativeSemanticOperatingPolicies = {
  /**
   Whole-operation clause meanings do not establish source authority.
   */
  readonly semanticAdmissionPolicy: SemanticAdmissionPolicy;
  /**
   Request content interpretation never supplies request-wide authority.
   */
  readonly requestMaterialAdmissionPolicy: SemanticAdmissionPolicy;
  /**
   Independent heading instructions retain their own interpretation obligation.
   */
  readonly headingContextAdmissionPolicy: SemanticAdmissionPolicy;
  /**
   Express incorporation still requires original same-source scope and authority.
   */
  readonly unitAdoptionAdmissionPolicy: SemanticAdmissionPolicy;
};

//region Configuration is fixed by code, never by a model answer or action input

/**
 Capture one implemented definition with the adopted model and program profile.

 @param definitionId - original fixed definition selected by this module

 @returns immutable operating policy with a synchronous acceptance callback
 */
function operatingPolicy(definitionId: SemanticAdmissionDefinition,): SemanticAdmissionPolicy {
  /**
   The callback closes over the code-owned catalog rather than submitted labels.
   */
  const labels = labelsByDefinition[definitionId];
  return Object.freeze({
    model: 'typesafe/jev-1.13.0',
    definitionId,
    programProfile: 'native-inspected-programs-v2',
    /**
     Apply the adopted rule without replacing original estimate identity.

     @param value - original decoder-owned estimate

     @returns whether the fixed operating rule admits this meaning

     @throws SemanticAdmissionPolicyError for malformed categorical input

     @throws InstructionResolutionInputError for unsupported record shapes
     */
    accepts(value: unknown,): boolean {
      return admitsOperatingChoice({
        value,
        labels,
      },);
    },
  },);
}

/**
 Construct the adopted native policies without reading credentials or requesting assessments.
 Scores at least 0.99 admit only supported uniquely leading meanings.
 This is an operating cutoff, not empirical model qualification.
 Native consumers preserve original identity, currentness, authority, coverage, and authorization checks.

 @returns fixed policies for each implemented categorical consumer

 @example
 ```ts
 const policies = createNativeSemanticOperatingPolicies();
 // Bind these only at the original native session bootstrap.
 ```
 */
export function createNativeSemanticOperatingPolicies(): NativeSemanticOperatingPolicies {
  /**
   Record policy construction without inspecting any assessment or credentials.
   */
  const rl = tagged({
    tag: createNativeSemanticOperatingPolicies.name,
    l,
  },);
  rl.debug('constructing the adopted native semantic operating policies',);
  return Object.freeze({
    semanticAdmissionPolicy: operatingPolicy('clause_operation_relation',),
    requestMaterialAdmissionPolicy: operatingPolicy('request_instruction_content',),
    headingContextAdmissionPolicy: operatingPolicy('heading_instruction_content',),
    unitAdoptionAdmissionPolicy: operatingPolicy('unit_adoption',),
  },);
}

//endregion Fixed native configuration
