/**
 Consumer contracts describe the existing native construction exports without replacing their owners.

 @module
 */
import type { DefaultResourceLoader } from '@earendil-works/pi-coding-agent';
import type { NativeForwardedFunction } from '../native-batch/runtime-types.ts';
import type { NativePolicyDesignation } from './bootstrap-types.ts';
import type {
  NativeCliPolicyInput,
  NativeResourceOptions,
  NativeResourceOwner
} from './resource-construction-types.ts';

export { DefaultResourceLoader } from '@earendil-works/pi-coding-agent';

/**
 Original constructor owner authenticates the generated native methods and retains its private records.

 @param input - fixed generated constructor and original private-field readers

 @returns original owner whose cleanup capability is used by the CLI host

 @throws Error when the required native constructor methods are unavailable
 */
export function createResourceInputOwner(input: {
  readonly DefaultResourceLoader: typeof DefaultResourceLoader;
  readonly readSessionLoader: NativeForwardedFunction;
  readonly readSessionPrompt: NativeForwardedFunction;
  readonly readSessionBase: NativeForwardedFunction;
  readonly readSessionRun: NativeForwardedFunction;
}): NativeResourceOwner;

/**
 Existing governing loader consumes the original owner and preserves native prompt and context inputs.

 @param input - original owner, designation, options, and fixed observation readers

 @returns original native policy input capability

 @throws Error when the original policy or resource configuration cannot be bound
 */
export function createGoverningPolicyLoader(input: NativePolicyDesignation & {
  readonly owner: NativeResourceOwner;
  readonly options: NativeResourceOptions;
  readonly readResourceToolInputs: NativeForwardedFunction;
  readonly readResourceToolOrigin: NativeForwardedFunction;
  readonly readResourceToolUsage: NativeForwardedFunction;
  readonly readSessionInputUsage: NativeForwardedFunction;
  readonly readSessionDomainEvents: NativeForwardedFunction;
  readonly readSessionConstructedInputs: NativeForwardedFunction;
}): NativeCliPolicyInput;

/** Original native extension-input readers retain their generated identities. */
export declare const readNativeExtensionToolInputs: NativeForwardedFunction;
/** Original native extension-origin reader authenticates its own publications. */
export declare const readNativeExtensionToolOrigin: NativeForwardedFunction;
/** Original native usage reader supplies existing input accounting. */
export declare const readNativeExtensionToolInputUsage: NativeForwardedFunction;
/** Original native session resource reader retains private-field access. */
export declare const readActiveSessionResourceLoader: NativeForwardedFunction;
/** Original native session prompt reader retains private-field access. */
export declare const readActiveSessionSystemPrompt: NativeForwardedFunction;
/** Original native base-composition reader retains its occurrence identity. */
export declare const readActiveSessionBaseComposition: NativeForwardedFunction;
/** Original native run-composition reader retains its occurrence identity. */
export declare const readActiveSessionRunComposition: NativeForwardedFunction;
/** Original native session usage reader supplies existing input accounting. */
export declare const readActiveSessionInputUsage: NativeForwardedFunction;
/** Original native event reader preserves source-domain observations. */
export declare const readActiveSessionDomainEvents: NativeForwardedFunction;
/** Original native constructed-input reader retains its existing receipts. */
export declare const readActiveSessionConstructedInputs: NativeForwardedFunction;
