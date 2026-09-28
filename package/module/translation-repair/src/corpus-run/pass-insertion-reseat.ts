import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';

import type { PreparedDocumentPair, } from '../document-preparation.ts';
import type { InsertionAdmission, } from '../insertion-admission.ts';
import type { RosterModelId, } from '../synthetic-catalog.ts';
import type { CoverageSeating, } from './insertion-admission-seating.ts';
import { decidePassInsertionAdmission, } from './pass-insertion-admission.ts';
import type { RunClient, } from './run-client-contract.ts';
import { RUN_PER_CALL_TIMEOUT_MS, } from './run-config.ts';
import type { SeatReadingClient, } from './run-seats-read.ts';

//region Insertion admission re-seating
// THE INSERTION ADMISSION'S PER-CANDIDATE HOOK (ledger X12), beside the other
// phases' hooks, so a test can drive it with the reading rig they are tested
// with.

/**
 Hook the insertion admission calls before each candidate's coverage question.

 @example
 ```ts
 const hooks: InsertionHooks = insertionHooksFor({ client, signal, l, },);
 ```
 */
export type InsertionHooks = {
  readonly beforeCandidate: () => Promise<CoverageSeating>;
};

/**
 Seating that keeps the roster the admission started on.

 @returns No roster, so the given one stands

 @example
 ```ts
 const seating = await keepRoster();
 ```
 */
function keepRoster(): Promise<CoverageSeating> {
  return Promise.resolve({},);
}

/**
 Builds the insertion admission's per-candidate hook.

 @param _ - run client, entry abort and entry logger the re-seating will read

 @returns Per-candidate reader, handing each candidate the roster it is asked of

 @example
 ```ts
 const hooks = insertionHooksFor({ client, signal, l, },);
 ```
 */
export function insertionHooksFor(
  _: {
    readonly client: SeatReadingClient;
    readonly signal: AbortSignal;
    readonly l: Logger;
  },
): InsertionHooks {
  return { beforeCandidate: keepRoster, };
}

/**
 Runs the insertion admission for one entry with its per-candidate hook
 wired, the seam `runPassEntry` calls (ledger X12 and X14: split out so a
 test can drive the wiring, as it drives the contest's and the
 consolidation's).

 @param client - run client whose dryness view and holds the hook reads

 @param prepared - the entry's preparation carrying its insertion slices

 @param modelIds - roster the lanes' reading seated, which each candidate is
 asked of until a hold re-seats it

 @param overlap - most coverage questions in flight

 @param signal - entry deadline and caller abort

 @param entryId - entry the log lines are tagged with

 @returns Admitted positions and count-only evidence for every candidate

 @example
 ```ts
 const admission = await admitPassInsertions({ client, prepared, modelIds, overlap, signal, entryId, },);
 ```
 */
export async function admitPassInsertions(
  {
    client,
    prepared,
    modelIds,
    overlap,
    signal,
    entryId,
  }: {
    readonly client: RunClient;
    readonly prepared: PreparedDocumentPair;
    readonly modelIds: readonly RosterModelId[];
    readonly overlap: number;
    readonly signal: AbortSignal;
    readonly entryId: string;
  },
): Promise<InsertionAdmission> {
  /**
   Entry logger the admission and its hook write to.
   */
  const l = tagged({ tag: entryId, },);
  return await decidePassInsertionAdmission({
    client,
    prepared,
    modelIds,
    overlap,
    signal,
    perCallTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
    l,
    // EVERY CANDIDATE RE-SEATS UNDER A HOLD (ledger X12).
    beforeCandidate: insertionHooksFor({
      client,
      signal,
      l,
    },)
      .beforeCandidate,
  },);
}

//endregion Insertion admission re-seating
