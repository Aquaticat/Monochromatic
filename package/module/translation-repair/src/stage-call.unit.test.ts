/**
 * Tests for the guarded single exchange every pipeline stage runs through.
 *
 * `attemptStageCall` had no test, and it decides the one thing the ensemble
 * design depends on: which failures become a missing voice and which propagate.
 * The ensemble tolerates missing panelists and critics, so turning a failure
 * into an absent voice is correct. Turning a CALLER ABORT into an absent voice
 * would not be: the fan-out would carry on answering after the user asked it to
 * stop, and quorum would be reached from voices nobody wanted.
 *
 * So the cases below separate those two, and check that a lost voice is always
 * logged rather than silently swallowed.
 *
 * Fixtures are cat-themed invention.
 *
 * @module
 */

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  attemptStageCall,
  type ChatJsonOutcome,
  type ChatJsonRequest,
  type JsonSchemaResponseFormat,
  type SyntheticClient,
} from '../dist/final/node/index.mjs';

/**
 * Logger for the exchanges under test.
 */
const l = tagged({ tag: 'stage-call-test', },);

/**
 * Model the exchanges address.
 */
const MODEL_ID = 'hf:zai-org/GLM-5.2';

/**
 * Trivial reply payload the scripted clients emit.
 */
type PurrReply = {
  readonly purr: string;
};

/**
 * Guards the trivial payload.
 *
 * @param value - candidate reply
 *
 * @returns Whether value carries a string purr
 *
 * @example
 * ```ts
 * isPurrReply({ purr: 'loud', },);
 * ```
 */
function isPurrReply(value: unknown,): value is PurrReply {
  return ((typeof value) === 'object') && (value !== null)
    && ((typeof (value as PurrReply).purr) === 'string');
}

/**
 * Response format naming the test stage.
 */
const PURR_FORMAT: JsonSchemaResponseFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'purr_reply',
    schema: { type: 'object', },
  },
};

/**
 * Client answering with one scripted outcome, or throwing one scripted error.
 *
 * @param outcome - outcome to return, when the client answers
 *
 * @param thrown - error to throw instead, when the client fails
 *
 * @returns Client honoring exactly that script
 *
 * @example
 * ```ts
 * const client = scriptedClient({ outcome: { kind: 'refusal-shaped', rawText: '', detail: '', }, },);
 * ```
 */
function scriptedClient(
  {
    outcome,
    thrown,
  }: {
    readonly outcome?: unknown;
    readonly thrown?: Error;
  },
): SyntheticClient {
  return {
    chatText: async () => {
      throw new Error('chatText unused',);
    },
    chatJson: async <ValueT,>(
      request: ChatJsonRequest<ValueT>,
    ): Promise<ChatJsonOutcome<ValueT>> => {
      if (thrown !== undefined)
        throw thrown;
      if (outcome === undefined) {
        /**
         * Payload for the default success path.
         */
        const scripted: unknown = { purr: 'loud', };
        if (!request.validate(scripted,))
          throw new Error('scripted payload failed the guard',);
        return {
          kind: 'ok',
          value: scripted,
          rawText: JSON.stringify(scripted,),
        };
      }
      return outcome as ChatJsonOutcome<ValueT>;
    },
    quotas: async () => {
      throw new Error('quotas unused',);
    },
  };
}

/**
 * Runs one exchange against a scripted client.
 *
 * @param client - scripted client
 *
 * @param signal - caller abort handle
 *
 * @returns Voice as data
 *
 * @example
 * ```ts
 * const voice = await callWith({ client, signal: new AbortController().signal, },);
 * ```
 */
async function callWith(
  {
    client,
    signal,
    logger = l,
  }: {
    readonly client: SyntheticClient;
    readonly signal: AbortSignal;
    readonly logger?: typeof l;
  },
) {
  return await attemptStageCall({
    client,
    modelId: MODEL_ID,
    messages: [
      {
        role: 'user',
        content: 'Does the cat purr?',
      },
    ],
    signal,
    exchangeTimeoutMs: 1_000,
    responseFormat: PURR_FORMAT,
    validate: isPurrReply,
    stage: 'purr-check',
    l: logger,
  },);
}

/**
 * Logger that keeps its warnings, so a case can read WHAT a lost voice
 * recorded rather than only that a voice was lost.
 *
 * @returns Logger plus the array its warnings land in
 *
 * @example
 * ```ts
 * const { logger, warnings, } = capturingLogger();
 * ```
 */
function capturingLogger(): {
  readonly logger: typeof l;
  readonly warnings: readonly string[];
} {
  /**
   * Warnings recorded so far.
   */
  const warnings: string[] = [];
  return {
    logger: {
      ...l,
      warn: function record(message: string,): void {
        warnings.push(message,);
      },
    } as typeof l,
    warnings,
  };
}

await describe({
  name: attemptStageCall.name,
  children: [
    it({
      name: 'returns the validated reply as a heard voice',
      fn: async () => {
        /**
         * Voice from a clean exchange.
         */
        const voice = await callWith({
          client: scriptedClient({},),
          signal: new AbortController().signal,
        },);

        expect(voice.heard,).toBe(true,);
        expect(voice.heard ? voice.value.purr : '',).toBe('loud',);
      },
    },),

    it({
      name: 'turns every NON-OK outcome into an absent voice rather than '
        + 'throwing, because the ensemble is built to reach a verdict without '
        + 'every panelist and one model refusing must not take the stage down',
      fn: async () => {
        /**
         * Voices from each scripted non-ok outcome; concurrent because the
         * scripted clients share no state and nothing here is a sequence.
         */
        const voices = await Promise.all([
          {
            kind: 'refusal-shaped',
            rawText: 'I cannot help with that.',
            marker: 'i-cannot',
          },
          {
            kind: 'schema-mismatch',
            rawText: '{}',
            detail: 'guard rejected',
          },
        ].map(async function toVoice(outcome,) {
          return await callWith({
            client: scriptedClient({ outcome, },),
            signal: new AbortController().signal,
          },);
        },),);

        for (const voice of voices)
          expect(voice.heard,).toBe(false,);
      },
    },),

    it({
      name: 'NAMES THE SUB-KIND when a schema mismatch loses a voice, because '
        + 'schema-mismatch covers truncated thinking, unparseable content and '
        + 'a rejected guard, which need three different fixes and read '
        + 'identically without it',
      fn: async () => {
        const { logger, warnings, } = capturingLogger();
        await callWith({
          client: scriptedClient({
            outcome: {
              kind: 'schema-mismatch',
              rawText: '|>{"purr":"loud"}',
              detail: 'content is not valid JSON: Unexpected token',
            },
          },),
          signal: new AbortController().signal,
          logger,
        },);

        expect(warnings,).toHaveLength(1,);
        expect(warnings[0],).toContain('content is not valid JSON',);
      },
    },),

    it({
      name: 'carries the OPENING of the model text, which is where a parse '
        + 'failure is diagnosable: the Kimi-K3 outage was a two-character '
        + 'channel marker that explained 507 mismatches in one pass',
      fn: async () => {
        const { logger, warnings, } = capturingLogger();
        await callWith({
          client: scriptedClient({
            outcome: {
              kind: 'schema-mismatch',
              rawText: '|>{"purr":"loud"}',
              detail: 'content is not valid JSON: Unexpected token',
            },
          },),
          signal: new AbortController().signal,
          logger,
        },);

        expect(warnings[0],).toContain('|>',);
      },
    },),

    it({
      name: 'TRUNCATES a long reply and flattens its line breaks, so one lost '
        + 'voice cannot bury the rest of a run log',
      fn: async () => {
        const { logger, warnings, } = capturingLogger();
        await callWith({
          client: scriptedClient({
            outcome: {
              kind: 'schema-mismatch',
              rawText: `${'purr\n'.repeat(200,)}`,
              detail: 'content is not valid JSON: Unexpected token',
            },
          },),
          signal: new AbortController().signal,
          logger,
        },);

        /**
         * Warning the lost voice recorded.
         */
        const warning = warnings[0] ?? '';
        expect(warning.length,).toBeLessThan(300,);
        expect(warning.includes('\n',),).toBe(false,);
      },
    },),

    it({
      name: 'names the refusal MARKER when a refusal-shaped reply loses a '
        + 'voice, since a refusal and a parse failure call for different '
        + 'responses and both read as a bare lost voice otherwise',
      fn: async () => {
        const { logger, warnings, } = capturingLogger();
        await callWith({
          client: scriptedClient({
            outcome: {
              kind: 'refusal-shaped',
              rawText: 'I cannot help with that.',
              marker: 'i-cannot',
            },
          },),
          signal: new AbortController().signal,
          logger,
        },);

        expect(warnings[0],).toContain('i-cannot',);
      },
    },),

    it({
      name: 'turns a thrown transport failure into an absent voice too, since '
        + 'the client has already run its own transport retries by the time '
        + 'this helper sees the error',
      fn: async () => {
        /**
         * Voice from a client that threw.
         */
        const voice = await callWith({
          client: scriptedClient({ thrown: new Error('connection reset',), },),
          signal: new AbortController().signal,
        },);

        expect(voice.heard,).toBe(false,);
      },
    },),

    it({
      name: 'RETHROWS when the caller aborted, which is the case that must not '
        + 'degrade to a lost voice: swallowing it would let a fan-out keep '
        + 'answering after the user asked it to stop, and quorum could then be '
        + 'reached from voices nobody wanted',
      fn: async () => {
        /**
         * Abort handle already tripped when the exchange fails.
         */
        const controller = new AbortController();
        controller.abort();

        await expect(
          callWith({
            client: scriptedClient({ thrown: new Error('aborted',), },),
            signal: controller.signal,
          },),
        ).rejects.toThrow('aborted',);
      },
    },),

    it({
      name: 'decides by the SIGNAL rather than by the error text, so a failure '
        + 'that merely mentions abortion is still a lost voice while any error '
        + 'under a tripped signal propagates',
      fn: async () => {
        /**
         * Voice from an abort-sounding failure with no abort in fact.
         */
        const voice = await callWith({
          client: scriptedClient({ thrown: new Error('AbortError: upstream said so',), },),
          signal: new AbortController().signal,
        },);

        expect(voice.heard,).toBe(false,);

        /**
         * Abort handle tripped while the failure says nothing about aborting.
         */
        const controller = new AbortController();
        controller.abort();

        await expect(
          callWith({
            client: scriptedClient({ thrown: new Error('connection reset',), },),
            signal: controller.signal,
          },),
        ).rejects.toThrow('connection reset',);
      },
    },),

    it({
      name: 'passes the caller\'s signal and deadline through to the client '
        + 'untouched, so the abort the stage honors is the one the caller '
        + 'holds rather than a derived handle it cannot trip',
      fn: async () => {
        /**
         * Requests the client received, held in a list because a binding
         * assigned only inside a callback narrows to never at the read.
         */
        const seen: ChatJsonRequest<PurrReply>[] = [];

        /**
         * Caller's own abort handle.
         */
        const controller = new AbortController();

        /**
         * Client recording the request it was handed.
         */
        const client: SyntheticClient = {
          chatText: async () => {
            throw new Error('chatText unused',);
          },
          chatJson: async <ValueT,>(
            request: ChatJsonRequest<ValueT>,
          ): Promise<ChatJsonOutcome<ValueT>> => {
            seen.push(request as unknown as ChatJsonRequest<PurrReply>,);

            /**
             * Payload satisfying the guard.
             */
            const scripted: unknown = { purr: 'loud', };
            if (!request.validate(scripted,))
              throw new Error('scripted payload failed the guard',);
            return {
              kind: 'ok',
              value: scripted,
              rawText: JSON.stringify(scripted,),
            };
          },
          quotas: async () => {
            throw new Error('quotas unused',);
          },
        };

        await callWith({
          client,
          signal: controller.signal,
        },);

        expect(seen[0]?.signal,).toBe(controller.signal,);
        expect(seen[0]?.exchangeTimeoutMs,).toBe(1_000,);
        expect(seen[0]?.modelId,).toBe(MODEL_ID,);
      },
    },),
  ],
},);
