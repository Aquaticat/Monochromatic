/**
 Copy original SDK data fields without invoking result accessors or accepting inherited fields.

 @module
 */
import type { CreateAgentSessionResult } from '@earendil-works/pi-coding-agent';
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { NativeSessionRootError } from './session-root-error.ts';

/** Result-copy diagnostics retain their own module boundary. */
const l = tagged({ tag: 'auto-mode-native-session-result' });

//region Copy only the fixed SDK result fields before original scope validation

/** Presence of an own data value narrows the optional descriptor slot without invoking getters. */
function hasOwnDataValue<Value>(descriptor: TypedPropertyDescriptor<Value>): descriptor is TypedPropertyDescriptor<Value> & { readonly value: Value } {
  return Object.hasOwn(descriptor, 'value');
}

/**
 Retain a descriptor already observed once without repeating native property traps.

 @param descriptor - original own descriptor observed on the typed SDK result
 @param key - SDK field used to identify an invalid accessor
 @returns original data value from the already observed descriptor
 @throws NativeSessionRootError when the descriptor is accessor-backed
 */
function readSdkDescriptor<const Key extends keyof CreateAgentSessionResult>({ descriptor, key }: {
  readonly descriptor: TypedPropertyDescriptor<Required<CreateAgentSessionResult>[Key]>;
  readonly key: Key;
}): Required<CreateAgentSessionResult>[Key] {
  if (!hasOwnDataValue(descriptor))
    throw new NativeSessionRootError(`SDK result lacks original data field ${key}`);
  return descriptor.value;
}

/**
 Read data from the typed original SDK result while retaining JavaScript shape checks.

 @param result - original constructor result whose fields must not invoke getters
 @param key - fixed public SDK field selected by this module
 @returns original data value without cloning native capabilities
 @throws NativeSessionRootError when a required field is missing or accessor-backed
 */
function readSdkDataField<const Key extends keyof CreateAgentSessionResult>({ result, key }: {
  readonly result: CreateAgentSessionResult;
  readonly key: Key;
}): Required<CreateAgentSessionResult>[Key] {
  /** The SDK signature supplies value types; descriptors preserve accessor-free copying. */
  const descriptor = Object.getOwnPropertyDescriptor(result, key);
  if (descriptor === undefined)
    throw new NativeSessionRootError(`SDK result lacks original data field ${key}`);
  return readSdkDescriptor({ descriptor, key });
}

/**
 Preserve only original SDK result fields before native session identity validation.

 @param result - constructor result retained by the incumbent factory scope
 @returns frozen outer copy retaining original field values
 @throws NativeSessionRootError when the original result is not an ordinary data record

 @example
 ```ts
 const prepared = prepareSdkResult(originalSdkResult);
 ```
 */
export function prepareSdkResult(result: CreateAgentSessionResult): Readonly<CreateAgentSessionResult> {
  /** Result diagnostics never serialize the borrowed session or extension capabilities. */
  const rl = tagged({ tag: prepareSdkResult.name, l });
  /** JavaScript callers retain the original ordinary-object check before typed field copying. */
  const candidate: unknown = result;
  if (candidate === null || typeof candidate !== 'object' || Object.getPrototypeOf(candidate) !== Object.prototype)
    throw new NativeSessionRootError('SDK construction requires its ordinary original result');
  rl.debug('copying original SDK result data fields');
  /** The native session identity is authenticated by the original construction scope. */
  const session = readSdkDataField({ result, key: 'session' });
  /** Extension setup retains its original SDK result identity. */
  const extensionsResult = readSdkDataField({ result, key: 'extensionsResult' });
  /** Observe optional field presence once, preserving original descriptor-trap cardinality. */
  const fallbackDescriptor = Object.getOwnPropertyDescriptor(result, 'modelFallbackMessage');
  if (fallbackDescriptor === undefined) return Object.freeze({ session, extensionsResult });
  /** A present fallback field stays present even for malformed untyped SDK callers. */
  const modelFallbackMessage = readSdkDescriptor({ descriptor: fallbackDescriptor, key: 'modelFallbackMessage' });
  return Object.freeze({ session, extensionsResult, modelFallbackMessage });
}

//endregion Copy only the fixed SDK result fields before original scope validation
