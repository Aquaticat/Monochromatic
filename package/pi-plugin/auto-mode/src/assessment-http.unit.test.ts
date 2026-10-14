/**
 Real loopback HTTP verifies fetch resource lifetime without any provider request.

 @module
 */
import { once, } from 'node:events';
import { createServer, } from 'node:http';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import { AssessmentTransportError, createAssessmentSender, } from '@monochromatic-dev/pi-plugin-auto-mode';
import { assessmentFailure, assessmentFixtureKey, } from './assessment-transport-fixture.ts';

//region Disposable servers exercise actual fetch and never route to an external provider

await describe({
  name: 'assessment loopback HTTP',
  children: ['success', 'redirect', 'cancelled',].map(function httpCase(mode) {
    return it({
      name: mode,
      fn: async () => {
        const controller = new AbortController();
        const captured = Promise.withResolvers<{body: string; authorization?: string; url?: string; method?: string}>();
        const raw = '{"model":"jev-1.13.0","answers":{}}';
        const calls: string[] = [];
        const server = createServer(function respond(request, response) {
          const chunks: string[] = [];
          calls.push(request.url ?? '',);
          request.setEncoding('utf8',);
          request.on('data', function captureChunk(chunk: string) {
            chunks.push(chunk,);
          },);
          request.on('error', function captureRequestError(error) {
            captured.reject(error,);
          },);
          request.on('end', function captureRequest() {
            captured.resolve({
              body: chunks.join('',),
              ...(request.headers.authorization === undefined ? {} : { authorization: request.headers.authorization, }),
              ...(request.url === undefined ? {} : { url: request.url, }),
              ...(request.method === undefined ? {} : { method: request.method, }),
            },);
            if (mode === 'redirect') {
              response.writeHead(302, { location: '/unexpected', },);
              response.end('redirect',);
              return;
            }
            if (mode === 'cancelled') {
              response.writeHead(200, { 'content-type': 'application/json', },);
              response.write('{',);
              return;
            }
            response.end(raw,);
          },);
        },);
        server.listen(0, '127.0.0.1',);
        try {
          await once(server, 'listening',);
          const address = server.address();
          if (address === null || typeof address === 'string')
            throw new Error('Loopback server has no TCP address',);
          const localUrl = `http://127.0.0.1:${address.port}/assessment`;
          const send = createAssessmentSender({
            now: function monotonicClock() { return performance.now(); },
            readCredential: function fixtureCredential() { return assessmentFixtureKey; },
            fetchImpl: async function localFetch(url, options) {
              expect(url,).toBe('https://api.llmgateway.io/v1/systemone',);
              const response = await fetch(localUrl, options,);
              if (mode === 'cancelled') controller.abort('fixture cancellation after response headers',);
              return response;
            },
          },);
          const input = {
            body: '{"state":"original \\u003c payload"}',
            signal: controller.signal,
            deadlineAt: performance.now() + 5_000,
            attempt: 1,
          };
          if (mode === 'success') expect(await send(input,),).toBe(raw,);
          else {
            const error = await assessmentFailure(async function dispatch() {
              return await send(input,);
            },);
            expect(error,).toBeInstanceOf(AssessmentTransportError,);
          }
          expect(await captured.promise,).toEqual({
            body: input.body,
            authorization: `Bearer ${assessmentFixtureKey}`,
            url: '/assessment',
            method: 'POST',
          },);
          expect(calls,).toEqual(['/assessment',],);
        }
        finally {
          server.closeAllConnections();
          await server[Symbol.asyncDispose]();
        }
      },
    },);
  }),
},);

//endregion Disposable servers exercise actual fetch and never route to an external provider
