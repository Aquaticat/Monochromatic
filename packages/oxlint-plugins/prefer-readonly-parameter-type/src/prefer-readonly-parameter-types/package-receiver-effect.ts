/**
 * Package receiver-effect construction.
 *
 * @module
 */

import type {
  IntrinsicEffectEntry,
  IntrinsicProvenance,
} from './intrinsic-effect-catalog.ts';

/**
 * Creates package receiver mutation entry.
 *
 * @param provenance - Exact package and major identity
 *
 * @param ownerType - Declaring receiver type
 *
 * @param member - Mutating member name
 *
 * @param evidence - Audited declaration evidence
 *
 * @returns Package receiver effect
 *
 * @example
 * ```ts
 * receiverEffect({ provenance, ownerType: 'Writer', member: 'write', evidence: 'source audit' });
 * ```
 */
export function receiverEffect({
  provenance,
  ownerType,
  member,
  evidence,
}: {
  readonly provenance: IntrinsicProvenance;
  readonly ownerType: string;
  readonly member: string;
  readonly evidence: string;
},): IntrinsicEffectEntry {
  return {
    provenance,
    ownerType,
    member,
    targets: [{ kind: 'receiver', },],
    evidence,
  };
}
