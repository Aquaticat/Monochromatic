import {
  neuralWattTimeOfDayShort,
} from './neuralwatt-day.ts';
import type { NeuralWattReturn, } from './budget-routing.ts';
import { NEURALWATT_RETURN_WAIT_BOUND_MS, } from './neuralwatt-return-hold.ts';
import {
  PROVIDER_ORDER,
  type ProviderRecord,
} from '@monochromatic-dev/translation-repair-shared-contract/ts';

//region Hold reason
// THE WORDS A WAIT AND A REFUSAL GIVE FOR A HOLD, so a read of the run can tell a refusal's hold from NeuralWatt's day
// starting again, and a refusal past the bound states when NeuralWatt returns.

/**
 Milliseconds in a second, for the bound as the sentence states it.
 */
const MS_PER_SECOND = 1_000;

/**
 Names the providers whose hold is the shortest, with NeuralWatt's day start where NeuralWatt is one of them.

 @param holds - milliseconds of hold left per provider

 @param shortest - the shortest running hold, as `shortestHold` read it

 @param neuralwatt - what the run knows of NeuralWatt's day

 @returns The providers in spending order, or `no provider` where nothing is held

 @example
 ```ts
 holdReasonOf({ holds, shortest: 48_000, neuralwatt: { kind: 'at', msOfDay: 69_308_000, }, },);
 // => 'neuralwatt, whose day starts again at 19:15:08 UTC'
 ```
 */
export function holdReasonOf(
  {
    holds,
    shortest,
    neuralwatt,
  }: {
    readonly holds: ProviderRecord<number>;
    readonly shortest: number;
    readonly neuralwatt: NeuralWattReturn;
  },
): string {
  /**
   Providers whose hold is the shortest running one.
   */
  const holders = PROVIDER_ORDER.filter(function isShortest(provider,): boolean {
    return (shortest > 0) && (holds[provider] === shortest);
  },);
  if (holders.length === 0)
    return 'no provider';
  return holders.map(function nameOf(provider,): string {
    return ((provider === 'neuralwatt') && (neuralwatt.kind === 'at'))
      ? `neuralwatt, whose day starts again at ${neuralWattTimeOfDayShort({ msOfDay: neuralwatt.msOfDay, },)} UTC`
      : provider;
  },)
    .join(', ',);
}

/**
 The clause a refusal adds when NeuralWatt reads dry and its day starts again, which no wait took because it is past the
 bound.

 @param neuralwatt - what the run knows of NeuralWatt's day

 @returns One sentence stating the time of day and the bound, or no sentence where the run decided no day start

 @example
 ```ts
 beyondBoundClausesOf({ neuralwatt: { kind: 'at', msOfDay: 69_308_000, }, },);
 ```
 */
export function beyondBoundClausesOf({ neuralwatt, }: { readonly neuralwatt: NeuralWattReturn; },): readonly string[] {
  if (neuralwatt.kind !== 'at')
    return [];
  return [
    `NeuralWatt reads dry and its day starts again at ${
      neuralWattTimeOfDayShort({ msOfDay: neuralwatt.msOfDay, },)
    } UTC, which is past the ${String(NEURALWATT_RETURN_WAIT_BOUND_MS / MS_PER_SECOND,)} s this run waits for it`,
  ];
}

//endregion Hold reason
