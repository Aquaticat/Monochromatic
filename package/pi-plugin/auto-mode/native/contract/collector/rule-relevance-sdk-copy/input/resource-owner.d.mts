/** Resource binding declarations follow the maintained frame custody implementation. @module */
import type { PolicyResourceFrame } from '../../../integration/policy-source/policy-loader-types.ts';

/**
 Read the complete frame bound to one original native resource occurrence.

 @param input - original native binding and its owned loader
 */
export function readBoundResourceFrame(input: {
  readonly binding: object;
  readonly loader: object;
}): PolicyResourceFrame;
