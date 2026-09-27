import { declinedEntryIds, } from './declined-entries.ts';
import {
  artifactBackedIds,
  countSettled,
} from './pass-settled.ts';

//region Pass finished entries
// What a pass counts as done when it starts, and how many entries it reports
// processed when it ends. Moved out of `corpus-pass.ts` unchanged.

/**
 Entry ids carrying an artifact or a decline record.

 @param artifactsDir - directory of settled artifacts

 @param declinedDir - directory of decline records

 @returns Every finished entry id

 @example
 ```ts
 const done = await finishedEntryIds({ artifactsDir, declinedDir, },);
 ```
 */
export async function finishedEntryIds(
  {
    artifactsDir,
    declinedDir,
  }: {
    readonly artifactsDir: string;
    readonly declinedDir: string;
  },
): Promise<ReadonlySet<string>> {
  return new Set([
    ...(await artifactBackedIds({ artifactsDir, },)),
    ...(await declinedEntryIds({ declinedDir, },)),
  ],);
}

/**
 Entries a run processed, for its DONE line.

 @param before - finished ids when the run started

 @param artifactsDir - directory of settled artifacts

 @returns New artifacts written this run

 @example
 ```ts
 const processed = await entriesFinishedThisRun({ before: done, artifactsDir, },);
 ```
 */
export async function entriesFinishedThisRun(
  {
    before,
    artifactsDir,
  }: {
    readonly before: ReadonlySet<string>;
    readonly artifactsDir: string;
  },
): Promise<number> {
  return (await countSettled({ artifactsDir, },)) - before.size;
}

//endregion Pass finished entries
