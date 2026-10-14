/**
 Consumer declarations for the existing native policy runtime implementation.

 @module
 */
import type {
  NativePolicyRuntime,
  NativePolicyRuntimeInput
} from './runtime-types.ts';

export { NativePolicyRuntimeError } from '../maintained-policy.mjs';

/**
 Bind original native request, judgment, source, context, and tool owners once per session.

 @param input - original constructor-owned session and fixed bootstrap dependencies

 @returns inspection and completed-session detachment without transferring ownership

 @throws NativePolicyRuntimeError when original session ownership or configuration is invalid
 */
export function bindNativePolicyRuntime(input: NativePolicyRuntimeInput): NativePolicyRuntime;
