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
}): CreateAgentSessionResult[Key] {
  /** The SDK signature supplies value types; descriptors preserve accessor-free copying. */
  const descriptor: TypedPropertyDescriptor<CreateAgentSessionResult[Key]> | undefined = Object.getOwnPropertyDescriptor(result, key);
  if (descriptor === undefined || !Object.hasOwn(descriptor, 'value'))
    throw new NativeSessionRootError(`SDK result lacks original data field ${key}`);
  // A data descriptor owns its value even when the optional SDK field contains undefined.
  return descriptor.value as CreateAgentSessionResult[Key];
}

/**
 Preserve only original SDK result fields before native session identity validation.

 @param result - constructor result retained by the incumbent factory scope
 @returns frozen outer copy retaining original field values
 @throws NativeSessionRootError when the original result is not an ordinary data record
 */
export function prepareSdkResult(result: CreateAgentSessionResult): Readonly<CreateAgentSessionResult> {
  /** Result diagnostics never serialize the borrowed session or extension capabilities. */
  const rl = tagged({ tag: prepareSdkResult.name, l });
  const candidate: unknown = result;
  if (candidate === null || typeof candidate !== 'object' || Object.getPrototypeOf(candidate) !== Object.prototype)
    throw new NativeSessionRootError('SDK construction requires its ordinary original result');
  rl.debug('copying original SDK result data fields');
  const session = readSdkDataField({ result, key: 'session' });
  const extensionsResult = readSdkDataField({ result, key: 'extensionsResult' });
  if (!Object.hasOwn(result, 'modelFallbackMessage')) return Object.freeze({ session, extensionsResult });
  const modelFallbackMessage = readSdkDataField({ result, key: 'modelFallbackMessage' });
  return Object.freeze({ session, extensionsResult, modelFallbackMessage });
}

//endregion Copy only the fixed SDK result fields before original scope validation
