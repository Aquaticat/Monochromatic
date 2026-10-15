/**
 Native CLI construction retains complete original resource capabilities.

 @module
 */
import type {
  DefaultResourceLoader,
  ExtensionAPI,
  ResourceLoader
} from '@earendil-works/pi-coding-agent';
import type {
  NativeHostResource,
  NativeHostPolicyInput,
  NativeReloadable
} from './resource-types.ts';

/**
 The original constructor owner remains opaque except for host cleanup.
 */
export type NativeResourceOwner = {
  readonly drain: (loader: NativeReloadable) => Promise<void>;
};

/**
 Native policy construction supplies the original loader and private binding readers.
 */
export type NativeCliPolicyInput = NativeHostPolicyInput & {
  readonly loader: ResourceLoader;
  readonly nativeBinding: object;
  readonly readCurrent: () => unknown;
  readonly assertCurrent: (value: unknown) => void;
};

/**
 Mutable API publication belongs to the original resource extension callback.
 */
export type NativeResourceApi = {current?: ExtensionAPI};

/**
 Full CLI construction includes the cleanup and API capabilities omitted by reload-only consumers.
 */
export type NativeCliResource = NativeHostResource & {
  readonly loader: ResourceLoader;
  readonly policyInput: NativeCliPolicyInput;
  readonly nativeApi: NativeResourceApi;
  readonly owner: NativeResourceOwner;
};

/**
 Native resource options use the installed SDK's constructor signature.
 */
export type NativeResourceOptions = ConstructorParameters<typeof DefaultResourceLoader>[0];
