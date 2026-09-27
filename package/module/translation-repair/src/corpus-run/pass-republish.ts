import { contextRoot, } from '../log-context.ts';
import { readCorpusFile, } from '../corpus-source.ts';
import {
  type CorpusPairReader,
  republishSettledPages,
} from './page-republish.ts';
import { settledEntryIds, } from './published-tree-listing.ts';
import { RUN_CORPUS_PIN, } from './run-config.ts';

//region Pass republish
// The pass's side of ledger A16c: before any entry runs, every page the
// artifacts in this runs directory say should ship differently, or that is
// missing, is rewritten from its artifact (`page-republish.ts`). Split out of
// `corpus-pass.ts`, which keeps to its line budget.

/**
 Logger the republish lines go through.
 */
const republishLog = contextRoot({ tag: 'republish', },);

/**
 Reads an entry's pair from the run's corpus clone at the commit its artifact
 was settled at, which the run pin need not share.

 @param entryId - entry whose pair to read

 @param corpusSha - commit its artifact was settled at

 @returns The original and the archive's English at that commit

 @example
 ```ts
 const pair = await readPinnedPair({ entryId: 'tabby', corpusSha, },);
 ```
 */
async function readPinnedPair(
  {
    entryId,
    corpusSha,
  }: Parameters<CorpusPairReader>[0],
): ReturnType<CorpusPairReader> {
  /**
   The clone the run reads, at the artifact's own commit.
   */
  const pin = {
    cloneDir: RUN_CORPUS_PIN.cloneDir,
    commitSha: corpusSha,
  };
  /**
   The original and the archive's English at that commit.
   */
  const [
    sourceText,
    targetText,
  ] = await Promise.all([
    readCorpusFile({
      pin,
      relPath: `people/${entryId}/page.md`,
    },),
    readCorpusFile({
      pin,
      relPath: `people/${entryId}/page.en.md`,
    },),
  ],);
  return {
    sourceText,
    targetText,
  };
}

/**
 Rewrites from its artifact every page in a runs directory that is missing or
 disagrees with what the artifact ships, before the pass settles anything.

 Never stops the pass: an artifacts directory it cannot list is logged and
 the pass goes on, as does every page it cannot rewrite.

 @param runsDir - run directory holding the artifacts

 @param artifactsDir - settled artifact root

 @param publishDir - root of the mirrored tree

 @example
 ```ts
 await republishRunPages({ runsDir, artifactsDir, publishDir, },);
 ```
 */
export async function republishRunPages(
  {
    runsDir,
    artifactsDir,
    publishDir,
  }: {
    readonly runsDir: string;
    readonly artifactsDir: string;
    readonly publishDir: string;
  },
): Promise<void> {
  /**
   Entries this directory settled.
   */
  const settled = await settledEntryIds({ runsDir, },);
  if (settled.kind === 'unreadable') {
    republishLog.warn(`republish: artifacts unreadable (${settled.reason}); no page judged`,);
    return;
  }
  await republishSettledPages({
    entryIds: settled.names,
    artifactsDir,
    publishDir,
    readPair: readPinnedPair,
    l: republishLog,
  },);
}

//endregion Pass republish
