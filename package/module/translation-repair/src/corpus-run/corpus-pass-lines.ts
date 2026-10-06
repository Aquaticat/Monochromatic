import { textsInCodePointOrder, } from '../code-points.ts';
import { wordForCount, } from '../count-word.ts';
import {
  HARD_CAP_VAR,
  capOutlastsOneCall,
  capTooTightNote,
} from './cap-override.ts';
import {
  type CorpusPinSetting,
  corpusPinOverrideNote,
} from './corpus-pin-override.ts';
import { PASS_MS_PER_MINUTE, } from './corpus-pass-limits.ts';
import type { IncompleteEntry, } from './pass-eligibility.ts';
import { spendCeilingOverrideNote, } from './spend-ceiling.ts';

//region Corpus pass lines
// The lines a corpus pass prints, each built from what the procedure already
// knows and returned rather than written, so a case reads the whole text of
// each without a run. Split out of the procedure that prints them.

/**
 Lines saying which entries a pass was restricted to.

 @param onlyIds - entry ids the command line named, empty when it named none

 @returns The one line, or none when the pass was not restricted

 @example
 ```ts
 const lines = passOnlyLines({ onlyIds: new Set(['tabby',],), },);
 ```
 */
export function passOnlyLines({ onlyIds, }: { readonly onlyIds: ReadonlySet<string>; },): readonly string[] {
  if (onlyIds.size === 0)
    return [];

  /**
   Chosen ids in a stable order, so two runs of one selection log alike.
   */
  const chosen = textsInCodePointOrder({ texts: [...onlyIds,], },)
    .join(',',);

  return [
    [
      `ONLY ${chosen} (ordering is bypassed; run `,
      'this into a throwaway TRANSLATION_REPAIR_RUNS_DIR so a hand-picked ',
      'entry never enters a pool later draws treat as natural accumulation)',
    ].join('',),
  ];
}

/**
 Line saying that one entry has a page absent at the pin.

 @param gap - entry, the side that was absent and what the read said

 @returns The line

 @example
 ```ts
 const line = passIncompleteLine({ gap: { id: 'mittens', side: 'target', detail: 'missing-object', }, },);
 ```
 */
export function passIncompleteLine({ gap, }: { readonly gap: IncompleteEntry; },): string {
  return `INCOMPLETE ${gap.id}: ${gap.side} page absent at the pin (${gap.detail})`;
}

/**
 What the START line reports.

 @example
 ```ts
 const facts: PassStartFacts = { tip, pipelineDigest, fileCount: 189, pending: 2, done: 0, softBudgetMs: 259_200_000, hardCapMs: 25_200_000, };
 ```
 */
export type PassStartFacts = {
  /**
   Pipeline tip recorded into every artifact.
   */
  readonly tip: string;

  /**
   Identity of the built pipeline this invocation runs.
   */
  readonly pipelineDigest: string;

  /**
   Files the digest covers.
   */
  readonly fileCount: number;

  /**
   Entries the pass would run.
   */
  readonly pending: number;

  /**
   Entries already finished before this pass.
   */
  readonly done: number;

  /**
   Time after which no new entry starts.
   */
  readonly softBudgetMs: number;

  /**
   Ceiling one entry runs under.
   */
  readonly hardCapMs: number;
};

/**
 The line that opens a pass's report.

 @param facts - what the line reports

 @returns The line

 @example
 ```ts
 const line = passStartLine({ facts, },);
 ```
 */
export function passStartLine({ facts, }: { readonly facts: PassStartFacts; },): string {
  return `START tip=${facts.tip} pipeline=${facts.pipelineDigest} files=${String(facts.fileCount,)} pending=${
    String(facts.pending,)
  } done=${String(facts.done,)} soft=${String(facts.softBudgetMs,)}ms hard=${String(facts.hardCapMs,)}ms`;
}

/**
 Lines naming every limit a launch changed or set too tight, in the order a
 pass prints them: a run must never hide which ceiling, window or corpus it
 ran under, since an artifact settled under one is not comparable with one
 settled under another.

 @param hardCapMs - ceiling one entry runs under, after any override

 @param builtInCapMinutes - ceiling the build ships, in minutes

 @param perCallMs - deadline one model exchange is allowed

 @param spendCeilingUsd - spend allowance, after any override

 @param graceNote - note naming the straggler window, empty for the built-in one

 @param writerNote - note naming the writer rounds' window, empty for the built-in one

 @param pinSetting - corpus pin beside where each half came from

 @returns The lines to print, none empty

 @example
 ```ts
 const lines = passLaunchLines({ hardCapMs, builtInCapMinutes: 420, perCallMs, spendCeilingUsd, graceNote, writerNote, pinSetting, },);
 ```
 */
export function passLaunchLines(
  {
    hardCapMs,
    builtInCapMinutes,
    perCallMs,
    spendCeilingUsd,
    graceNote,
    writerNote,
    pinSetting,
  }: {
    readonly hardCapMs: number;
    readonly builtInCapMinutes: number;
    readonly perCallMs: number;
    readonly spendCeilingUsd: number;
    readonly graceNote: string;
    readonly writerNote: string;
    readonly pinSetting: CorpusPinSetting;
  },
): readonly string[] {
  /**
   Ceiling in minutes, as a launch wrote it.
   */
  const capMinutes = hardCapMs / PASS_MS_PER_MINUTE;

  /**
   Cap line, empty for the built-in ceiling.
   */
  const capLine = (hardCapMs === (builtInCapMinutes * PASS_MS_PER_MINUTE))
    ? ''
    : `CAP OVERRIDDEN by ${HARD_CAP_VAR}: entries run under ${String(capMinutes,)} ${
      wordForCount({
        count: capMinutes,
        one: 'minute',
        many: 'minutes',
      },)
    } rather than the built-in ${String(builtInCapMinutes,)}`;

  /**
   Line saying the ceiling cannot outlast one exchange, empty when it can.
   */
  const tightLine = capOutlastsOneCall({
    capMs: hardCapMs,
    perCallMs,
  },)
    ? ''
    : capTooTightNote({
      capMs: hardCapMs,
      perCallMs,
    },);

  return [
    capLine,
    spendCeilingOverrideNote({ ceilingUsd: spendCeilingUsd, },),
    graceNote,
    writerNote,
    corpusPinOverrideNote({ setting: pinSetting, },),
    tightLine,
  ].filter(function isSaid(line,): boolean {
    return line !== '';
  },);
}

/**
 Lines saying which providers the launch required and found ready.

 @param providers - providers the command line required, none when it required none

 @returns The one line, or none when none was required

 @example
 ```ts
 const lines = passRequiredLines({ providers: ['hyper',], },);
 ```
 */
export function passRequiredLines({ providers, }: { readonly providers: readonly string[]; },): readonly string[] {
  if (providers.length === 0)
    return [];
  return [`REQUIRED-PROVIDERS ${providers.join(',',)} status=wet`,];
}

/**
 The line a `--plan` run ends on.

 @param tip - pipeline tip recorded into every artifact

 @param pipelineDigest - identity of the built pipeline

 @param pendingIds - ids of the entries the pass would run, in run order

 @param previewCount - how many of them the line names

 @returns The line

 @example
 ```ts
 const line = passPlanLine({ tip, pipelineDigest, pendingIds: ['tabby',], previewCount: 5, },);
 ```
 */
export function passPlanLine(
  {
    tip,
    pipelineDigest,
    pendingIds,
    previewCount,
  }: {
    readonly tip: string;
    readonly pipelineDigest: string;
    readonly pendingIds: readonly string[];
    readonly previewCount: number;
  },
): string {
  /**
   Ids the line names, the first few of the run order.
   */
  const previewed = pendingIds.slice(
    0,
    previewCount,
  );
  return `PLAN ok tip=${tip} pipeline=${pipelineDigest} client=constructed pending=${
    String(pendingIds.length,)
  } first=${previewed.join(',',)}`;
}

/**
 The line that closes a pass's report.

 @param processed - entries this pass finished

 @param pending - entries it set out to run

 @param total - artifacts present after the pass

 @param target - artifacts the whole corpus would hold

 @param elapsedMs - time the processing loop took

 @returns The line

 @example
 ```ts
 const line = passDoneLine({ processed: 1, pending: 2, total: 40, target: 92, elapsedMs: 5, },);
 ```
 */
export function passDoneLine(
  {
    processed,
    pending,
    total,
    target,
    elapsedMs,
  }: {
    readonly processed: number;
    readonly pending: number;
    readonly total: number;
    readonly target: number;
    readonly elapsedMs: number;
  },
): string {
  return `DONE processed=${String(processed,)} of pending=${String(pending,)}; artifacts=${String(total,)}/${
    String(target,)
  } elapsed=${String(elapsedMs,)}ms`;
}

//endregion Corpus pass lines
