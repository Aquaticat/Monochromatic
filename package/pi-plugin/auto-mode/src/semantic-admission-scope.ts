/**
 Match original program inspection to fixed bootstrap semantic configuration.

 @module
 */
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type {
  SemanticAdmissionInputs,
  SemanticAdmissionPolicy,
  SemanticAdmissionScope,
} from './semantic-admission-types.ts';

/**
 Scope diagnostics never include borrowed source or estimate content.
 */
const l = tagged({ tag: 'auto-mode-semantic-admission-scope', },);

/**
 Match exact profiles or the fixed set adopted for the native host.

 @param configured - captured bootstrap profile identifier
 
 @param inspected - original decoder profile identifier
 
 @returns whether the original profile belongs to the configured scope

 @example
 ```ts
 const matching = matchesSemanticProgramProfile({
   configured: 'native-inspected-programs-v2', inspected: declaration.profile,
 });
 ```
 */
export function matchesSemanticProgramProfile({
  configured,
  inspected,
}: {
  readonly configured: string;
  readonly inspected: unknown;
},): boolean {
  /**
   Profile matching logs no original program content.
   */
  const rl = tagged({
    tag: matchesSemanticProgramProfile.name,
    l,
  },);
  rl.debug('matching inspected program identifier to fixed semantic scope',);
  if (configured === 'native-inspected-programs-v2') {
    return (inspected === 'awaited-literal-single-call')
      || (inspected === 'awaited-string-result-then-literal-parallel');
  }
  return inspected === configured;
}

/**
 Select complete direct Bash commands or inspected programs for the configured estimate consumer.
 Native callers authenticate prepared membership; matching supplies no implementation facts or permission.

 @param configured - fixed bootstrap scope
 @param effect - original prepared operation and optional program inspection
 @returns whether the complete operation has an adopted semantic consumer
 */
export function matchesSemanticOperationProfile({
  configured,
  effect,
}: {
  readonly configured: string;
  readonly effect: SemanticAdmissionInputs['effects'][number];
},): boolean {
  const rl = tagged({ tag: matchesSemanticOperationProfile.name, l, },);
  rl.debug('matching original prepared operation to fixed semantic scope',);
  if ((configured === 'native-inspected-programs-v2') && (effect.prepared?.name === 'bash'))
    return typeof effect.prepared.input.command === 'string';
  return matchesSemanticProgramProfile({
    configured,
    inspected: effect.programInspection?.declaration.profile,
  },);
}

/**
 Determine whether the existing original inspections have a configured semantic consumer.
 The native adapter fixes expectedModel from its actual wire contract, never from action input.
 Shape alone authenticates no owner; native callers keep original identity and currentness checks.
 This function neither invokes the acceptance callback nor certifies facts or coverage.

 @param policy - captured bootstrap configuration, absent when no consumer is configured

 @param inputs - original prepared-operation inspections and candidate handles

 @param expectedModel - fixed model from the native assessment wire contract

 @param requireCandidates - whether this definition selects clauses rather than aggregate content

 @returns owned scope result without semantic qualification or execution permission

 @example
 ```ts
 const scope = inspectSemanticAdmissionScope({
   policy, inputs, expectedModel: assessmentModel, requireCandidates: false,
 });
 // Matching selects a consumer; individual estimates still require code admission.
 ```
 */
export function inspectSemanticAdmissionScope(
  {
    policy,
    inputs,
    expectedModel,
    requireCandidates = true,
  }: {
    readonly policy?: SemanticAdmissionPolicy;
    readonly inputs: SemanticAdmissionInputs;
    readonly expectedModel: string;
    readonly requireCandidates?: boolean;
  },
): SemanticAdmissionScope {
  /**
   No source values or model answers are logged by scope selection.
   */
  const rl = tagged({
    tag: inspectSemanticAdmissionScope.name,
    l,
  },);
  rl.debug('matching original inspection to configured semantic consumer',);
  if (policy === undefined)
    return Object.freeze({
      state: 'not-configured',
      reason: 'No semantic estimate admission policy is configured.',
    },);
  if (policy.model !== expectedModel) {
    return Object.freeze({
      state: 'out-of-profile',
      reason: 'The configured semantic policy does not match the fixed assessment model.',
    },);
  }
  if ((inputs.effects
    .length
    === 0)
    || inputs.effects
    .some(function incomplete(effect,) {
    return !matchesSemanticOperationProfile({
      configured: policy.programProfile,
      effect,
    },);
  },)) {
    return Object.freeze({
      state: 'out-of-profile',
      reason: 'The original operation is not completely represented by the configured direct-command or inspected-program scope.',
    },);
  }
  if (requireCandidates && ((inputs.instructionCandidates ?? inputs.ruleCandidates).length === 0)) {
    return Object.freeze({
      state: 'no-indexed-clauses',
      reason: 'No retained original instruction candidates are available for this relation definition.',
    },);
  }
  return Object.freeze({
    state: 'matching',
    model: expectedModel,
    definitionId: policy.definitionId,
    programProfile: policy.programProfile,
  },);
}
