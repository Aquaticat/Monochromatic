import { tagged, } from '@monochromatic-dev/module-logger/ts';

import {
  createRunClient,
  RUN_PER_CALL_TIMEOUT_MS,
  RUN_ROSTER,
} from './run-config.ts';

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
  return (typeof value === 'object')
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

  for (const modelId of RUN_ROSTER) {
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
        ('detail' in outcome) ? ` -- ${String(outcome.detail,)}` : ''
      }`,
    );
    if (('rawText' in outcome) && (typeof outcome.rawText === 'string'))
      l.info(
        `${modelId}: first 300 chars of raw reply: ${
          JSON.stringify(outcome.rawText
            .slice(
              0,
              300,
            ),)
        }`,
      );
  }
}

if (import.meta.main)
  await reportModelHealth();

//endregion Model health
