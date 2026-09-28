import type { Logger, } from '@monochromatic-dev/module-logger/ts';

import { citedReferenceBlock, } from '../cited-reference-lookup.ts';
import {
  type CorpusName,
  readCorpusNames,
} from '../corpus-name-index.ts';
import { lookupCacheDir, } from '../lookup-cache.ts';
import { referenceCacheDir, } from '../reference-cache.ts';
import { workTitleLookupLines, } from '../work-title-lookup.ts';
import { EXA_API_KEY_VAR, } from '../work-title-search.ts';
import { RUN_CORPUS_PIN, } from './run-config.ts';

//region Pass outside reads
// WHAT A PREPARATION READS FROM OUTSIDE THE PIPELINE, named in one place and
// required of every caller (ledger X19). The run's readers take their keys
// and cache directories from the environment `mise` builds, and the unit
// suite runs under that same environment, decrypted keys included. On
// 2026-09-28 a unit test for the page title lexicon (ledger H16) prepared an
// original naming an invented title; the preparation's own lookup read the
// Exa key the suite had inherited, bought a web search for the invented
// title, and wrote the result into the real lookup cache. A seam a caller may
// leave out is a seam a test forgets; a required one is a type error until
// the caller chooses.

/**
 Reads what the pages an original links say, empty when it links nowhere or
 nothing could be read.

 @example
 ```ts
 const references: PassReferenceReader = async () => '';
 ```
 */
export type PassReferenceReader = (
  input: {
    readonly sourceText: string;
    readonly signal: AbortSignal;
    readonly l: Logger;
  },
) => Promise<string>;

/**
 Reads the evidence lines for the works an original names, none when it
 names no work or nothing could be read.

 @example
 ```ts
 const workTitles: PassWorkTitleReader = async () => [];
 ```
 */
export type PassWorkTitleReader = (
  input: {
    readonly sourceText: string;
    readonly signal: AbortSignal;
    readonly l: Logger;
  },
) => Promise<readonly string[]>;

/**
 Reads the names every corpus entry declares.

 @example
 ```ts
 const corpusNames: PassCorpusNameReader = async () => [];
 ```
 */
export type PassCorpusNameReader = () => Promise<readonly CorpusName[]>;

/**
 Everything a preparation reads from outside the pipeline.

 @example
 ```ts
 const reads: PassOutsideReads = RUN_OUTSIDE_READS;
 ```
 */
export type PassOutsideReads = {
  /**
   Evidence for the works the original names (the owner's rule of
   2026-09-02).
   */
  readonly workTitles: PassWorkTitleReader;

  /**
   What the pages the original links say (class thirty-five, the owner's
   decision of 2026-09-16).
   */
  readonly references: PassReferenceReader;

  /**
   Names other entries declare (class seventy-eight).
   */
  readonly corpusNames: PassCorpusNameReader;
};

/**
 The clock a lookup record is stamped with.

 @returns Now

 @example
 ```ts
 const stamped = wallClock().toISOString();
 ```
 */
function wallClock(): Date {
  return new Date();
}

/**
 The run's work-title reader: each title searched once over the web and
 cached durably.

 @param sourceText - original, whose marked titles are looked up

 @param signal - entry deadline and caller abort

 @param l - entry logger

 @returns Evidence lines, none when the original names no work or no key is set

 @example
 ```ts
 const lines = await lookupRunWorkTitles({ sourceText, signal, l, },);
 ```
 */
function lookupRunWorkTitles(
  {
    sourceText,
    signal,
    l,
  }: {
    readonly sourceText: string;
    readonly signal: AbortSignal;
    readonly l: Logger;
  },
): Promise<readonly string[]> {
  return workTitleLookupLines({
    sourceText,
    apiKey: process.env[EXA_API_KEY_VAR] ?? '',
    dir: lookupCacheDir({ env: process.env, },),
    signal,
    fetchFn: fetch,
    now: wallClock,
    logger: l,
  },);
}

/**
 The run's reference reader: each page bought once over the web and cached
 durably.

 @param sourceText - original, whose links are read

 @param signal - entry deadline and caller abort

 @param l - entry logger

 @returns What the linked pages say, empty when there are none or no key to read them with

 @example
 ```ts
 const referenceLines = await readRunReferences({ sourceText, signal, l, },);
 ```
 */
function readRunReferences(
  {
    sourceText,
    signal,
    l,
  }: {
    readonly sourceText: string;
    readonly signal: AbortSignal;
    readonly l: Logger;
  },
): Promise<string> {
  return citedReferenceBlock({
    sourceText,
    apiKey: process.env[EXA_API_KEY_VAR] ?? '',
    dir: referenceCacheDir({ env: process.env, },),
    signal,
    fetchFn: fetch,
    now: wallClock,
    logger: l,
  },);
}

/**
 The run's corpus-name reader: every entry's front matter at the run's pin.

 @returns Names every entry declares

 @example
 ```ts
 const names = await readRunCorpusNames();
 ```
 */
function readRunCorpusNames(): Promise<readonly CorpusName[]> {
  return readCorpusNames({ pin: RUN_CORPUS_PIN, },);
}

/**
 The run's outside reads: the web, through the environment's key and
 caches, and the pinned corpus.
 */
export const RUN_OUTSIDE_READS: PassOutsideReads = {
  workTitles: lookupRunWorkTitles,
  references: readRunReferences,
  corpusNames: readRunCorpusNames,
};

//endregion Pass outside reads
