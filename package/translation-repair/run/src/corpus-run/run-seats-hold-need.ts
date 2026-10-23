import type { BudgetView, } from '@monochromatic-dev/translation-repair-provider/ts';
import {
  PROVIDER_ORDER,
  type ProviderName,
  providerRecord,
  type ProviderRecord,
} from '@monochromatic-dev/translation-repair-shared-contract/ts';
import {
  belowFloorWritingBenches,
  benchesOf,
} from './run-seats-floor.ts';
import { judgeSeatsFor, } from './run-seats.ts';
import {
  type BenchName,
  benchShortfalls,
} from './run-seats-wait.ts';

//region Holds that cure a short bench
// A HOLD IS WAITED FOR ONLY WHEN THE PROVIDER, BACK, WOULD CURE A BENCH THAT STANDS SHORT. The seat reader waits
// while a bench the phase leans on stands short and a hold runs; a hold on a provider whose return leaves every such
// bench as short as it is (it serves no seat of the bench, or only seats the wet providers already reach) buys nothing,
// however
// long it is waited for, so it is left out of what the reader waits on. The question is asked of the roster itself:
// the seats are derived again with the providers back (`judgeSeatsFor`, which reads each seat's reach through
// `reachOf`), never from a list of provider names, so a roster change moves the answer without an edit here.
// Providers whose holds run together are judged together: a provider counts when the benches the held providers cure
// between them stay short without it, so two holds that only cure a bench jointly are both waited for.

/**
 The view with some providers back: dry for none of them, as before for the rest.

 @param dry - dryness per provider, holds folded in

 @param back - providers whose return is asked about

 @returns The view after their return

 @example
 ```ts
 const after = viewWithBack({ dry, back: ['hyper',], },);
 ```
 */
function viewWithBack(
  {
    dry,
    back,
  }: {
    readonly dry: BudgetView;
    readonly back: readonly ProviderName[];
  },
): BudgetView {
  return providerRecord({
    of: function dryAfter(provider,): boolean {
      return dry[provider] && (!back.includes(provider,));
    },
  },);
}

/**
 Benches the phase leans on that cannot do their work in a view: short of their quorum, or a writing bench below its
 floor.

 @param dry - dryness per provider the benches are derived for

 @param names - benches the phase leans on

 @returns The names of the unmet benches

 @example
 ```ts
 const unmet = unmetBenchNames({ dry, names: phaseBenches({ phase, },), },);
 ```
 */
function unmetBenchNames(
  {
    dry,
    names,
  }: {
    readonly dry: BudgetView;
    readonly names: readonly BenchName[];
  },
): ReadonlySet<BenchName> {
  /**
   Benches as derived for this view, whose seats the dryness itself withholds.
   */
  const benches = benchesOf({ seats: judgeSeatsFor({ dry, }), },);
  return new Set([
    ...benchShortfalls({
      benches,
      names,
      dry,
    },)
      .map(function nameOfShortfall({ name, },): BenchName {
        return name;
      },),
    ...belowFloorWritingBenches({
      benches,
      names,
      dry,
    },)
      .map(function nameBelowFloor({ name, },): BenchName {
        return name;
      },),
  ],);
}

/**
 How long each provider's hold counts for the seat reader's wait: the hold itself where the provider's return helps cure
 a bench that stands short, none otherwise.

 @param holds - how long each provider's refusal still holds it out

 @param dry - dryness per provider, holds folded in, the reading the benches were read from

 @param names - benches the phase leans on

 @returns The holds worth waiting for, in the shape of the holds given

 @example
 ```ts
 const waitFor = holdsThatCureShortBenches({ holds, dry, names: phaseBenches({ phase, },), },);
 ```
 */
export function holdsThatCureShortBenches(
  {
    holds,
    dry,
    names,
  }: {
    readonly holds: ProviderRecord<number>;
    readonly dry: BudgetView;
    readonly names: readonly BenchName[];
  },
): ProviderRecord<number> {
  /**
   Providers held out for some time.
   */
  const held = PROVIDER_ORDER.filter(function isHeld(provider,): boolean {
    return holds[provider] > 0;
  },);
  /**
   Benches that stand unmet now.
   */
  const unmet = unmetBenchNames({
    dry,
    names,
  },);
  /**
   Benches still unmet once every held provider is back.
   */
  const unmetAfterAll = unmetBenchNames({
    dry: viewWithBack({
      dry,
      back: held,
    },),
    names,
  },);
  /**
   Benches the held providers cure between them.
   */
  const cured = [...unmet,].filter(function isCured(name,): boolean {
    return !unmetAfterAll.has(name,);
  },);
  return providerRecord({
    of: function holdWorthWaiting(provider,): number {
      if (!held.includes(provider,))
        return 0;
      /**
       Benches still unmet when every held provider but this one is back.
       */
      const unmetWithout = unmetBenchNames({
        dry: viewWithBack({
          dry,
          back: held.filter(function isOther(other,): boolean {
            return other !== provider;
          },),
        },),
        names,
      },);
      return cured.some(function needsProvider(name,): boolean {
        return unmetWithout.has(name,);
      },)
        ? holds[provider]
        : 0;
    },
  },);
}

/**
 The clauses of the benches that stand short, each with the providers whose return alone would reach the quorum.

 @param dry - dryness per provider, holds folded in

 @param names - benches the clauses are for

 @returns One clause per short bench, naming the providers that could cure it, or saying that no single provider could

 @example
 ```ts
 const said = shortBenchesWithCure({ dry, names: phaseBenches({ phase, },), },);
 // => ['wide 3 of 7 reachable, quorum 4 (reached again with the return of synthetic, hyper, openrouter)',]
 ```
 */
export function shortBenchesWithCure(
  {
    dry,
    names,
  }: {
    readonly dry: BudgetView;
    readonly names: readonly BenchName[];
  },
): readonly string[] {
  return benchShortfalls({
    benches: benchesOf({ seats: judgeSeatsFor({ dry, }), },),
    names,
    dry,
  },)
    .map(function clauseWithCure({
      name,
      clause,
    },): string {
      /**
       Providers whose return alone leaves the bench met.
       */
      const curing = PROVIDER_ORDER.filter(function cures(provider,): boolean {
        return dry[provider] && (!unmetBenchNames({
          dry: viewWithBack({
            dry,
            back: [provider,],
          },),
          names,
        },)
          .has(name,));
      },);
      return (curing.length === 0)
        ? `${clause} (no single provider's return reaches it)`
        : `${clause} (reached again with the return of ${curing.join(', ',)})`;
    },);
}

//endregion Holds that cure a short bench
