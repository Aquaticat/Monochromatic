//region Provider identity
// WHO CAN SERVE A CALL, named once, in the order the owner prefers to spend.
//
// This file imports nothing on purpose, the way `roster-id.ts` does: the
// budget layer, the router, the seat reader and the spend readers all need
// these names, and any of them importing another for the sake of a union
// would be a cycle waiting to happen.
//
// THE ORDER IS THE POLICY. Synthetic is a flat subscription and costs nothing
// at the margin; Charm Hyper is a prepaid balance the owner will not top up
// again (2026-09-03: "I have no reason to re-charge Hyper"); OpenRouter is
// paid per token and is where the owner would rather spend. So a call goes to
// the first provider in this order that serves its model and still has budget,
// and the routing arithmetic in `budget-routing.ts` walks this list rather
// than naming providers one by one.

/**
 * One of the providers this pipeline can buy a call from.
 *
 * @example
 * ```ts
 * const provider: ProviderName = 'openrouter';
 * ```
 */
export type ProviderName = 'synthetic' | 'hyper' | 'openrouter';

/**
 * Every provider, in the order the owner prefers to spend on them.
 *
 * @example
 * ```ts
 * const [preferred,] = PROVIDER_ORDER;
 * ```
 */
export const PROVIDER_ORDER: readonly ProviderName[] = [
  'synthetic',
  'hyper',
  'openrouter',
];

/**
 * One value per provider, keyed by name.
 *
 * A RECORD RATHER THAN THREE FIELDS, so adding a provider is one union member
 * and one order entry, and every site that reads all providers fails to
 * compile until it reads the new one too.
 *
 * @example
 * ```ts
 * const dry: ProviderRecord<boolean> = { synthetic: false, hyper: true, openrouter: false, };
 * ```
 */
export type ProviderRecord<ValueT,> = Readonly<Record<ProviderName, ValueT>>;

/**
 * Builds one record by asking a function about each provider in order.
 *
 * @param of - value for one provider
 *
 * @returns Record with every provider filled
 *
 * @example
 * ```ts
 * const holds = providerRecord({ of: function none(): number { return 0; }, },);
 * ```
 */
export function providerRecord<ValueT,>(
  { of, }: { readonly of: (provider: ProviderName,) => ValueT; },
): ProviderRecord<ValueT> {
  return {
    synthetic: of('synthetic',),
    hyper: of('hyper',),
    openrouter: of('openrouter',),
  };
}

/**
 * Every provider but one, in spending order.
 *
 * @param provider - provider to leave out
 *
 * @returns The others, in the order the owner prefers to spend on them
 *
 * @example
 * ```ts
 * otherProviders({ provider: 'hyper', },);
 * // => ['synthetic', 'openrouter',]
 * ```
 */
export function otherProviders(
  { provider, }: { readonly provider: ProviderName; },
): readonly ProviderName[] {
  return PROVIDER_ORDER.filter(function isOther(candidate,): boolean {
    return candidate !== provider;
  },);
}

/**
 * Whether a string names a provider.
 *
 * @param value - untrusted spelling, from a CLI flag or a log line
 *
 * @returns Whether it is one of the provider names
 *
 * @example
 * ```ts
 * if (isProviderName(value,)) route(value,);
 * ```
 */
export function isProviderName(value: string,): value is ProviderName {
  return PROVIDER_ORDER.some(function names(candidate,): boolean {
    return candidate === value;
  },);
}

//endregion Provider identity
