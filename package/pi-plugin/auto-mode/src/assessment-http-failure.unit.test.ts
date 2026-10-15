/**
 Provider failure codes survive the built sender without exposing borrowed response text.

 @module
 */
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import { AssessmentTransportError, } from '@monochromatic-dev/pi-plugin-auto-mode';
import { assessmentFailure, assessmentInput, assessmentSender, } from './assessment-transport-fixture.ts';

//region Fixed diagnostics distinguish known capacity failures from unknown provider content

await describe({
  name: 'assessment HTTP failure diagnostics',
  children: [
      {
        name: 'recognized token capacity code',
        raw: '{"detail":{"error_type":"max_tokens_exceeded","message":"private upstream text"}}',
        message: 'Assessment request returned HTTP 400; provider code max_tokens_exceeded',
      },
      {
        name: 'unknown code',
        raw: '{"detail":{"error_type":"private upstream text"}}',
        message: 'Assessment request returned HTTP 400',
      },
      {
        name: 'malformed JSON',
        raw: '{private upstream text',
        message: 'Assessment request returned HTTP 400',
      },
      {
        name: 'plain response text',
        raw: 'private upstream text',
        message: 'Assessment request returned HTTP 400',
      },
      {
        name: 'null response',
        raw: 'null',
        message: 'Assessment request returned HTTP 400',
      },
      {
        name: 'null detail',
        raw: '{"detail":null}',
        message: 'Assessment request returned HTTP 400',
      },
      {
        name: 'wrong code type',
        raw: '{"detail":{"error_type":["max_tokens_exceeded"]}}',
        message: 'Assessment request returned HTTP 400',
      },
      {
        name: 'lookalike code',
        raw: '{"detail":{"error_type":"max_tokens_exceeded\\nprivate upstream text"}}',
        message: 'Assessment request returned HTTP 400',
      },
      {
        name: 'code outside the recognized envelope',
        raw: '{"error_type":"max_tokens_exceeded"}',
        message: 'Assessment request returned HTTP 400',
      },
    ].map(function failureDiagnostic({ name, raw, message, }) {
      return it({
        name,
        fn: async () => {
          const send = assessmentSender({
            fetchImpl: async function failedResponse() {
              return new Response(raw, { status: 400, },);
            },
          },);
          const error = await assessmentFailure(async function dispatch() {
            return await send(assessmentInput(),);
          },);
          expect(error,).toBeInstanceOf(AssessmentTransportError,);
          expect(error,).toHaveProperty('message', message,);
          expect(String(error),).not.toContain('private upstream text',);
          expect(error,).not.toHaveProperty('cause',);
        },
      },);
    }),
},);

//endregion Fixed diagnostics distinguish known capacity failures from unknown provider content
