import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { errorName, } from '../error-name.ts';
import {
  createRunClient,
  RUN_PER_CALL_TIMEOUT_MS,
  RUN_ROSTER,
} from './run-config.ts';
import { reportingRefusals, } from './cli-refusal.ts';

//region Model health
// Asks every model on the roster for one trivial structured answer, and reports
// what came back.
//
// Built because `schema-mismatch, voice lost` is where three different faults
// arrive wearing one label: output truncated inside a thinking block, content
// that is not JSON at all, and JSON the caller's guard rejected. The client
// distinguishes them and says which at DEBUG level, which a corpus run does not
// record, so a run log shows a model failing and never says why.
//
// One model went from zero mismatches to 507 in four passes on unchanged code,
// across every role it holds. That is a property of the model or of how it is
// being asked, not of any stage, and the cheapest way to tell those apart is to
// ask it something a working model cannot get wrong.
//
// Fixtures are cat-themed invention. No corpus text takes part, and this writes
// nothing.

/**
 * Question every model is asked.
 *
 * Deliberately trivial. The point is not to test capability: any model that can
 * hold a role in this pipeline can answer it, so a failure here is about the
 * response FORMAT rather than about the task.
 */
const HEALTH_PROMPT =
  'Reply with JSON matching the schema: how many cats are named in this '
    + 'sentence, and what is the first one called? "Mittens and Tabby sat on the '
    + 'windowsill."';

/**
 * How much of a raw reply the log line carries.
 *
 * Enough to show a prefix, a fence, or an apology sitting in front of the JSON,
 * which is what this probe was built to catch, and short enough that six models
 * fit in one readable screen.
 */
const RAW_REPLY_PREVIEW_CHARS = 300;

/**
 * Exit code left behind when some model could not be reached at all.
 *
 * A ROSTER THAT CANNOT BE FULLY PROBED IS A FINDING, and the caller of a
 * diagnostic reads its exit code. Preserved from the behaviour this replaced,
 * where an unreachable model crashed the probe and produced a non-zero exit as
 * a side effect of dying.
 */
const ROSTER_INCOMPLETE = 1;

/**
 * Schema the reply must satisfy.
 */
const HEALTH_RESPONSE_FORMAT = {
  type: 'json_schema',
  json_schema: {
    name: 'cat_count',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: [
        'count',
        'first',
      ],
      properties: {
        count: { type: 'number', },
        first: { type: 'string', },
      },
    },
  },
} as const;

/**
 * Accepts a reply carrying both fields, whatever their values.
 *
 * @param value - parsed reply
 *
 * @returns Whether the reply has the shape asked for
 *
 * @example
 * ```ts
 * const ok = isHealthReply(JSON.parse(text,),);
 * ```
 */
function isHealthReply(value: unknown,): value is {
  readonly count: number;
  readonly first: string;
} {
  return ((typeof value) === 'object')
    && (value !== null)
    && ('count' in value)
    && ('first' in value);
}

/**
 * Asks every roster model the health question and prints what returned.
 *
 * @example
 * ```ts
 * await reportModelHealth();
 * ```
 */
async function reportModelHealth(): Promise<void> {
  /**
   * Logger tagged for this probe.
   */
  const l = tagged({ tag: reportModelHealth.name, },);

  /**
   * Client built from the injected key.
   */
  const client = createRunClient();

  /**
   * Models whose probe threw before any outcome could be read.
   *
   * SEPARATE FROM AN UNHEALTHY REPLY, which is the distinction this whole probe
   * exists to draw. A model that answered badly is evidence about the model; a
   * model that could not be asked is evidence about the provider, and reporting
   * the second as the first would send a reader looking in the wrong place.
   */
  const unreachable: string[] = [];

  for (const modelId of RUN_ROSTER) {
    try {
      /**
       * What this model returned, or the fault that stopped it.
       */
      /* oxlint-disable-next-line no-await-in-loop -- one model at a time on purpose: this is a diagnostic, and concurrent calls would let a provider rate limit read as a model fault */
      const outcome = await client.chatJson({
        modelId,
        messages: [
          {
            role: 'user',
            content: HEALTH_PROMPT,
          },
        ],
        responseFormat: HEALTH_RESPONSE_FORMAT,
        validate: isHealthReply,
        exchangeTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
        signal: AbortSignal.timeout(RUN_PER_CALL_TIMEOUT_MS,),
      },);

      l.info(
        `${modelId}: ${outcome.kind}${
          ('detail' in outcome) ? ` -- ${outcome.detail}` : ''
        }`,
      );
      if (('rawText' in outcome) && ((typeof outcome.rawText) === 'string'))
        l.info(
          `${modelId}: first ${
            String(RAW_REPLY_PREVIEW_CHARS,)
          } chars of raw reply: ${
            JSON.stringify(outcome.rawText
              .slice(
                0,
                RAW_REPLY_PREVIEW_CHARS,
              ),)
          }`,
        );
    } catch (error) {
      // A THROW HERE IS A REPORT, not the end of the probe. Before this, the
      // first model whose provider was out of budget ended the run and every
      // model after it went unreported, which is precisely the moment someone
      // is running this.
      /**
       * What was thrown, rendered and bounded so a long provider body cannot
       * fill the report.
       */
      const detail = String(error,)
        .slice(
          0,
          RAW_REPLY_PREVIEW_CHARS,
        );

      unreachable.push(modelId,);
      l.warn(`${modelId}: UNREACHABLE (${errorName({ error, },)}): ${detail}`,);
    }
  }

  l.info(
    `ROSTER ${String(RUN_ROSTER.length - unreachable.length,)} of `
      + `${String(RUN_ROSTER.length,)} models answered${
        (unreachable.length === 0)
          ? ''
          : `; unreachable: ${unreachable.join(', ',)}`
      }`,
  );

  if (unreachable.length > 0)
    process.exitCode = ROSTER_INCOMPLETE;
}

if (import.meta.main)
  await reportingRefusals({
    what: 'model-health',
    run: reportModelHealth,
  },);

//endregion Model health
