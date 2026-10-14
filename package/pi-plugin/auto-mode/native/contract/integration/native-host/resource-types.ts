/**
 Native resource records retain original reload callbacks and optional host capabilities.

 @module
 */
import type {
  ExtensionAPI,
  ResourceLoader
} from '@earendil-works/pi-coding-agent';

/**
 Resource reload forwards Pi's existing trust-resolution options unchanged.
 */
export type NativeReloadOptions = Parameters<ResourceLoader['reload']>[0];

/**
 Registration only requires the native reload operation; full SDK loaders retain their other fields.
 */
export type NativeReloadable = Pick<ResourceLoader, 'reload'>;

/**
 Original policy input supplies reload and its retained binding without exposing private state.
 */
export type NativeHostPolicyInput = {
  readonly reload: (options?: NativeReloadOptions) => Promise<unknown>;
  readonly nativeBinding?: unknown;
  readonly readCurrent?: () => unknown;
  readonly assertCurrent?: (value: unknown) => void;
};

/**
 Direct SDK fixtures may register reload alone; CLI resources also retain their original API and owner.
 */
export type NativeHostResource = {
  readonly loader: NativeReloadable;
  readonly policyInput: NativeHostPolicyInput;
  readonly nativeApi?: { readonly current?: ExtensionAPI };
  readonly owner?: { readonly drain: (loader: NativeReloadable) => Promise<void> };
};

/**
 One reload input preserves original loader identity and native optional arguments.
 */
export type NativeHostReloadInput = {
  readonly loader: NativeReloadable;
  readonly options?: NativeReloadOptions;
};
