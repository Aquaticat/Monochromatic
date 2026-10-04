/**
 Tests for the fetch-backed default transport:
 request assembly (fresh header copy, body only on POST, dependent
 signal), raw status passthrough, and abort propagation.
 The global fetch is stubbed per test; children run sequentially so
 stubs never overlap.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  fetchTransport,
  StreamOverrunError,
} from '../dist/final/node/index.mjs';
import {
  anthropicBlockDelta,
  anthropicBlockStart,
} from './anthropic-frames.test-fixture.ts';
import { frameOf, } from './sse-frame.test-fixture.ts';

/**
 Request init the stubbed fetch captured, probed field by field.
 */
type CapturedInit = {
  readonly method?: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string;
  readonly signal?: AbortSignal;
};

await describe({
  name: fetchTransport.name,
  concurrency: 1,
  children: [
    it({
      name: 'assembles a POST with copied headers and returns the raw reply',
      fn: async ctx => {
        /**
         Headers object whose identity must not reach the platform request.
         */
        const callerHeaders = { Authorization: 'Bearer cat-key', };
        const fetchStub = ctx.sinon
          .stub(
            globalThis,
            'fetch',
          )
          .resolves(new Response(
            '{"cat":"喵"}',
            { status: 200, },
          ),);

        const reply = await fetchTransport({
          url: 'https://example.org/cat-chat',
          label: 'hf:whiskers',
          method: 'POST',
          headers: callerHeaders,
          bodyJson: '{"model":"cat"}',
          signal: new AbortController().signal,
        },);

        expect(reply,).toEqual({
          status: 200,
          bodyText: '{"cat":"喵"}',
        },);
        expect(fetchStub,).toHaveBeenCalledTimes(1,);
        const [calledUrl, init,] = fetchStub.firstCall.args;
        const captured = init as CapturedInit;
        expect(calledUrl,).toBe('https://example.org/cat-chat',);
        expect(captured.method,).toBe('POST',);
        expect(captured.body,).toBe('{"model":"cat"}',);
        expect(captured.headers,).toEqual(callerHeaders,);
        expect(captured.headers,).not.toBe(callerHeaders,);
      },
    },),
    it({
      name: 'omits the body key entirely on GET exchanges',
      fn: async ctx => {
        const fetchStub = ctx.sinon
          .stub(
            globalThis,
            'fetch',
          )
          .resolves(new Response(
            '{}',
            { status: 200, },
          ),);

        await fetchTransport({
          url: 'https://example.org/cat-quotas',
          label: 'hf:whiskers',
          method: 'GET',
          headers: {},
          signal: new AbortController().signal,
        },);

        const [, init,] = fetchStub.firstCall.args;
        expect(Object.hasOwn(
          init as object,
          'body',
        ),).toBe(false,);
      },
    },),
    it({
      name: 'passes non-success statuses through as data, never throwing',
      fn: async ctx => {
        ctx.sinon
          .stub(
            globalThis,
            'fetch',
          )
          .resolves(new Response(
            'upstream napping',
            { status: 503, },
          ),);

        const reply = await fetchTransport({
          url: 'https://example.org/cat-chat',
          label: 'hf:whiskers',
          method: 'POST',
          headers: {},
          bodyJson: '{}',
          signal: new AbortController().signal,
        },);

        expect(reply,).toEqual({
          status: 503,
          bodyText: 'upstream napping',
        },);
      },
    },),
    it({
      name: 'derives a dependent signal that carries the caller abort',
      fn: async ctx => {
        ctx.sinon
          .stub(
            globalThis,
            'fetch',
          )
          .callsFake(async function abortAwareFetch(_url, init,) {
            /**
             Signal the platform request would honor.
             */
            const { signal, } = (init ?? {}) as CapturedInit;
            if (signal?.aborted === true)
              throw signal.reason;
            return new Response(
              '{}',
              { status: 200, },
            );
          },);

        const caller = new AbortController();
        caller.abort(new Error('user steered away',),);

        let caught: unknown;
        try {
          await fetchTransport({
            url: 'https://example.org/cat-chat',
            label: 'hf:whiskers',
            method: 'POST',
            headers: {},
            bodyJson: '{}',
            signal: caller.signal,
          },);
        }
        catch (error) {
          caught = error;
        }
        expect(String(caught,),).toContain('user steered away',);
      },
    },),
    it({
      name: 'hands fetch a signal distinct from the caller handle',
      fn: async ctx => {
        const fetchStub = ctx.sinon
          .stub(
            globalThis,
            'fetch',
          )
          .resolves(new Response(
            '{}',
            { status: 200, },
          ),);

        const caller = new AbortController();
        await fetchTransport({
          url: 'https://example.org/cat-chat',
          label: 'hf:whiskers',
          method: 'GET',
          headers: {},
          signal: caller.signal,
        },);

        const [, init,] = fetchStub.firstCall.args;
        expect((init as CapturedInit).signal,).not.toBe(caller.signal,);
      },
    },),
    it({
      name: 'raises the drain overrun on an answer past a caller maxAnswerChars, the bound riding '
        + 'through to the drain',
      fn: async ctx => {
        ctx.sinon
          .stub(
            globalThis,
            'fetch',
          )
          .resolves(new Response(
            frameOf({
              channel: 'content',
              text: 'Cat one sat on mat one. Cat two sat on mat two. ',
            },),
            { status: 200, },
          ),);
        /** Value caught from the exchange whose answer passed its bound. */
        let caught: unknown;
        try {
          await fetchTransport({
            url: 'https://example.org/cat-chat',
            label: 'hf:whiskers',
            method: 'POST',
            headers: {},
            bodyJson: '{"model":"cat"}',
            signal: new AbortController().signal,
            maxAnswerChars: 10,
          },);
        }
        catch (error) {
          caught = error;
        }
        expect(caught instanceof StreamOverrunError,).toBe(true,);
      },
    },),
    it({
      name: 'reads an anthropic-shaped stream when the exchange names its wire format, where the '
        + 'default scanner reads no delta and the call simply completes',
      fn: async ctx => {
        /**
         Anthropic text frames whose answer passes the same small bound an
         OpenAI-shaped scanner never sees: an anthropic frame carries no
         `choices` key at all.
         */
        const raw = anthropicBlockStart({
          index: 0,
          type: 'text',
        },) + anthropicBlockDelta({
          index: 0,
          deltaType: 'text_delta',
          field: 'text',
          text: 'Cat one sat on mat one. ',
        },);
        ctx.sinon
          .stub(
            globalThis,
            'fetch',
          )
          .callsFake(async function freshBody() {
            return new Response(
              raw,
              { status: 200, },
            );
          },);
        /** Value caught from the exchange naming the anthropic wire. */
        let caught: unknown;
        try {
          await fetchTransport({
            url: 'https://example.org/cat-chat',
            label: 'hf:whiskers',
            method: 'POST',
            headers: {},
            bodyJson: '{"model":"cat"}',
            signal: new AbortController().signal,
            maxAnswerChars: 10,
            wireFormat: 'anthropic',
          },);
        }
        catch (error) {
          caught = error;
        }
        expect(caught instanceof StreamOverrunError,).toBe(true,);
        /**
         The same body with no wire named: the default scanner reads no
         answer character of it, so the same bound never trips.
         */
        const reply = await fetchTransport({
          url: 'https://example.org/cat-chat',
          label: 'hf:whiskers',
          method: 'POST',
          headers: {},
          bodyJson: '{"model":"cat"}',
          signal: new AbortController().signal,
          maxAnswerChars: 10,
        },);
        expect(reply.bodyText,).toBe(raw,);
      },
    },),
  ],
},);
