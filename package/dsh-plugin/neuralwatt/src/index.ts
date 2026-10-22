/**
 NeuralWatt provider plugin entry: owns the `neuralwatt` provider route over
 the shipped pi-ai adapter, serving a checked-in model snapshot at mount and
 landing the live NeuralWatt listing once the mount fetch resolves. @module
 */

import type {
  Context,
} from '@deepseek-ai/cordis';
import {
  apply as applyPiAiAdapter,
} from '@deepseek-ai/dsh-llm-pi-ai';
import {
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import {
  neuralWattLogger,
} from './logging.ts';
import {
  createNeuralWattProviders,
  refreshNeuralWattProviders,
} from './providers.ts';
import {
  neuralWattListingSnapshot,
} from './snapshot.ts';

export * from './constants.ts';
export * from './fetch-listing.ts';
export * from './listing.ts';
export * from './logging.ts';
export * from './providers.ts';
export * from './snapshot.ts';

//region Plugin contract

/**
 Host services the plugin reads at activation: the `llm` surface the shipped
 adapter registers the route and the model-discovery handler on.
 */
export const inject: readonly string[] = ['llm'];

/**
 Activate the NeuralWatt provider: serve the checked-in snapshot immediately,
 hand the route to the shipped pi-ai adapter, and land the live listing once
 the mount fetch resolves.

 @param ctx - loader-scoped registration context

 @example
 ```ts
 apply(ctx);
 ```
 */
export function apply(ctx: Context): void {
  /**
   Logger tagged with the plugin entry name.
   */
  const logger = tagged({
    tag: apply.name,
    l: neuralWattLogger,
  },);
  /**
   Served provider dict seeded with the checked-in snapshot.
   */
  const providers = createNeuralWattProviders({
    listing: neuralWattListingSnapshot,
  },);
  applyPiAiAdapter(ctx, { providers: providers.reference, },);
  logger.debug('neuralwatt provider applied over the shipped pi-ai adapter');
  ctx.effect(async function refreshNeuralWattListing() {
    await refreshNeuralWattProviders({ providers, },);
  });
}

//endregion Plugin contract
