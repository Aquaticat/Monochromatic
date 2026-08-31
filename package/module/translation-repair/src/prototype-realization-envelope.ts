// PROTOTYPE ONLY: Candidate G output envelope accounting.

import { Buffer, } from 'node:buffer';

import { realizationEnvelopeWires, } from './prototype-realization-envelope-wire.ts';

export { realizationEnvelopeWires, } from './prototype-realization-envelope-wire.ts';
import type { RealizationObligationLedger, } from './prototype-realization-model.ts';
import type { ImmutableShell, } from './prototype-slot-model.ts';

/**
 * Project completion ceiling used by current Hyper calibration calls.
 */
export const REALIZATION_OUTPUT_TOKEN_CEILING = 32_000;

/**
 * Project estimate stricter than prior four-character estimate.
 */
export const REALIZATION_ESTIMATE_BYTES_PER_TOKEN = 3;

/**
 * One compact wire size and project token estimate.
 */
export type RealizationEnvelopeMeasurement = {
  readonly bytes: number;
  readonly estimatedTokens: number;
  readonly estimatedHeadroomTokens: number;
};

/**
 * Lower, upper-stress, and schema measurements for one immutable fixture.
 */
export type RealizationEnvelopeReport = {
  readonly shellSlotCount: number;
  readonly obligationCount: number;
  readonly authorSchemaBytes: number;
  readonly verifierSchemaBytes: number;
  readonly authorLowerWitness: RealizationEnvelopeMeasurement;
  readonly authorUpperStressWitness: RealizationEnvelopeMeasurement;
  readonly verifierLowerWitness: RealizationEnvelopeMeasurement;
  readonly verifierUpperStressWitness: RealizationEnvelopeMeasurement;
  readonly estimateBytesPerToken: number;
  readonly outputTokenCeiling: number;
};

/**
 * Measures one compact JSON wire under project token estimate.
 */
function measureWire({ text, }: { readonly text: string; }): RealizationEnvelopeMeasurement {
  const bytes = Buffer.byteLength(text,);
  const estimatedTokens = Math.ceil(bytes / REALIZATION_ESTIMATE_BYTES_PER_TOKEN,);
  return {
    bytes,
    estimatedTokens,
    estimatedHeadroomTokens: REALIZATION_OUTPUT_TOKEN_CEILING - estimatedTokens,
  };
}

/**
 * Measures compact schema-authorized Candidate G wires for fixed fixture.
 */
export function measureRealizationEnvelopes({
  shell,
  ledger,
}: {
  readonly shell: ImmutableShell;
  readonly ledger: RealizationObligationLedger;
}): RealizationEnvelopeReport {
  const wires = realizationEnvelopeWires({
    shell,
    ledger,
  });
  return {
    shellSlotCount: shell.slots
      .length,
    obligationCount: ledger.obligations
      .length,
    authorSchemaBytes: Buffer.byteLength(wires.authorSchemaText,),
    verifierSchemaBytes: Buffer.byteLength(wires.verifierSchemaText,),
    authorLowerWitness: measureWire({ text: wires.authorLowerWitnessText, }),
    authorUpperStressWitness: measureWire({ text: wires.authorUpperStressWitnessText, }),
    verifierLowerWitness: measureWire({ text: wires.verifierLowerWitnessText, }),
    verifierUpperStressWitness: measureWire({ text: wires.verifierUpperStressWitnessText, }),
    estimateBytesPerToken: REALIZATION_ESTIMATE_BYTES_PER_TOKEN,
    outputTokenCeiling: REALIZATION_OUTPUT_TOKEN_CEILING,
  };
}

/**
 * Refuses fixture whose compact upper stress witness lacks estimated headroom.
 */
export function assertRealizationEnvelopesFit({ report, }: {
  readonly report: RealizationEnvelopeReport;
}): void {
  if ((report.authorUpperStressWitness
    .estimatedHeadroomTokens
    <= 0)
    || (report.verifierUpperStressWitness
      .estimatedHeadroomTokens
      <= 0))
    throw new Error('realization upper stress wire exceeds project output ceiling estimate');
}
