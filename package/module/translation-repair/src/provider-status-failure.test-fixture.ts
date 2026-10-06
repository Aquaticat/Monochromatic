import type { DisposableSandbox, } from '@monochromatic-dev/module-test/ts';

import {
  createSyntheticClient,
  CREDENTIAL_MARKER,
  fetchTransport,
  type SyntheticClient,
} from '../dist/final/node/index.mjs';
import { WHISKER_KEY, } from './quoting-failure.test-fixture.ts';
import { SEAT_SYNTHETIC_VISION_WITHHELD, } from './roster-seats.test-fixture.ts';

//region Provider status failure
// A PROVIDER STATUS FAILURE AS A RUN MEETS IT, built by running the real client
// over the real fetch-backed transport against a stubbed `fetch`, so the failure
// a log line is read for carries exactly what the transport leaves in it: the
// provider's reply body with the request's credential masked. Hand-building the
// error with a body would skip the mask and prove nothing about the line.
//
// TEST SUPPORT, NOT PACKAGE SOURCE. The credential and the words are invented,
// cat-themed, and no provider issued either.

/**
 Words the invented provider says about a refusal, apart from the key it echoes.
 */
const PROVIDER_WORDS = 'the cat tier is full, try again after the nap';

/**
 Key as a JSON writer that escapes every hyphen would write it.
 */
const ESCAPED_KEY = WHISKER_KEY.replaceAll(
  '-',
  String.raw`\u002d`,
);

/**
 Prefix a `Basic` pair puts before the key, which sets the base64 alignment.
 */
const PAIR_PREFIX = 'kit:';

/**
 Bytes base64 writes as one group.
 */
const BYTES_PER_GROUP = 3;

/**
 Characters base64 writes one group as.
 */
const CHARACTERS_PER_GROUP = 4;

/**
 Characters at the start of the pair's base64 that hold bits of the prefix
 alone, the mask leaving them where they stand: a group's characters for each
 whole group the prefix fills, and one more for each byte it puts in the
 group the key's first byte shares.
 */
const PREFIX_CHARACTERS = (CHARACTERS_PER_GROUP * Math.floor(PAIR_PREFIX.length / BYTES_PER_GROUP,))
  + (PAIR_PREFIX.length % BYTES_PER_GROUP);

/**
 Deadline of the one exchange the fixture asks for, far beyond its stubbed answer.
 */
const EXCHANGE_DEADLINE_MS = 5_000;

/**
 The pair as the invented provider echoes it, written in base64.
 */
const PAIR_IN_BASE64 = Buffer.from(`${PAIR_PREFIX}${WHISKER_KEY}`,)
  .toString('base64url',);

/**
 Body the invented provider answers with: its words, and the key it was sent
 in three spellings, as it stands, JSON-escaped and as part of a base64 pair.
 */
const ECHOING_BODY = `{"error":"${PROVIDER_WORDS}; refused key ${WHISKER_KEY}, escaped ${ESCAPED_KEY}, `
  + `base64 ${PAIR_IN_BASE64}"}`;

/**
 What the failure's opening reads once the transport has masked the key in all
 three spellings, the base64 run keeping the characters its prefix's bits fill.
 */
const MASKED_BODY = `{"error":"${PROVIDER_WORDS}; refused key ${CREDENTIAL_MARKER}, escaped ${CREDENTIAL_MARKER}, `
  + `base64 ${PAIR_IN_BASE64.slice(
    0,
    PREFIX_CHARACTERS,
  )}${CREDENTIAL_MARKER}"}`;

/**
 Key the invented client sends, which the invented provider echoes.
 */
export const ECHOED_KEY: string = WHISKER_KEY;

/**
 What a log line says of the failure this fixture builds: its class, its status,
 and the provider's words quoted onto one line, the key masked.

 @param status - HTTP status the invented provider answered

 @returns The failure's text as a log line carries it

 @example
 ```ts
 const text = statusFailureLogText({ status: 401, },);
 ```
 */
export function statusFailureLogText({ status, }: { readonly status: number; },): string {
  return `refused by SyntheticHttpError with HTTP ${String(status,)} (the provider said: ${JSON.stringify(MASKED_BODY,)})`;
}

/**
 Stubs `fetch` to answer every request with the invented provider's refusal.

 @param sinon - calling case's own sandbox (`ctx.sinon`)

 @param status - HTTP status to answer

 @mutates sinon - stubs `globalThis.fetch` until the case's sandbox is restored

 @example
 ```ts
 answerEveryFetchWithRefusal({ sinon: ctx.sinon, status: 401, },);
 ```
 */
export function answerEveryFetchWithRefusal(
  {
    sinon,
    status,
  }: {
    readonly sinon: DisposableSandbox;
    readonly status: number;
  },
): void {
  sinon
    .stub(
      globalThis,
      'fetch',
    )
    .callsFake(function refuse(): Promise<Response> {
      return Promise.resolve(new Response(
        ECHOING_BODY,
        { status, },
      ),);
    },);
}

/**
 Builds the real client over the real transport, with `fetch` stubbed to refuse
 every request.

 @param sinon - calling case's own sandbox (`ctx.sinon`)

 @param status - HTTP status the invented provider answers

 @returns Client whose every exchange fails with the provider's refusal

 @example
 ```ts
 const client = refusedClient({ sinon: ctx.sinon, status: 401, },);
 ```
 */
export function refusedClient(
  {
    sinon,
    status,
  }: {
    readonly sinon: DisposableSandbox;
    readonly status: number;
  },
): SyntheticClient {
  answerEveryFetchWithRefusal({
    sinon,
    status,
  },);
  return createSyntheticClient({
    apiKey: ECHOED_KEY,
    transport: fetchTransport,
  },);
}

/**
 Asks the real client for one chat and returns the failure it raises.

 @param sinon - calling case's own sandbox (`ctx.sinon`)

 @param status - HTTP status the invented provider answers

 @returns The `SyntheticHttpError` the exchange raised

 @throws Error when the exchange did not fail

 @example
 ```ts
 const failure = await statusFailureOf({ sinon: ctx.sinon, status: 401, },);
 ```
 */
export async function statusFailureOf(
  {
    sinon,
    status,
  }: {
    readonly sinon: DisposableSandbox;
    readonly status: number;
  },
): Promise<unknown> {
  /**
   Client over the refusing provider.
   */
  const client = refusedClient({
    sinon,
    status,
  },);
  try {
    await client.chatText({
      modelId: SEAT_SYNTHETIC_VISION_WITHHELD,
      messages: [{
        role: 'user',
        content: 'purr',
      },],
      signal: AbortSignal.timeout(EXCHANGE_DEADLINE_MS,),
    },);
  }
  catch (error) {
    return error;
  }
  throw new Error('the exchange the invented provider refused did not fail',);
}

//endregion Provider status failure
