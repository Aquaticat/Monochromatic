/**
 Consume original whole-request content estimates without granting authority or domain completeness.

 @module
 */
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { SemanticAdmissionPolicyError, } from './semantic-admission-error.ts';
import type {
  RequestMaterialAdmission,
  RequestMaterialEvidence,
  RequestMaterialInputs,
  RequestMaterialInterpretation,
  RequestMaterialJudgment,
} from './request-material-types.ts';

/**
 Diagnostics contain lifecycle labels, never original request material.
 */
const l = tagged({ tag: 'auto-mode-request-material', },);

//region Native owners authenticate the complete batch before this consumer runs

/**
 Consume one original batch member as whole-request content.
 Native callers authenticate batch membership and revalidate dependencies after policy callbacks.
 Reference checks here reject equal-byte substitutions; they do not authenticate caller-created owners.
 Only the interpretation container is frozen, never borrowed evidence, callbacks or requests.
 No request parsing, directive lowering, authority assignment or domain certification occurs here.

 @param judgment - original request reader with its fixed native receiver

 @param inputs - original source-bound request views

 @param record - original member of the already-authenticated batch

 @param policy - fixed bootstrap code policy for model attribution and admission

 @returns owned interpretation retaining original request and evidence references

 @throws SemanticAdmissionPolicyError for mismatched identity, question, status or acceptance result

 @throws original reader or policy callback failure without replacing its value

 @example
 ```ts
 const interpretation = consumeRequestMaterial({ judgment, inputs, record, policy });
 // An admitted none does not establish governing-source completeness.
 ```
 */
export function consumeRequestMaterial<const Evidence extends RequestMaterialEvidence>(
  { judgment, inputs, record, policy, }: {
    readonly judgment: RequestMaterialJudgment;
    readonly inputs: RequestMaterialInputs;
    readonly record?: Evidence;
    readonly policy: RequestMaterialAdmission;
  },
): RequestMaterialInterpretation<Evidence> {
  /**
   Record consumer entry without serializing borrowed evidence.
   */
  const rl = tagged({ tag: consumeRequestMaterial.name, l, },);
  rl.debug('consuming original whole-request content estimate',);
  if (record?.definitionId !== 'request_instruction_content'
    || record.definition.type !== 'choice'
    || record.binding.claimScope !== 'program-request') {
    throw new SemanticAdmissionPolicyError('Request material requires its original whole-request content question',);
  }
  /**
   Invoke the original reader with its existing receiver and currentness checks.
   */
  const request = judgment.requestMaterialFor();
  if (record.binding.requestMaterial !== request)
    throw new SemanticAdmissionPolicyError('Whole-request estimate belongs to a different original request occurrence',);
  /**
   Missing source views cannot add a request-wide authority claim.
   */
  const sourceRequest = inputs.instructionSources[0]?.request.request;
  if (sourceRequest !== undefined && sourceRequest !== request)
    throw new SemanticAdmissionPolicyError('Whole-request estimate differs from the original source-bound request',);
  if (record.answer.status === 'estimate' && record.model === policy.model) {
    /**
     Preserve original value identity when passing it to fixed code policy.
     */
    const { value, } = record.answer;
    if (value === undefined || (value.choice !== 'none'
      && value.choice !== 'potential-instruction' && value.choice !== 'unknown')) {
      throw new SemanticAdmissionPolicyError('Whole-request answer is outside the fixed content relationship',);
    }
    /**
     Callback may abstain, but cannot return facts or a final verdict.
     */
    const admitted = policy.accepts(value,);
    if (typeof admitted !== 'boolean') {
      throw new SemanticAdmissionPolicyError(
        'Request-material policy must synchronously admit or abstain, not assign authority or completeness',
      );
    }
    if (admitted) {
      rl.debug('code policy admitted original request content relationship',);
      return Object.freeze({ request, evidence: record, admission: 'admitted', relation: value.choice, permission: false, },);
    }
  }
  else if (record.answer.status !== 'estimate' && record.answer.status !== 'unresolved') {
    throw new SemanticAdmissionPolicyError('Whole-request evidence is not a usable estimate or explicit unresolved answer',);
  }
  rl.debug('abstaining from original request content relationship',);
  return Object.freeze({ request, evidence: record, admission: 'abstained', permission: false, },);
}

//endregion Original content-use consumer
