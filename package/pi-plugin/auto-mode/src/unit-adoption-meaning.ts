/**
 Validate original pair bindings and independent clause meanings for incorporation.

 @module
 */
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { SemanticAdmissionPolicyError, } from './semantic-admission-error.ts';
import type { SemanticAcceptance, } from './semantic-admission-types.ts';
import {
  UnitAdoptionBindingError,
  type UnitAdoptionEstimate,
  type UnitAdoptionEvidence,
  type UnitAdoptionPair,
  type UnitRuleProjection,
} from './unit-adoption-binding.ts';
import type {
  UnitAdoptionInputs,
  UnitClauseInterpretation,
} from './unit-adoption-types.ts';

/**
 Logs describe binding checks without formatting borrowed records.
 */
const l = tagged({ tag: 'auto-mode-unit-adoption-meaning', },);

/**
 Validate references already authenticated by native owners, not caller-created records.

 @param record - original pair estimate

 @param pair - original selected opportunity

 @param adopter - current original adopter projection

 @param target - current original target projection

 @param inputs - original member and source bindings

 @throws UnitAdoptionBindingError when original identity or the supported structural profile differs

 @example
 ```ts
 assertUnitAdoptionBinding({ record, pair, adopter, target, inputs });
 ```
 */
export function assertUnitAdoptionBinding(
  {
    record,
    pair,
    adopter,
    target,
    inputs,
  }: {
    readonly record: UnitAdoptionEvidence;
    readonly pair: UnitAdoptionPair;
    readonly adopter: UnitRuleProjection;
    readonly target: UnitRuleProjection;
    readonly inputs: UnitAdoptionInputs;
  },
): void {
  /**
   Binding checks are separate from semantic admission.
   */
  const rl = tagged({
    tag: assertUnitAdoptionBinding.name,
    l,
  },);
  rl.debug('checking original source, member and quoted-unit references',);
  if ((record.definitionId !== 'unit_adoption') || (record.definition
    .type
    !== 'choice')
    || (record.binding
      .claimScope
      !== 'member-unit-adoption')
    || (record.binding
      .member
      !== pair.member)
    || (record.binding
      .memberOrdinal
      !== 0)
    || (record.binding
      .adopter
      !== adopter)
    || (record.binding
      .target
      !== target)
    || (inputs.effects
      .length
      !== 1)
    || (inputs.effects[0]
      ?.member
      !== pair.member)
    || (adopter.sourceOccurrence !== target.sourceOccurrence)
    || ((typeof adopter.code) !== 'string')
    || (target.kind !== 'unclassified-source-span')
    || (target.nodeType !== 'blockquote')) {
    throw new UnitAdoptionBindingError('Unit adoption differs from its original source, member, adopter or quoted target',);
  }
}

/**
 Read an original estimate value only on a path where its decoded presence is required.

 @param record - original pair answer

 @returns original value without reconstruction or freezing

 @throws UnitAdoptionBindingError for a selected estimate lacking its decoded value

 @example
 ```ts
 const originalValue = unitAdoptionValue(record);
 ```
 */
export function unitAdoptionValue(record: UnitAdoptionEvidence,): UnitAdoptionEstimate {
  /**
   Native decoding owns value shape and semantic question membership.
   */
  const { value, } = record.answer;
  if (value === undefined)
    throw new UnitAdoptionBindingError('Unit adoption estimate has no original decoded value',);
  return value;
}

/**
 Admit or abstain through the original code callback without granting authority.

 @param record - original pair record

 @param policy - fixed bootstrap model and acceptance rule

 @returns whether code admitted use of this relationship estimate

 @throws SemanticAdmissionPolicyError for a non-Boolean callback result

 @throws UnitAdoptionBindingError for an unsupported answer status

 @throws original callback failure without replacing its value

 @example
 ```ts
 const admitted = admitUnitAdoption({ record, policy });
 ```
 */
export function admitUnitAdoption(
  {
    record,
    policy,
  }: {
    readonly record: UnitAdoptionEvidence;
    readonly policy: {
      readonly model: string;
      readonly accepts: SemanticAcceptance
    };
  },
): boolean {
  /**
   Semantic use remains independent of structural binding and source scope.
   */
  const rl = tagged({
    tag: admitUnitAdoption.name,
    l,
  },);
  rl.debug('checking code admission of original incorporation estimate',);
  if ((record.answer
    .status
    === 'estimate') && (record.model === policy.model)) {
    /**
     Callback result cannot substitute for authority, scope or permission.
     */
    const admitted = policy.accepts(unitAdoptionValue(record,),);
    if ((typeof admitted) !== 'boolean') {
      throw new SemanticAdmissionPolicyError(
        'Unit-adoption policy must synchronously admit or abstain, not supply authority, scope or permission',
      );
    }
    return admitted;
  }
  if ((record.answer
    .status
    !== 'estimate') && (record.answer
      .status
      !== 'unresolved'))
    throw new UnitAdoptionBindingError('Unit adoption has no usable original answer',);
  return false;
}

/**
 Read independently admitted clause meaning, never infer it from adoption.

 @param clause - original independently interpreted clause

 @returns selected clause relationship

 @throws UnitAdoptionBindingError when admitted clause meaning is unavailable

 @example
 ```ts
 const targetMeaning = admittedUnitClauseChoice(targetClause);
 ```
 */
export function admittedUnitClauseChoice(clause: UnitClauseInterpretation,): string {
  /**
   Independent target meaning must exist before lowering.
   */
  const {value} = clause.evidence
    .answer;
  if ((clause.admission !== 'admitted') || (value === undefined))
    throw new UnitAdoptionBindingError('Unit incorporation requires independent admitted clause meaning',);
  return value.choice;
}
