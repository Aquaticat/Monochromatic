import type { SyntheticClient, } from '../chat-contract.ts';
import type { BudgetView, } from '../provider-budget.ts';

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
};

//endregion Run client contract
