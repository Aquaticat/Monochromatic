import type { SyntheticClient, } from '../chat-contract.ts';
import type { BudgetView, } from '../provider-budget.ts';
import type { ProviderRecord, } from '../provider-name.ts';

//region Run client contract
// THE CLIENT A CORPUS RUN HOLDS: the routed caller every stage calls, the
// first provider's meter that older callers still read, and the dryness view
// the seat reader derives benches from.
//
// A SEPARATE FILE so the entry drivers and the seat reader can name the type
// without importing `run-config.ts`, which loads the whole roster and refuses
// invalid role compositions at import time.

/**
 * Client every corpus-run entrypoint is handed.
 *
 * @example
 * ```ts
 * const client: RunClient = createRunClient();
 * ```
 */
export type RunClient = SyntheticClient & {
  /**
   * Which providers are out of budget right now, holds folded in, as the
   * router itself sees them.
   *
   * READ BEFORE EACH PHASE by `run-seats.ts`, which withholds a judge seat
   * while the provider that would serve it is one that serves it too slowly
   * for the round window, or one the owner declined to pay that model's rate
   * on. The view is the router's own, so the seat reader and the router agree
   * about where a call would go.
   */
  readonly providerDryness: (args: { readonly signal: AbortSignal; },) => Promise<BudgetView>;

  /**
   * How long each provider's last refusal still holds it out, in
   * milliseconds, zero when it is not held.
   * READ BESIDE THE DRYNESS by `run-seats.ts` since the thirteenth class: a
   * bench that cannot reach quorum among the seats a wet provider serves waits
   * out the shortest running hold once, as the router does when every provider
   * reads dry, rather than seating a phase that settles on nobody.
   */
  readonly providerHolds: () => ProviderRecord<number>;
};

//endregion Run client contract
