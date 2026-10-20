import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { contextRoot, } from '@monochromatic-dev/translation-repair-typography/ts';
import type { ExtractedCompletion, } from '@monochromatic-dev/translation-repair-provider-stream/ts';
import { readNeuralWattComments, } from './neuralwatt-comments.ts';
import type { NeuralWattReservation, } from './neuralwatt-ledger.ts';
import { reportSpend, } from './spend-line.ts';

//region NeuralWatt settlement
// WHAT A FINISHED CALL TELLS THE METER. The stream's two comment lines
// (`neuralwatt-comments.ts`) settle the reservation the call held: the measured
// energy replaces the estimate, a missing energy comment leaves the estimate
// standing and marked, and a cost above zero ends the UTC day for this provider.
//
// A COST ABOVE ZERO IS SAID PLAINLY, on a warning and not buried in a debug
// line: it means a request left the free energy and came out of the owner's
// plan, which the estimate was there to prevent, and the owner reads it as the
// signal to recalibrate the margin (`neuralwatt-estimate.ts`).

/**
 Logger root for the settlement.
 */
const l = contextRoot({ tag: 'translation-repair', },);

/**
 Decimals an energy figure is logged to: a call is a few thousandths of a
 watt-hour.
 */
const ENERGY_LOG_DECIMALS = 4;

/**
 Settles one finished call against the day's energy and reports it.

 @param reservation - hold the call took before it was sent
 
 @param servedId - model the call went to
 
 @param extracted - completion reassembled from the stream
 
 @param bodyText - whole drained stream, comment lines included
 
 @param estimateWh - energy the call held
 
 @param promptTokens - prompt tokens the estimate was drawn for

 @throws {@link Error} when the ledger line cannot be written; the hold is
 released first

 @example
 ```ts
 await settleNeuralWattCall({ reservation, servedId, extracted, bodyText, estimateWh, promptTokens, },);
 ```
 */
export async function settleNeuralWattCall(
  {
    reservation,
    servedId,
    extracted,
    bodyText,
    estimateWh,
    promptTokens,
  }: {
    readonly reservation: NeuralWattReservation;
    readonly servedId: string;
    readonly extracted: ExtractedCompletion;
    readonly bodyText: string;
    readonly estimateWh: number;
    readonly promptTokens: number;
  },
): Promise<void> {
  /**
   Logger pre-tagged with this function's name.
   */
  const rl = tagged({
    tag: settleNeuralWattCall.name,
    l,
  },);

  /**
   What NeuralWatt said about this request's energy and cost.
   */
  const {
    energyWh,
    requestCostUsd,
  } = readNeuralWattComments({ bodyText, },);
  reportSpend({
    provider: 'neuralwatt',
    label: servedId,
    extracted,
    // Conditional spread keeps an unreported cost absent instead of zero.
    ...((requestCostUsd === undefined) ? {} : { costUsd: requestCostUsd, }),
  },);

  /**
   The energy half of the log line: measured against the estimate, or the
   estimate standing.
   */
  const energyNote = (energyWh === undefined)
    ? `not reported, ${estimateWh.toFixed(ENERGY_LOG_DECIMALS,)} Wh estimated stands`
    : `${energyWh.toFixed(ENERGY_LOG_DECIMALS,)} Wh measured against ${estimateWh.toFixed(ENERGY_LOG_DECIMALS,)} Wh estimated`;
  rl.info(`NeuralWatt energy ${servedId}: ${energyNote} for ${String(promptTokens,)} prompt tokens`,);
  if ((requestCostUsd !== undefined) && (requestCostUsd > 0))
    rl.warn(
      `NeuralWatt BILLED a ${servedId} request ${requestCostUsd.toString()} USD to the plan, which free energy `
        + 'does not do; its free energy is treated as spent, and calls to it stop until 00:00 UTC',
    );
  await reservation.settle({
    // Conditional spreads keep an unreported figure absent.
    ...((energyWh === undefined) ? {} : { measuredWh: energyWh, }),
    ...((requestCostUsd === undefined) ? {} : { billedUsd: requestCostUsd, }),
  },);
}

//endregion NeuralWatt settlement
