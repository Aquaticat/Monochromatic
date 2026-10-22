//region Stage silence
// THE ONE SPELLING of the finding a stage leaves when it heard nobody, and the
// question every cache asks before it keeps or resumes a settlement.
//
// The quorum gather never throws on shortfall; it returns
// `stage-quorum-unmet (...)` as a finding, and every silent stage downstream
// lands on an ordinary "unchanged" exit with `heardCritics > 0`, so a slice
// settled during a provider outage was persisted and memoised as "examined and
// found nothing to change", then resumed by every later run. The finding
// travelled with the record; nothing read it. The producer builds the finding
// here and the consumers read it here, so the two cannot drift apart.

/**
 Opening every quorum-unmet finding carries, followed by the shortfall.

 @example
 ```ts
 const silent = finding.startsWith(STAGE_QUORUM_UNMET_PREFIX,);
 ```
 */
export const STAGE_QUORUM_UNMET_PREFIX = 'stage-quorum-unmet (';

/**
 Spells how many voices a stage heard against how many it asked, and where it ran when it ran once for each of several
 places: the label of a silent stage, in the finding that says so and in the data a settlement carries.

 @param stage - stage that fell short, such as `critic` or `panel`

 @param heard - voices heard

 @param asked - voices asked

 @param where - place the stage ran in when it runs once for each of several, such as a panel packet's cluster

 @returns The label, such as `critic 2/6` or `panel 0/6 (cluster/abc)`

 @example
 ```ts
 const label = silentStageLabel({ stage: 'panel', heard: 0, asked: 6, where: 'cluster/abc', },);
 ```
 */
export function silentStageLabel(
  {
    stage,
    heard,
    asked,
    where,
  }: {
    readonly stage: string;
    readonly heard: number;
    readonly asked: number;
    readonly where?: string;
  },
): string {
  /**
   Heard against asked, which every label opens with.
   */
  const shortfall = `${stage} ${String(heard,)}/${String(asked,)}`;
  return (where === undefined) ? shortfall : `${shortfall} (${where})`;
}

/**
 Builds the finding a stage records when fewer voices than quorum answered.

 @param shortfall - stage and count, such as `critic 2/6`

 @returns Finding text in the one spelling the caches read

 @example
 ```ts
 findings.push(stageQuorumUnmetFinding({ shortfall: 'critic 2/6', },),);
 ```
 */
export function stageQuorumUnmetFinding(
  { shortfall, }: { readonly shortfall: string; },
): string {
  return `${STAGE_QUORUM_UNMET_PREFIX}${shortfall})`;
}

/**
 Findings among the given ones that say a stage heard fewer than quorum.

 @param findings - findings a settlement carries

 @returns The quorum-unmet findings, in order, empty when every stage was heard

 @example
 ```ts
 const silent = silentStagesOf({ findings: outcome.findings, },);
 ```
 */
export function silentStagesOf(
  { findings, }: { readonly findings: readonly string[]; },
): readonly string[] {
  return findings.filter(function saysQuorumUnmet(finding,): boolean {
    return finding.startsWith(STAGE_QUORUM_UNMET_PREFIX,);
  },);
}

/**
 Silent stages a settlement record names: the ones it carries as data, then the ones that left a finding no layer
 relocated.

 THE DATA COMES FIRST AND IS THE FACT. A stage that runs once for each of several places (the panel, once per cluster)
 locates its findings with the place, so `stage-quorum-unmet (` is no longer where the finding begins and
 {@link silentStagesOf} cannot see it: XingZ6018 slice 85 was cached with a panel that heard nobody, for that reason.
 Such a stage gives its shortfall as a label in `silentStages` as well.

 @param record - the settlement's findings and the silent stages it carries as data

 @returns The labels of the data, then the findings that read as quorum-unmet, empty when every stage was heard

 @example
 ```ts
 const silent = silentStagesOfRecord({ record: outcome, },);
 ```
 */
export function silentStagesOfRecord(
  { record, }: {
    readonly record: {
      readonly findings: readonly string[];
      readonly silentStages: readonly string[];
    };
  },
): readonly string[] {
  return [
    ...record.silentStages,
    ...silentStagesOf({ findings: record.findings, },),
  ];
}

/**
 Whether a settlement was reached with every stage at or above quorum, which
 is what a cache may keep and a resumed run may trust.

 A stage that lost some voices but kept quorum still counts as heard; the
 `stage-voice-lost` findings it leaves are a different number and are not
 read here.

 @param findings - findings a settlement carries

 @returns Whether no stage fell short of quorum

 @example
 ```ts
 if (everyStageHeard({ findings: outcome.findings, },)) await cache.persist(...);
 ```
 */
export function everyStageHeard(
  { findings, }: { readonly findings: readonly string[]; },
): boolean {
  /**
   Findings that say a stage fell short.
   */
  const silent = silentStagesOf({ findings, },);
  return silent.length === 0;
}

//endregion Stage silence
