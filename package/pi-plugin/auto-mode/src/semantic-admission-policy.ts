/**
 Snapshot explicitly configured semantic admission fields at bootstrap.

 @module
 */
import { isProxy, } from 'node:util/types';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { SemanticAdmissionPolicyError, } from './semantic-admission-error.ts';
import type {
  SemanticAcceptance,
  SemanticAdmissionDefinition,
  SemanticAdmissionPolicy,
} from './semantic-admission-types.ts';

/**
 Closed input fields contain configuration, never facts, source coverage or verdicts.
 */
const fields = ['model', 'definitionId', 'programProfile', 'accepts',] as const;

/**
 Logs do not serialize borrowed configuration or callbacks.
 */
const l = tagged({ tag: 'auto-mode-semantic-admission-policy', },);

/**
 Callable identity is retained without invoking or inspecting its implementation.

 @param value - bootstrap callback candidate

 @returns whether JavaScript can invoke this candidate as a function
 */
function isAcceptance(value: unknown,): value is SemanticAcceptance {
  return typeof value === 'function';
}

/**
 Copy only an ordinary, explicitly declared bootstrap policy for an implemented consumer.
 Absence means no configured policy, not failed validation or automatic admission.
 Native callers supply the fixed definition ID before judgment construction.
 Proxy configurations are rejected before reflection; accessors are never invoked.
 Owned field storage is frozen, but the original configuration and callback remain borrowed.

 @param input - original bootstrap declaration or absent configuration

 @param definitionId - implemented consumer selected by native bootstrap

 @returns owned configuration, or undefined when no policy was configured

 @throws SemanticAdmissionPolicyError when configuration is outside the declared profile

 @example
 ```ts
 const policy = copySemanticAdmissionPolicy({
   input: configuredPolicy,
   definitionId: 'request_instruction_content',
 });
 // This configuration supplies no semantic truth or execution permission.
 ```
 */
export function copySemanticAdmissionPolicy(
  { input, definitionId, }: { readonly input: unknown; readonly definitionId: SemanticAdmissionDefinition; },
): SemanticAdmissionPolicy | undefined {
  /**
   Bootstrap configuration remains separate from runtime estimate consumption.
   */
  const rl = tagged({ tag: copySemanticAdmissionPolicy.name, l, },);
  rl.debug('capturing explicit semantic admission policy',);
  if (input === undefined) {
    rl.debug('no semantic admission policy configured',);
    return undefined;
  }
  if (input === null || typeof input !== 'object' || isProxy(input,)
    || Object.getPrototypeOf(input,) !== Object.prototype) {
    throw new SemanticAdmissionPolicyError('Semantic admission policy requires an ordinary bootstrap configuration',);
  }
  /**
   Inspect original data descriptors without calling configuration getters.
   */
  const keys = Reflect.ownKeys(input,);
  if (keys.length !== fields.length || keys.some(function unsupported(key,) {
    return !fields.some(function matches(field,) { return field === key; },);
  },)) {
    throw new SemanticAdmissionPolicyError('Semantic admission policy accepts only model, definitionId, programProfile and accepts',);
  }
  /**
   This owned record receives only the closed set of declared keys.
   */
  const values: Record<string, unknown> = {};
  for (const key of fields) {
    /**
     Value descriptors preserve callback identity without freezing borrowed fields.
     */
    const descriptor = Object.getOwnPropertyDescriptor(input, key,);
    if (descriptor?.enumerable !== true || !Object.hasOwn(descriptor, 'value',))
      throw new SemanticAdmissionPolicyError('Semantic admission policy requires data properties',);
    values[key] = descriptor.value;
  }
  if (typeof values.model !== 'string' || !values.model
    || typeof values.programProfile !== 'string' || !values.programProfile) {
    throw new SemanticAdmissionPolicyError('Semantic admission policy must name its model and inspected program profile',);
  }
  if (values.definitionId !== definitionId)
    throw new SemanticAdmissionPolicyError('Semantic admission definition is outside the selected code consumer',);
  if (!isAcceptance(values.accepts,))
    throw new SemanticAdmissionPolicyError('Semantic admission requires an explicit code acceptance rule',);
  return Object.freeze({
    model: values.model,
    definitionId,
    programProfile: values.programProfile,
    accepts: values.accepts,
  },);
}
