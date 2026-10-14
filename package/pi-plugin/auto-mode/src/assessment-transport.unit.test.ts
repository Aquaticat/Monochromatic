/**
 Built HTTP sender preserves raw bytes, lifetime, credential isolation, and bounded consumption.

 @module
 */
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import { AssessmentTransportError, createAssessmentSender, } from '@monochromatic-dev/pi-plugin-auto-mode';
import {
  assessmentFailure,
  assessmentFixtureKey,
  assessmentInput,
  assessmentSender,
} from './assessment-transport-fixture.ts';

//region Original request and response cross one fixed HTTP boundary unchanged

await describe({
  name: createAssessmentSender.name,
  children: [
    it({
      name: 'preserves the exact body, route, headers and raw response across separate original attempts',
      fn: async () => {
        const calls: {url: string; options?: RequestInit}[] = [];
        const raw = '{"model":"jev-1.13.0","answers":{}}';
        const send = assessmentSender({
          fetchImpl: async function captureRequest(url, options) {
            if (typeof url !== 'string') throw new Error('Assessment endpoint must be a fixed string',);
            calls.push({ url, ...(options === undefined ? {} : { options, }), },);
            return new Response(raw,);
          },
        },);
        const input = assessmentInput();
        expect(await send(input,),).toBe(raw,);
        expect(await send({ ...input, attempt: 2, },),).toBe(raw,);
        expect(calls,).toHaveLength(2,);
        for (const call of calls) {
          expect(call.url,).toBe('https://api.llmgateway.io/v1/systemone',);
          expect(call.options?.body,).toBe(input.body,);
          expect(call.options?.method,).toBe('POST',);
          expect(call.options?.redirect,).toBe('error',);
          expect(call.options?.headers,).toEqual({
            authorization: `Bearer ${assessmentFixtureKey}`,
            'content-type': 'application/json',
            'x-no-fallback': 'true',
          },);
          expect(call.options?.signal?.aborted,).toBe(false,);
        }
      },
    },),
    ...[undefined, '', 12,].map(function missingCredential(key) {
      return it({
        name: `withholds an unavailable credential ${String(key)}`,
        fn: async () => {
          let calls = 0;
          const send = assessmentSender({
            readCredential: function configuredCredential() { return key; },
            fetchImpl: async function countDispatch() { calls++;
            return new Response('{}',); },
          },);
          const error = await assessmentFailure(async function dispatch() {
            return await send(assessmentInput(),);
          },);
          expect(error,).toBeInstanceOf(AssessmentTransportError,);
          expect(calls,).toBe(0,);
        },
      },);
    }),
    ...[
      { name: 'credential in input', body: assessmentFixtureKey, attempt: 1, },
      { name: 'UTF-8 byte overflow', body: 'é'.repeat(524_289,), attempt: 1, },
      { name: 'zero attempt', body: '{}', attempt: 0, },
      { name: 'fourth attempt', body: '{}', attempt: 4, },
      { name: 'fractional attempt', body: '{}', attempt: 1.5, },
    ].map(function rejectedInput({ name, body, attempt, }) {
      return it({
        name: `withholds ${name} before HTTP`,
        fn: async () => {
          let calls = 0;
          const send = assessmentSender({
            fetchImpl: async function countDispatch() { calls++;
            return new Response('{}',); },
          },);
          const error = await assessmentFailure(async function dispatch() {
            return await send({ ...assessmentInput(), body, attempt, },);
          },);
          expect(error,).toBeInstanceOf(AssessmentTransportError,);
          expect(calls,).toBe(0,);
        },
      },);
    }),
    it({
      name: 'admits the inherited request and response byte boundaries',
      fn: async () => {
        const raw = 'é'.repeat(32_768,);
        const send = assessmentSender({ fetchImpl: async function boundedResponse() {
          return new Response(raw,);
        }, },);
        expect(await send({ ...assessmentInput(), body: 'é'.repeat(524_288,), },),).toBe(raw,);
      },
    },),
  ],
},);

//endregion Original request and response cross one fixed HTTP boundary unchanged

//region Deadline and cancellation retain the original judgment lifetime

await describe({
  name: 'original assessment lifetime',
  children: [
    ...[5_000, 5_001, -1, Number.NaN, Number.POSITIVE_INFINITY,].map(function elapsedClock(clock) {
      return it({
        name: `rejects original clock ${String(clock)} before HTTP`,
        fn: async () => {
          let calls = 0;
          const send = assessmentSender({
            now: function originalClock() { return clock; },
            fetchImpl: async function countDispatch() { calls++;
            return new Response('{}',); },
          },);
          const error = await assessmentFailure(async function dispatch() {
            return await send(assessmentInput(),);
          },);
          expect(error,).toBeInstanceOf(AssessmentTransportError,);
          expect(calls,).toBe(0,);
        },
      },);
    }),
    it({
      name: 'charges credential preparation to the original deadline',
      fn: async () => {
        let clock = 0;
        let calls = 0;
        const send = assessmentSender({
          now: function originalClock() { return clock; },
          readCredential: function prepareCredential() { clock = 5_000;
          return assessmentFixtureKey; },
          fetchImpl: async function countDispatch() { calls++;
          return new Response('{}',); },
        },);
        const error = await assessmentFailure(async function dispatch() {
            return await send(assessmentInput(),);
          },);
        expect(error,).toBeInstanceOf(AssessmentTransportError,);
        expect(calls,).toBe(0,);
      },
    },),
    it({
      name: 'withholds a pre-cancelled original request without reading credentials',
      fn: async () => {
        const controller = new AbortController();
        controller.abort(assessmentFixtureKey,);
        let reads = 0;
        const send = assessmentSender({
          readCredential: function readKey() { reads++;
          return assessmentFixtureKey; },
          fetchImpl: async function unexpectedDispatch() { throw new Error('Unexpected HTTP',); },
        },);
        const error = await assessmentFailure(async function dispatch() {
          return await send({ ...assessmentInput(), signal: controller.signal, },);
        },);
        expect(error,).toBeInstanceOf(AssessmentTransportError,);
        expect(String(error),).not.toContain(assessmentFixtureKey,);
        expect(reads,).toBe(0,);
      },
    },),
    it({
      name: 'aborts the HTTP signal when original cancellation occurs during dispatch',
      fn: async () => {
        const controller = new AbortController();
        const send = assessmentSender({
          fetchImpl: async function cancelledResponse(_url, options) {
            controller.abort(assessmentFixtureKey,);
            expect(options?.signal?.aborted,).toBe(true,);
            return new Response('{}',);
          },
        },);
        const error = await assessmentFailure(async function dispatch() {
          return await send({ ...assessmentInput(), signal: controller.signal, },);
        },);
        expect(error,).toBeInstanceOf(AssessmentTransportError,);
        expect(String(error),).not.toContain(assessmentFixtureKey,);
      },
    },),
    it({
      name: 'rejects completion after the original deadline even when HTTP returns bytes',
      fn: async () => {
        let clock = 0;
        const send = assessmentSender({
          now: function originalClock() { return clock; },
          fetchImpl: async function lateResponse() { clock = 5_000;
          return new Response('{}',); },
        },);
        const error = await assessmentFailure(async function dispatch() {
            return await send(assessmentInput(),);
          },);
        expect(error,).toBeInstanceOf(AssessmentTransportError,);
      },
    },),
  ],
},);

//endregion Deadline and cancellation retain the original judgment lifetime

//region HTTP failures never become model answers or disclose borrowed error text

await describe({
  name: 'assessment HTTP response boundaries',
  children: [
    ...[
      { name: 'missing body', response: function missingBody() { return new Response(null, { status: 204, },); }, },
      { name: 'HTTP failure', response: function httpFailure() { return new Response('private upstream error', { status: 503, },); }, },
      { name: 'credential echo', response: function credentialEcho() { return new Response(assessmentFixtureKey,); }, },
      { name: 'UTF-8 response overflow', response: function oversizedResponse() { return new Response('é'.repeat(32_769,),); }, },
      { name: 'invalid UTF-8', response: function invalidEncoding() { return new Response(new Uint8Array([0xFF,],),); }, },
    ].map(function rejectedResponse(fixture) {
      return it({
        name: `rejects ${fixture.name} after one HTTP attempt`,
        fn: async () => {
          let calls = 0;
          const send = assessmentSender({ fetchImpl: async function responseFixture() {
            calls++;
          return fixture.response(); }, },);
          const error = await assessmentFailure(async function dispatch() {
            return await send(assessmentInput(),);
          },);
          expect(error,).toBeInstanceOf(AssessmentTransportError,);
          expect(String(error),).not.toContain(assessmentFixtureKey,);
          expect(String(error),).not.toContain('private upstream error',);
          expect(calls,).toBe(1,);
        },
      },);
    }),
    it({
      name: 'cancels an oversized response stream before consuming later chunks',
      fn: async () => {
        let cancelled = false;
        const stream = new ReadableStream<Uint8Array>({
          start(controller) { controller.enqueue(new Uint8Array(65_537,),); },
          cancel() { cancelled = true; },
        },);
        const send = assessmentSender({ fetchImpl: async function streamedResponse() {
          return new Response(stream,);
        }, },);
        const error = await assessmentFailure(async function dispatch() {
            return await send(assessmentInput(),);
          },);
        expect(error,).toBeInstanceOf(AssessmentTransportError,);
        expect(cancelled,).toBe(true,);
      },
    },),
    ...['credential', 'fetch', 'stream',].map(function thrownBoundary(boundary) {
      return it({
        name: `does not expose ${boundary} failure text or cause`,
        fn: async () => {
          const cause = new Error(assessmentFixtureKey,);
          const send = assessmentSender({
            readCredential: function readKey() {
              if (boundary === 'credential') throw cause;
              return assessmentFixtureKey;
            },
            fetchImpl: async function failedHttp() {
              if (boundary === 'fetch') throw cause;
              return new Response(new ReadableStream<Uint8Array>({
                start(controller) { controller.error(cause,); },
              },),);
            },
          },);
          const error = await assessmentFailure(async function dispatch() {
            return await send(assessmentInput(),);
          },);
          expect(error,).toBeInstanceOf(AssessmentTransportError,);
          expect(String(error),).not.toContain(assessmentFixtureKey,);
          expect(error,).not.toHaveProperty('cause',);
        },
      },);
    }),
  ],
},);

//endregion HTTP failures never become model answers or disclose borrowed error text
