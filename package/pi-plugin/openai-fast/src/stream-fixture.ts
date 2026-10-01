/**
 Test-only Codex models, authentication, and completed SSE responses. @module
 */
import type {
  Model,
  TranscriptContext,
} from '@earendil-works/pi-ai';
import { normalizeContext, } from '@earendil-works/pi-ai/utils/transcript';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

//region Synthetic inputs: no real credentials or external state are used.

/**
 Synthetic JWT carries only the claim parsed locally by native request preparation.
 */
export const STREAM_FIXTURE_TOKEN: string = `e30.${btoa(JSON.stringify({
  'https://api.openai.com/auth': { chatgpt_account_id: 'stream-fixture-account', },
},),)}.stream-fixture-signature`;

/**
 Test-owned model variations expose only capabilities exercised by stream tests.
 */
export type StreamFixtureModelOverrides = {
  readonly id?: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly contextWindow?: number;
  readonly reasoning?: boolean;
  readonly thinkingLevelMap?: Readonly<NonNullable<Model<'openai-codex-responses'>['thinkingLevelMap']>>;
};

/**
 Create fresh foreign-shaped model data without a compatibility allowlist.

 @param overrides - identity and capability changes for one test

 @returns original Codex model passed through the wrapper unchanged

 @internal
 */
export function createStreamFixtureModel(
  overrides: StreamFixtureModelOverrides = {},
): ForeignBorrowed<Model<'openai-codex-responses'>> {
  return {
    id: 'gpt-stream-fixture',
    name: 'Stream fixture model',
    api: 'openai-codex-responses',
    provider: 'openai-codex',
    baseUrl: 'https://stream-fixture.invalid/backend-api',
    reasoning: true,
    input: ['text',],
    cost: {
      input: 1,
      output: 2,
      cacheRead: 0.5,
      cacheWrite: 1,
    },
    contextWindow: 128_000,
    maxTokens: 4_096,
    ...overrides,
  };
}

/**
 Prepare branded native transcript through the installed normalizer.

 @returns independent transcript with synthetic prompt and user content

 @internal
 */
export function createStreamFixtureContext(): ForeignBorrowed<TranscriptContext> {
  return normalizeContext({
    systemPrompt: 'Stream fixture instructions.',
    messages: [{
      role: 'user',
      content: 'Stream fixture input.',
      timestamp: 0,
    },],
  },);
}

/**
 Explicit callback stop prevents native requests from reaching any transport.
 */
export class StreamFixtureStopError extends Error {
  /**
   Construct recognizable test-only callback failure.
   */
  constructor() {
    super('stream fixture stopped before transport',);
    this.name = 'StreamFixtureStopError';
  }
}

//endregion Synthetic inputs

//region Native SSE: completed usage allows priority accounting to be observed.

/**
 Create completed SSE response with default or absent server tier.
 Native Codex should retain priority accounting intent for both responses.

 @param serviceTier - optional synthetic server-reported tier

 @returns independent response consumed by native streaming

 @internal
 */
export function createStreamFixtureResponse({
  serviceTier,
}: { readonly serviceTier?: 'default'; } = {},): Response {
  /**
   Completion event reports nonzero input, output, and cached usage.
   */
  const event = {
    type: 'response.completed',
    response: {
      id: 'stream-fixture-response',
      status: 'completed',
      ...(serviceTier === undefined ? {} : { service_tier: serviceTier, }),
      output: [],
      usage: {
        input_tokens: 100,
        output_tokens: 20,
        total_tokens: 120,
        input_tokens_details: { cached_tokens: 10, },
      },
    },
  };
  return new Response(
    `data: ${JSON.stringify(event,)}\n\n`,
    {
      status: 200,
      headers: {
        'content-type': 'text/event-stream',
        'x-stream-fixture-response': 'observed',
      },
    },
  );
}

//endregion Native SSE
