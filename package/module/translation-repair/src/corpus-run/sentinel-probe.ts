import { readCorpusFile, } from '../corpus-source.ts';
import { repairTranslation, } from '../repair-translation.ts';
import {
  createRunClient,
  RUN_CORPUS_PIN,
  RUN_MODELS,
  RUN_PER_CALL_TIMEOUT_MS,
} from './run-config.ts';

//region Sentinel probe
// Runs a set of named, known-behavior corpus entries through the pipeline and
// prints one PROBE line each (status, issue counts, findings). Used before an
// improve-and-restart step to confirm a change moved the known cases the way it
// should; expected statuses live in doc/handover/translation-repair.md, not
// hardcoded here, so this runner never drifts against the recorded ledger. Run
// it with `mise run //package/module/translation-repair:sentinel-probe -- Anilovr Aniloviraw`.

/**
 * Sentinel set probed when no ids are named on argv.
 */
const DEFAULT_SENTINELS: readonly string[] = [
  'Anilovr',
  'Aniloviraw',
];

/**
 * Characters of an error message kept in a PROBE line.
 */
const ERROR_MESSAGE_CAP = 200;

/**
 * Probes each named corpus entry through the pipeline, printing a PROBE line
 * per entry. With no argv ids, probes {@link DEFAULT_SENTINELS}.
 *
 * @throws {@link Error} when the API key env var is unset
 *
 * @example
 * ```ts
 * await probeCorpusEntries();
 * ```
 */
async function probeCorpusEntries(): Promise<void> {
  /**
   * Ids from argv, dropping flags.
   */
  const named = process.argv
    .slice(2,)
    .filter(function notFlag(arg,) {
      return !arg.startsWith('--',);
    },);

  /**
   * Entries to probe: named ids, else the default sentinels.
   */
  const targets = named.length > 0 ? named : DEFAULT_SENTINELS;

  /**
   * Shared client; per-model concurrency defaults to one.
   */
  const client = createRunClient();

  console.log(`PROBE start corpus=${RUN_CORPUS_PIN.commitSha} targets=${targets.join(',',)}`,);

  for (const id of targets) {
    /**
     * Start time of this probe, for its duration.
     */
    const t0 = Date.now();
    try {
      /**
       * Original zh page text for this entry.
       */
      /* oxlint-disable-next-line no-await-in-loop -- probe entries run sequentially so their logs stay legible and per-model streams do not contend */
      const sourceText = await readCorpusFile({
        pin: RUN_CORPUS_PIN,
        relPath: `people/${id}/page.md`,
      },);

      /**
       * Translated en page text for this entry.
       */
      /* oxlint-disable-next-line no-await-in-loop -- pairs with its source read above */
      const targetText = await readCorpusFile({
        pin: RUN_CORPUS_PIN,
        relPath: `people/${id}/page.en.md`,
      },);

      /**
       * Fresh abort controller per entry; the probe imposes no deadline of its own.
       */
      const controller = new AbortController();

      /**
       * Repair result for this probed entry.
       */
      /* oxlint-disable-next-line no-await-in-loop -- sequential by design, see above */
      const result = await repairTranslation({
        client,
        sourceText,
        targetText,
        models: RUN_MODELS,
        signal: controller.signal,
        perCallTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
      },);

      /**
       * Accepted issues among all adjudicated.
       */
      const accepted = result.issues
        .filter(function isAccepted(record,) {
        return record.issue
          .status
          === 'accepted';
      },);
      console.log(
        `PROBE ${id} status=${result.status} issues=${String(result.issues
          .length,)} accepted=${String(accepted.length,)} findings=${String(result.findings
            .length,)} ms=${String(Date.now() - t0,)}`,
      );
    }
    catch (error) {
      /**
       * Trimmed failure text for the PROBE line.
       */
      const message = Error.isError(error,)
        ? error.message
          .slice(
          0,
          ERROR_MESSAGE_CAP,
        )
        : String(error,);
      console.log(`PROBE ${id} status=ERROR ms=${String(Date.now() - t0,)} error=${message}`,);
    }
  }

  console.log('PROBE done',);
}

if (import.meta.main)
  await probeCorpusEntries();

//endregion Sentinel probe
