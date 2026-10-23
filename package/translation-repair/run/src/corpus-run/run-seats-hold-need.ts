import {
  type BudgetView,
  reachOf,
  visionReachOf,
} from '@monochromatic-dev/translation-repair-provider/ts';
import {
  providerRecord,
  type ProviderRecord,
  type RosterModelId,
} from '@monochromatic-dev/translation-repair-shared-contract/ts';
import { belowFloorWritingBenches, } from './run-seats-floor.ts';
import {
  type BenchName,
  benchShortfalls,
} from './run-seats-wait.ts';

//region Holds that serve a short bench
// A HOLD IS WAITED FOR ONLY WHEN IT COULD BRING A SHORT BENCH BACK. The seat reader waits
// while a bench the phase leans on stands short and a hold runs; a hold on a provider that serves no seat of any such
// bench cannot change what that bench reaches, however long it is waited for, so it is left out of what the reader
// waits on. Which providers serve a bench's seats comes from the roster through `reachOf` (`visionReachOf` for the
// readers, who must show a picture), never from a list of provider names, so a roster change moves it without an edit
// here.

/**
 How long each provider's hold counts for the seat reader's wait: the hold itself where the provider serves a seat of a
 bench that stands short or whose writers are below their floor, none otherwise.

 @param holds - how long each provider's refusal still holds it out

 @param benches - each bench the phase leans on, keyed by name

 @param names - benches to read, the ones the phase leans on

 @param dry - dryness per provider, holds folded in, the reading the benches were read from

 @returns The holds worth waiting for, in the shape of the holds given

 @example
 ```ts
 const waitFor = holdsThatServeShortBenches({ holds, benches, names: phaseBenches({ phase, },), dry, },);
 ```
 */
export function holdsThatServeShortBenches(
  {
    holds,
    benches,
    names,
    dry,
  }: {
    readonly holds: ProviderRecord<number>;
    readonly benches: Readonly<Record<BenchName, readonly RosterModelId[]>>;
    readonly names: readonly BenchName[];
    readonly dry: BudgetView;
  },
): ProviderRecord<number> {
  /**
   Benches that need a provider back: the ones short of quorum and the writing benches below their floor.
   */
  const needing = [
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
  ];
  return providerRecord({
    of: function holdWorthWaiting(provider,): number {
      return needing.some(function isServedByProvider(name,): boolean {
        return benches[name]
          .some(function seatIsServed(modelId,): boolean {
            return ((name === 'readers') ? visionReachOf({ modelId, },) : reachOf({ modelId, },))[provider];
          },);
      },)
        ? holds[provider]
        : 0;
    },
  },);
}

//endregion Holds that serve a short bench
