// PROTOTYPE ONLY: Candidate G obligation evidence identity.

import { hashContent, } from './document-node.ts';
import type { RealizationObligation, } from './prototype-realization-model.ts';

/**
 * Digests every semantic-free manifest field controlling one obligation.
 */
export function realizationObligationEvidenceDigest({ obligation, }: {
  readonly obligation: Omit<RealizationObligation, 'id' | 'evidenceDigest'>;
}): string {
  return hashContent({ content: JSON.stringify(obligation,), });
}
