/**
 Formatting for retirement decisions.

 One module owns the wording so the session log and the tests cannot drift apart,
 and so decision 9 in `doc/planning/pi-model-retirement.md` has a single place to
 change: the log is the only surface for the retirement table now that there is no
 audit task.

 @module
 */

import type { AbstentionCounts, Retirement, } from './retirement-rule.ts';
import type { FilterPlanning, } from './provider-filter.ts';

//region Lines

/**
 Format one retirement as a single log line.

 @param retirement - decided retirement

 @returns line naming the retired id, its provider, and the id that supersedes it

 @example
 ```typescript
 formatRetirementLine({ retirement: { provider: 'hyper', api: 'openai-completions', retiredId: 'glm-5.2', keeperId: 'glm-5.3' } });
 // 'retired hyper/glm-5.2 in favor of glm-5.3'
 ```
 */
export function formatRetirementLine(
  {
    retirement,
  }: {
    readonly retirement: Retirement;
  },
): string {
  return `retired ${retirement.provider}/${retirement.retiredId} in favor of ${retirement.keeperId}`;
}

/**
 Format the abstention tally so a reader can tell silence from an empty catalog.

 @param abstentions - tally produced by one rule pass

 @returns line naming every non-zero reason

 @example
 ```typescript
 formatAbstentions({ abstentions: { keeperAmbiguity: 0, unorderedPair: 2, loserNewerThanKeeper: 0, versionlessProtected: 1, duplicateIdentity: 0 } });
 // 'declined unorderedPair=2 versionlessProtected=1'
 ```
 */
export function formatAbstentions(
  {
    abstentions,
  }: {
    readonly abstentions: AbstentionCounts;
  },
): string {
  /**
   Reasons with a non-zero count, in a fixed order so logs stay comparable.
   */
  const parts: string[] = [];
  /**
   Reason names paired with their counts, ordered for stable output.
   */
  const reasons: readonly (keyof AbstentionCounts)[] = [
    'keeperAmbiguity',
    'unorderedPair',
    'loserNewerThanKeeper',
    'versionlessProtected',
    'duplicateIdentity',
  ];
  for (const reason of reasons) {
    /**
     Count for the current reason.
     */
    const count = abstentions[reason];
    if (count === 0)
      continue;
    parts.push(`${reason}=${String(count)}`,);
  }
  if (parts.length === 0)
    return 'declined nothing';
  return `declined ${parts.join(' ')}`;
}

/**
 Format the whole planning outcome as one summary line.

 @param planning - plans, retirements, and abstentions

 @returns line stating how many models were retired across how many providers

 @example
 ```typescript
 formatPlanningSummary({ planning }); // 'retired 6 models across 2 providers; declined nothing'
 ```
 */
export function formatPlanningSummary(
  {
    planning,
  }: {
    readonly planning: FilterPlanning;
  },
): string {
  /**
   Provider count phrase.
   */
  const providers = `across ${String(planning.plans.length)} providers`;
  return `retired ${String(planning.retirements.length)} models ${providers}; ${formatAbstentions({ abstentions: planning.abstentions, },)}`;
}

/**
 Format the warning for a session that started on a model this pass retired.

 @param retirement - retirement matching the session's live model

 @returns line naming the live model and the successor pi did not switch to

 @example
 ```typescript
 formatLiveModelWarning({ retirement });
 // 'session model hyper/glm-5.2 is retired in favor of glm-5.3; leaving the session on it'
 ```
 */
export function formatLiveModelWarning(
  {
    retirement,
  }: {
    readonly retirement: Retirement;
  },
): string {
  return `session model ${retirement.provider}/${retirement.retiredId} is retired in favor of ${retirement.keeperId}; leaving the session on it`;
}

//endregion Lines
