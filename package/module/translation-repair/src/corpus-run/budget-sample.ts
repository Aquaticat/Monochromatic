import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { createHyperClient, } from '../hyper-client.ts';
import { createProviderBudgets, } from '../provider-budget.ts';
import { createSyntheticClient, } from '../synthetic-client.ts';

//region Budget sample
// Takes ONE reading of both providers' meters and leaves it in the log.
//
// WHY THIS EXISTS SEPARATELY FROM A RUN. The budget layer reads the meters when
// something asks to spend, so the availability record is dense while a pass is
// running and empty otherwise. That is the right denominator for a duty cycle,
// which prices a seat by availability WHEN WE WERE ASKING. It is the wrong one
// for the other half of the question: an outage that stops a pass also stops
// the readings, so nothing observes when the provider came back, and every
// outage that ended a run reads as open-ended forever.
//
// This closes that. Run it between passes, or on a timer, and the record gains
// readings during the quiet stretches where the recovery actually happened.
//
// SPENDS NO GENERATION. It reads two meter endpoints, the same two the router
// already reads once a minute while working. No model is called, no token is
// produced, and nothing is written to a run directory.
//
// THE READING IS THE OUTPUT. It goes to the log as a `METERS` line, which is
// the same line a pass leaves and the same line `meter-report` reads back.
// Capture both streams: the reading is at info and an unreadable meter warns.

/**
 * Logger root for this probe.
 */
const l = tagged({ tag: 'translation-repair', },);

/**
 * How long one sample may take before it is abandoned.
 *
 * SET TO THE FRESHNESS WINDOW rather than picked. A reading is trusted for
 * sixty seconds, so one that takes longer than that to arrive has aged out
 * before it could be used, and a sampler that waits past it is measuring the
 * endpoint's latency rather than the provider's budget.
 */
const SAMPLE_TIMEOUT_MS = 60_000;

/**
 * Reads both meters once and leaves the reading in the log.
 *
 * Returns nothing: the `METERS` line IS the output.
 *
 * @throws {@link Error} when either provider's key is absent, since a sample
 * of one provider cannot answer a question about the other
 *
 * @example
 * ```ts
 * await sampleBudgets();
 * ```
 */
async function sampleBudgets(): Promise<void> {
  /**
   * Logger pre-tagged with this function's name.
   */
  const rl = tagged({
    tag: sampleBudgets.name,
    l,
  },);

  /**
   * First provider's key, injected by mise from the sops-encrypted env.
   */
  const syntheticKey = process.env
    .TRANSLATION_REPAIR_SYNTHETIC_API_KEY
    ?? '';

  /**
   * Second provider's key, from the same place.
   */
  const hyperKey = process.env
    .TRANSLATION_REPAIR_CHARM_HYPER_API_KEY
    ?? '';

  if ((syntheticKey === '') || (hyperKey === '')) {
    throw new Error(
      'both provider keys must be set to sample availability, and at least one is not: '
        + `TRANSLATION_REPAIR_SYNTHETIC_API_KEY is ${syntheticKey === '' ? 'absent' : 'present'}, `
        + `TRANSLATION_REPAIR_CHARM_HYPER_API_KEY is ${hyperKey === '' ? 'absent' : 'present'}. `
        + 'Run under mise so sops injects them. A sample of one provider is not recorded, '
        + 'because the record is read as a statement about both and a missing column would '
        + 'be indistinguishable from a provider that answered.',
    );
  }

  /**
   * Budget view over both meters, which logs what it reads.
   *
   * ITS CACHE CANNOT INTERFERE. A fresh view has never read anything, so the
   * first call always reaches the wire, and this process makes exactly one.
   */
  const budgets = createProviderBudgets({
    synthetic: createSyntheticClient({ apiKey: syntheticKey, },),
    hyper: createHyperClient({ apiKey: hyperKey, },),
  },);

  /**
   * The routed view, whose real product is the line the read leaves behind.
   */
  const view = await budgets.read({ signal: AbortSignal.timeout(SAMPLE_TIMEOUT_MS,), },);

  rl.info(
    `SAMPLED: routing would ${view.syntheticDry ? 'avoid' : 'use'} synthetic and `
      + `${view.hyperDry ? 'avoid' : 'use'} hyper. The reading logged above is the record; `
      + 'read a collection of them with `mise run //package/module/translation-repair:meter-report`',
  );
}

await sampleBudgets();

//endregion Budget sample
