/**
 Consumer contract for the retained native JavaScript conversion implementation.

 @module
 */
import type { NativeReturnOutcome, NativeReturnTool } from './native-return-types.ts';

/**
 Convert the original native result using its declared output modality.

 @param tool - original native conversion declaration

 @param outcome - original validated native outcome

 @returns native converted value before the result-binding profile is applied

 @throws Error when the native tool reports an ordinary text failure
 */
export function toScriptValue(tool: NativeReturnTool, outcome: NativeReturnOutcome): unknown;
