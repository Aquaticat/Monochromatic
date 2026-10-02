/**
 Formatting for retirement decisions.

 One module owns the wording so the session log and the tests cannot drift apart,
 and so decision 9 in `doc/planning/pi-model-retirement.md` has a single place to
 change: the log is the only surface for the retirement table now that there is no
 audit task.

 @module
 */

import type {
  AbstentionCounts,
  Retirement,
} from './retirement-rule.ts';

//region Types

/**
 Counts one retirement pass produced.

 Deliberately free of pi's model objects: a formatter that received the plans would
 carry foreign mutable metadata it never reads.
 */
export type PlanningCounts = {
  /**
   How many providers the pass re-registers.
   */
  readonly planCount: number;
  /**
   How many models the pass retires.
   */
  readonly retirementCount: number;
  /**
   Declined retirements grouped by reason.
   */
  readonly abstentions: AbstentionCounts;
};

//endregion Types

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
 Format a count with an English plural noun.

 @param count - how many items the line names

 @param noun - singular noun to pluralize

 @returns count and noun agreeing in number

 @example
 ```typescript
 pluralize({ count: 1, noun: 'model' }); // '1 model'
 ```
 */
function pluralize(
  {
    count,
    noun,
  }: {
    readonly count: number;
    readonly noun: string;
  },
): string {
  return `${String(count)} ${noun}${count === 1 ? '' : 's'}`;
}

/**
 Format the whole planning outcome as one summary line.

 @param counts - retirement and provider counts plus the abstention tally

 @returns line stating how many models were retired across how many providers

 @example
 ```typescript
 formatPlanningSummary({ counts }); // 'retired 6 models across 2 providers; declined nothing'
 ```
 */
export function formatPlanningSummary(
  {
    counts,
  }: {
    readonly counts: PlanningCounts;
  },
): string {
  /**
   Provider count phrase.
   */
  const providers = pluralize({
    count: counts.planCount,
    noun: 'provider',
  },);
  /**
   Retirement count phrase.
   */
  const models = pluralize({
    count: counts.retirementCount,
    noun: 'model',
  },);
  return `retired ${models} across ${providers}; ${formatAbstentions({
    abstentions: counts.abstentions,
  },)}`;
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

/**
 Format the warning for a provider whose models cannot be re-declared.

 @param skipped - provider the planner refused to build a plan for, and why

 @returns line naming the provider, the missing field, and the consequence

 @example
 ```typescript
 formatSkippedProvider({ skipped: { provider: 'azure-openai-responses', reason: 'model gpt-4.1 carries no baseUrl' } });
 ```
 */
export function formatSkippedProvider(
  {
    skipped,
  }: {
    readonly skipped: {
      readonly provider: string;
      readonly reason: string;
    };
  },
): string {
  return `skipped ${skipped.provider}: ${skipped.reason}, so pi cannot re-declare its models and its retired entries stay listed`;
}

/**
 Format the warning for a provider pi refused to re-register.

 @param failed - provider whose registration threw, and the caught text

 @returns line naming the provider, the failure, and the consequence for this session

 @example
 ```typescript
 formatFailedProvider({ failed: { provider: 'azure-openai-responses', reason: '"baseUrl" is required' } });
 ```
 */
export function formatFailedProvider(
  {
    failed,
  }: {
    readonly failed: {
      readonly provider: string;
      readonly reason: string;
    };
  },
): string {
  return `pi refused to re-register ${failed.provider}: ${failed.reason}; its retired entries stay listed for this session`;
}

/**
 Format the warning for a catalog refresh that failed.

 Filtering continues on the unrefreshed catalog, so this line is the reader's only
 evidence that `models.json` overrides may be missing from the metadata written back.

 @param reason - text of the caught failure

 @returns line naming the failure and what the pass did anyway

 @example
 ```typescript
 formatRefreshFailure({ reason: 'ENOENT' });
 ```
 */
export function formatRefreshFailure(
  {
    reason,
  }: {
    readonly reason: string;
  },
): string {
  return `catalog refresh failed, filtering the unrefreshed catalog instead: ${reason}`;
}

//endregion Lines
