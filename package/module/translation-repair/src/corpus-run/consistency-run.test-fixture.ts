/**
 Runs the page-level consistency pass over the cat page with scripted judges,
 for the cases that read what the pass recorded, asked and showed.

 Fixtures are cat-themed invention; no corpus content appears here.

 @module
 */

import { tagged, } from '@monochromatic-dev/module-logger/ts';

import {
  type ArtifactConsistency,
  assertPipelineDigest,
  type PipelineDigest,
  type PreparedDocumentPair,
  type RosterModelId,
  runPassConsistency,
} from '../../dist/final/node/index.mjs';
import { HANG_STOP_MS, } from '../hang-stop.test-fixture.ts';
import { SCRIPTED_STAGE_SETTINGS, } from '../stage-settings.test-fixture.ts';
import {
  archiveEnglishOf,
  preparedCatPage,
  projectedCatPage,
  scriptedJudgeClient,
  type SeatScript,
} from './consistency-page.test-fixture.ts';

//region Consistency run fixture

/**
 Logger the pass writes to, whose lines are not under test.
 */
const l = tagged({ tag: 'pass-consistency-test', },);

/**
 Hex digits in the digest every case's cache is stamped with.
 */
const DIGEST_HEX_LENGTH = 64;

/**
 Digest the cache is stamped with, before it is checked for shape.
 */
const DIGEST_TEXT = `sha256-tree-v1:${'c'.repeat(DIGEST_HEX_LENGTH,)}`;
assertPipelineDigest(DIGEST_TEXT,);

/**
 Generation stamp the cache is opened under.
 */
export const DIGEST: PipelineDigest = DIGEST_TEXT;

/**
 What a run of the pass came to.
 */
export type CatRun = {
  /**
   The section the pass recorded.
   */
  readonly consistency: ArtifactConsistency;

  /**
   Seat of every structured call, in order.
   */
  readonly asked: readonly RosterModelId[];

  /**
   Every sheet a judge was shown, in order.
   */
  readonly sheets: readonly string[];
};

/**
 Runs the pass over the cat page with scripted judges.

 @param behave - what each seat does when asked

 @param entryCacheDir - directory the cache is opened in

 @param prepared - preparation of the page, the cat page by default

 @param english - what each slice ships, the archive by default

 @param signal - the entry's stop, a bound that outlasts the work by default

 @returns The section, the seats asked and the sheets shown

 @example
 ```ts
 const run = await runCatPass({ behave: firstPlaceWins, entryCacheDir, },);
 ```
 */
export async function runCatPass(
  {
    behave,
    entryCacheDir,
    prepared = preparedCatPage(),
    english = archiveEnglishOf({ prepared, },),
    signal = AbortSignal.timeout(HANG_STOP_MS,),
  }: {
    readonly behave: SeatScript;
    readonly entryCacheDir: string;
    readonly prepared?: PreparedDocumentPair;
    readonly english?: readonly string[];
    readonly signal?: AbortSignal;
  },
): Promise<CatRun> {
  /**
   Seat of every structured call.
   */
  const asked: RosterModelId[] = [];
  /**
   Sheet of every structured call.
   */
  const sheets: string[] = [];
  return {
    consistency: await runPassConsistency({
      client: scriptedJudgeClient({
        behave,
        asked,
        sheets,
      },),
      prepared,
      projected: projectedCatPage({
        prepared,
        english,
      },),
      contestSlices: [],
      consolidateSlices: [],
      archiveDisputes: new Map(),
      entryCacheDir,
      pipelineDigest: DIGEST,
      signal,
      overlap: 2,
      l,
      stageSettings: SCRIPTED_STAGE_SETTINGS,
    },),
    asked,
    sheets,
  };
}

//endregion Consistency run fixture
