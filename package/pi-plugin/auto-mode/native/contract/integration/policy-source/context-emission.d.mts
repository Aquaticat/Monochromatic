/** Context emission declarations follow the maintained publication implementation. @module */
import type { ResourceContextSnapshot } from '../../collector/resource-input-custody/values.ts';
import type {
  ContextPolicyCarrier,
  GoverningPolicyCapture,
  PolicyLoaderHandle,
  PolicyResourceFrame
} from './policy-loader-types.ts';

/**
 Publish fresh context entries from the already selected source capability.

 @param input - configured callback and original source reader
 */
export function createGoverningContextEmitter(input: {
  readonly callback: unknown;
  readonly readSource: () => GoverningPolicyCapture;
}): GoverningContextEmitter;

/** Emitter keeps the exact original capture-to-context publication operations. */
export type GoverningContextEmitter = {
  readonly emit: (input: unknown) => unknown;
  readonly reset: () => void;
  readonly publish: (input: {
    readonly nativeBinding: object;
    readonly loader: PolicyLoaderHandle;
    readonly frame: PolicyResourceFrame;
    readonly source: GoverningPolicyCapture;
  }) => ContextPolicyPublication;
};

/** Publication retains its prior context snapshot and governing carrier links. */
export type ContextPolicyPublication = {
  readonly prior: ResourceContextSnapshot;
  readonly carriers: readonly ContextPolicyCarrier[];
  readonly assertCurrent: () => void;
};
