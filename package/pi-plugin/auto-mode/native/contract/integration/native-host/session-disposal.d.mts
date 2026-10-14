/**
 Original private-state reader remains an opaque forwarded native callback.

 @module
 */
import type { NativeForwardedFunction } from '../native-batch/runtime-types.ts';

/**
 Native runtime consumes the original generated function without changing its identity.
 */
export declare const readSessionDisposalState: NativeForwardedFunction;
