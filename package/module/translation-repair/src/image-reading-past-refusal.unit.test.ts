/**
 * Tests for asking one reader again when it declines to read a picture.
 *
 * WHY THIS EXISTS AT ALL, which is a measurement rather than a preference.
 * Asked six times about one picture that plainly carries text, with identical
 * input every time, one reader refused four times and read it twice. The
 * refusal is a property of the roll. Corroboration needs both readers and the
 * provider offers exactly two that read images, so a reader refusing two asks
 * in three costs two thirds of the readings, not one third.
 *
 * WHAT THESE PIN is the scope as much as the retry. Only a refusal is asked
 * again: a model that does not read images, a picture too large to send and an
 * empty reply are properties of the input or the roster, and asking again
 * spends a call to be told the same thing.
 *
 * Fixtures are cat-themed invention. No corpus content appears here.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';

import {
  type ChatTextRequest,
  readPastRefusal,
  REFUSAL_ASK_LIMIT,
  type SyntheticClient,
  type SyntheticModelId,
} from '../dist/final/node/index.mjs';

/**
 * Reader used by every case that asks a model which reads images.
 */
const READER: SyntheticModelId = 'hf:moonshotai/Kimi-K3';

/**
 * Model the catalog says does not read images, so it is never sent one.
 */
const TEXT_ONLY: SyntheticModelId = 'hf:zai-org/GLM-5.2';

/**
 * What a reader returns when it declines, worded the way both real readers
 * word it.
 */
const REFUSAL = 'There is no text visible in this image.';

/**
 * What a reader returns when it reads.
 */
const READING = '走失猫咪 Mittens，虎斑，请电 555 0134。';

/**
 * Logger for the calls under test.
 */
const l = tagged({ tag: 'past-refusal-test', },);

/**
 * Bytes standing in for a picture, whose content no rule here reads.
 *
 * @returns Buffer of a size every case shares
 *
 * @example
 * ```ts
 * const bytes = pictureBytes();
 * ```
 */
function pictureBytes(): Uint8Array {
  return new Uint8Array(64,);
}

/**
 * Client that answers one model from a SEQUENCE, one reply per ask.
 *
 * A SEQUENCE RATHER THAN A FIXED REPLY, which is the whole point: what is under
 * test is what happens when the same model answers differently to the same
 * question, and a client that maps a model to one reply cannot express that.
 * Asks past the end of the script reuse its last entry, so a case that expects
 * the limit to stop the asking fails by looping rather than by reading a reply
 * nobody wrote.
 *
 * @param replies - what the reader returns, ask by ask
 *
 * @returns Client and a live count of asks it received
 *
 * @example
 * ```ts
 * const { client, asks, } = sequencedClient({ replies: [REFUSAL, READING,], },);
 * ```
 */
function sequencedClient(
  { replies, }: { readonly replies: readonly string[]; },
): {
  readonly client: SyntheticClient;
  readonly asks: SyntheticModelId[];
} {
  /**
   * Models asked, in the order the asks arrived.
   */
  const asks: SyntheticModelId[] = [];

  return {
    asks,
    client: {
      chatText: async (request,) => {
        /**
         * Request as this package's own contract describes it.
         */
        const { modelId, } = request as ChatTextRequest;
        asks.push(modelId,);

        /**
         * Reply for this ask, holding at the last scripted one.
         */
        const reply = replies[asks.length - 1] ?? replies.at(-1,) ?? '';
        return { text: reply, };
      },
      chatJson: async () => {
        throw new Error('chatJson unused by the reading stage',);
      },
      quotas: async () => {
        throw new Error('quotas unused by the reading stage',);
      },
    },
  };
}

await describe({
  name: readPastRefusal.name,
  children: [
    it({
      name: 'ASKS ONCE WHEN THE FIRST ASK IS READ, so a reader that answers costs exactly what it '
        + 'cost before this wrapper existed',
      fn: async () => {
        const { client, asks, } = sequencedClient({ replies: [READING,], },);

        /**
         * What the reader made of the picture.
         */
        const reading = await readPastRefusal({
          client,
          modelId: READER,
          bytes: pictureBytes(),
          assetName: 'noticeboard.webp',
          signal: AbortSignal.timeout(30_000,),
          perCallTimeoutMs: 30_000,
          l,
        },);

        expect(reading.kind,).toBe('read',);
        expect(asks.length,).toBe(1,);
      },
    },),

    it({
      name: 'ASKS AGAIN AFTER A REFUSAL AND RETURNS THE READING THAT FOLLOWS, which is the case '
        + 'the measurement found: the same model, the same picture, a different answer',
      fn: async () => {
        const { client, asks, } = sequencedClient({
          replies: [
            REFUSAL,
            READING,
          ],
        },);

        /**
         * What the reader made of the picture on the second ask.
         */
        const reading = await readPastRefusal({
          client,
          modelId: READER,
          bytes: pictureBytes(),
          assetName: 'noticeboard.webp',
          signal: AbortSignal.timeout(30_000,),
          perCallTimeoutMs: 30_000,
          l,
        },);

        expect(reading.kind,).toBe('read',);
        expect(asks.length,).toBe(2,);
      },
    },),

    it({
      name: 'STOPS AT THE ASK LIMIT AND REPORTS THE LAST REFUSAL, so a reader that will not read '
        + 'this picture at all costs a bounded number of calls rather than an unbounded one',
      fn: async () => {
        const { client, asks, } = sequencedClient({ replies: [REFUSAL,], },);

        /**
         * Outcome after every ask was declined.
         */
        const reading = await readPastRefusal({
          client,
          modelId: READER,
          bytes: pictureBytes(),
          assetName: 'noticeboard.webp',
          signal: AbortSignal.timeout(30_000,),
          perCallTimeoutMs: 30_000,
          l,
        },);

        expect(reading.kind,).toBe('unavailable',);
        expect(asks.length,).toBe(REFUSAL_ASK_LIMIT,);
      },
    },),

    it({
      name: 'ASKS ONCE FOR AN EMPTY REPLY, since a reader that returned nothing failed in a way '
        + 'another ask has not been measured to change',
      fn: async () => {
        const { client, asks, } = sequencedClient({ replies: [ '', ], },);

        /**
         * Outcome for a reader that said nothing at all.
         */
        const reading = await readPastRefusal({
          client,
          modelId: READER,
          bytes: pictureBytes(),
          assetName: 'noticeboard.webp',
          signal: AbortSignal.timeout(30_000,),
          perCallTimeoutMs: 30_000,
          l,
        },);

        expect(reading.kind,).toBe('unavailable',);
        expect(asks.length,).toBe(1,);
      },
    },),

    it({
      name: 'ASKS NOTHING OF A MODEL THAT DOES NOT READ IMAGES, which the catalog answers without '
        + 'spending a call, so the limit never applies to it',
      fn: async () => {
        const { client, asks, } = sequencedClient({ replies: [READING,], },);

        /**
         * Outcome for a text-only model.
         */
        const reading = await readPastRefusal({
          client,
          modelId: TEXT_ONLY,
          bytes: pictureBytes(),
          assetName: 'noticeboard.webp',
          signal: AbortSignal.timeout(30_000,),
          perCallTimeoutMs: 30_000,
          l,
        },);

        expect(reading.kind,).toBe('unavailable',);
        expect(asks.length,).toBe(0,);
      },
    },),

    it({
      name: 'STOPS RE-ASKING WHEN THE RUN STOPS, rather than spending the whole limit during a '
        + 'teardown. The first ask is already in flight when the stop arrives, so it completes; '
        + 'what must not happen is a second one',
      fn: async () => {
        const { client, asks, } = sequencedClient({ replies: [REFUSAL,], },);

        /**
         * Stop that arrives while the first ask is being answered.
         */
        const stopped = new AbortController();

        /**
         * Client whose first answer stops the run before returning a refusal.
         */
        const stopping: SyntheticClient = {
          ...client,
          chatText: async (request,) => {
            /**
             * Reply the underlying script would have given.
             */
            const reply = await client.chatText(request,);
            stopped.abort();
            return reply;
          },
        };

        /**
         * Name of whatever escaped the call, or what it returned instead.
         */
        let escaped = 'nothing thrown';
        try {
          /**
           * Outcome a stopped run reached.
           */
          const reading = await readPastRefusal({
            client: stopping,
            modelId: READER,
            bytes: pictureBytes(),
            assetName: 'noticeboard.webp',
            signal: stopped.signal,
            perCallTimeoutMs: 30_000,
            l,
          },);
          escaped = `returned ${reading.kind}`;
        } catch (error) {
          escaped = Error.isError(error,) ? error.name : String(error,);
        }

        expect(escaped,).toBe('AbortError',);
        expect(asks.length,).toBe(1,);
      },
    },),
  ],
},);
