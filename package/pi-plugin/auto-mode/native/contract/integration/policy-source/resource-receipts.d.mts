/** Resource receipt declarations follow the maintained custody implementation. @module */
import type { ResourceContextSnapshot } from '../../collector/resource-input-custody/values.ts';
import type {
  PolicyResourceFrame,
  ResourceReceiptInput
} from './policy-loader-types.ts';

/**
 Project owned resource observations without assigning file identity or source authority.

 @param input - original bound frame and prior context publication
 */
export function createResourceReceiptInputs(input: {
  readonly frame: PolicyResourceFrame;
  readonly priorContext: ResourceContextSnapshot | undefined;
}): readonly ResourceReceiptInput[];

/**
 Keep resource reload receipts while the same loader owns their lifetime.

 @param input - previous retained receipts and this occurrence's receipts
 */
export function retainResourceReceiptInputs(input: {
  readonly previous: readonly ResourceReceiptInput[];
  readonly current: readonly ResourceReceiptInput[];
}): readonly ResourceReceiptInput[];
