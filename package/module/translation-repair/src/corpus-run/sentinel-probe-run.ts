import type { SyntheticClient, } from '../chat-contract.ts';
import {
  type CorpusPin,
  listCorpusPeople,
  readCorpusFile,
} from '../corpus-source.ts';
import type { RepairModels, } from '../repair-contract.ts';
import { askedAmong, } from './command-flags.ts';
import type { CommandLineOf, } from './command-lines.ts';
import {
  probeErrorLine,
  type ProbedResult,
  probeResultLine,
} from './sentinel-probe-line.ts';

//region Sentinel probe run
// Probes each corpus entry asked for through the pipeline, printing a PROBE
// line per entry. Used before an improve-and-restart step to confirm a change
// moved the known cases the way it should; expected statuses live in
// doc/handover/translation-repair-history.md, not hardcoded here, so this
// runner never drifts against the recorded ledger.

/**
 Sentinel set probed when no ids are named on the command line.
 */
const DEFAULT_SENTINELS: readonly string[] = [
  'Anilovr',
  'Aniloviraw',
];

/**
 Probes each corpus entry asked for through the pipeline, printing a PROBE
 line per entry, in the order the corpus lists them. With no ids named on the
 command line, probes {@link DEFAULT_SENTINELS}.

 @param line - the probe's command line, read whole by `reportingRefusals`

 @param pin - corpus clone and commit every read resolves against

 @param newClient - builds the one client every entry shares, called once
 after the ids are checked, so a run naming an id the corpus lacks is refused
 before any key is asked for

 @param repair - the repair pipeline over one entry's two texts

 @param models - roster the repair asks

 @param perCallTimeoutMs - deadline per exchange

 @param now - monotonic clock in milliseconds, read for each entry's duration

 @throws {@link Error} when the API key env var is unset, from `newClient`

 @throws StatedRefusalError when an id to probe, named or default, is no
 entry in the corpus at the pin, before anything is spent

 @example
 ```ts
 await probeCorpusEntries({ line, pin, newClient, repair, models, perCallTimeoutMs, now, },);
 ```
 */
export async function probeCorpusEntries(
  {
    line,
    pin,
    newClient,
    repair,
    models,
    perCallTimeoutMs,
    now,
  }: {
    readonly line: CommandLineOf<'sentinel-probe'>;
    readonly pin: CorpusPin;
    readonly newClient: () => SyntheticClient;
    readonly repair: (input: {
      readonly client: SyntheticClient;
      readonly sourceText: string;
      readonly targetText: string;
      readonly models: RepairModels;
      readonly signal: AbortSignal;
      readonly perCallTimeoutMs: number;
    },) => Promise<ProbedResult>;
    readonly models: RepairModels;
    readonly perCallTimeoutMs: number;
    readonly now: () => number;
  },
): Promise<void> {
  /**
   Ids named on the command line. A flag is refused before this runs, where it
   was once dropped and the argument after it probed as an entry (ledger B75).
   */
  const named = line.positionals;

  /**
   Entries to probe: named ids, else the default sentinels, each held to the
   corpus at the pin before anything is spent. An id it lacks once printed an
   error line of its own while the probe spent on the rest (ledger B76).
   */
  const targets = askedAmong({
    asked: (named.length > 0) ? named : DEFAULT_SENTINELS,
    known: await listCorpusPeople({ pin, },),
    source: 'sentinel-probe',
    within: 'the corpus at the pin',
  },);

  /**
   Shared client using measured production provider concurrency.
   */
  const client = newClient();

  console.log(`PROBE start corpus=${pin.commitSha} targets=${targets.join(',',)}`,);

  for (const id of targets) {
    /**
     Start time of this probe, for its duration.
     */
    const t0 = now();
    try {
      /* oxlint-disable no-await-in-loop -- diagnostic entries remain sequential so each log and failure belongs to one named sentinel; provider capacity is not the reason */
      /**
       Original zh page text for this entry.
       */
      const sourceText = await readCorpusFile({
        pin,
        relPath: `people/${id}/page.md`,
      },);
      /* oxlint-enable no-await-in-loop */

      /* oxlint-disable no-await-in-loop -- pairs with the read of its source page */
      /**
       Translated en page text for this entry.
       */
      const targetText = await readCorpusFile({
        pin,
        relPath: `people/${id}/page.en.md`,
      },);
      /* oxlint-enable no-await-in-loop */

      /**
       Fresh abort controller per entry; the probe imposes no deadline of its own.
       */
      const controller = new AbortController();

      /* oxlint-disable no-await-in-loop -- sequential by design, for the reason the source read gives */
      /**
       Repair result for this probed entry.
       */
      const result = await repair({
        client,
        sourceText,
        targetText,
        models,
        signal: controller.signal,
        perCallTimeoutMs,
      },);
      /* oxlint-enable no-await-in-loop */
      console.log(probeResultLine({
        id,
        result,
        elapsedMs: now() - t0,
      },),);
    }
    catch (error) {
      console.log(probeErrorLine({
        id,
        error,
        elapsedMs: now() - t0,
      },),);
    }
  }

  console.log('PROBE done',);
}

//endregion Sentinel probe run
