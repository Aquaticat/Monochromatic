/**
 Keep disposable CLI startup classification local while rejecting external requests.

 @module
 */
import { appendFile } from 'node:fs/promises';

import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

//region Fixture-only setup loads Pi's original fetch snapshot before overriding it.

/**
 Report a fixture boundary violation without making a provider request.
 */
class NativeCliFixtureNetworkError extends Error {
  /**
   Distinguish fixture isolation failures from upstream transport failures.
   */
  override readonly name = 'NativeCliFixtureNetworkError';
}

if (process.env
  .PI_AUTO_MODE_CLI_FIXTURE_CHILD
  !== '1')
  throw new NativeCliFixtureNetworkError('Native CLI fixture network guard requires its isolated child process');

/**
 Private receipt distinguishes local classification from an unexercised network guard.
 */
const receiptPath = process.env
  .PI_AUTO_MODE_CLI_FIXTURE_REQUESTS;
if ((receiptPath === undefined) || (receiptPath === ''))
  throw new NativeCliFixtureNetworkError('Native CLI fixture requires its disposable request receipt path');

// Pi preserves overrides installed after its dispatcher module captured the original fetch.
await import(new URL(
  '../../../pi/coding-agent/dist/core/http-dispatcher.js',
  import.meta.url
).href);

/**
 Answer the actual startup classifier locally without admitting another network route.

 Every accepted request enters the private JSONL receipt before its response returns,
 so the parent can prove local classification after the child closes.

 @param input - actual transport route remains inside the disposable fixture

 @param init - serialized classifier request supplies names for bound local answers

 @returns local response accepted by the existing assessment parser

 @throws NativeCliFixtureNetworkError when a request differs from the isolated classifier contract
 */
globalThis.fetch = async function answerFixtureNetwork(
  input: Parameters<typeof globalThis.fetch>[0],
  init?: ForeignBorrowed<RequestInit>
): Promise<Response> {
  /**
   Resolved request target; every route except the exact serialized classifier is refused.
   */
  const url = (typeof input) === 'string' ? input : input instanceof URL ? input.href : input.url;
  if ((url !== 'https://api.llmgateway.io/v1/decisions') || (init?.method !== 'POST')
    || ((typeof init.body) !== 'string'))
    throw new NativeCliFixtureNetworkError('External fetch is disabled in the native CLI process fixture');
  if (process.env
    .AUTO_MODE_LLMGATEWAY_API_KEY
    !== 'synthetic-local-fixture-only')
    throw new NativeCliFixtureNetworkError('Native CLI classifier requires its synthetic fixture credential');
  /**
   Serialized classifier request; shape-checked before any local answer is bound.
   */
  const request: unknown = JSON.parse(init.body);
  if ((request === null) || ((typeof request) !== 'object')
    || (!('model' in request))
    || ((typeof request.model) !== 'string')
    || (!('questions' in request))
    || (!Array.isArray(request.questions)))
    throw new NativeCliFixtureNetworkError('Native CLI classifier requires its actual serialized questions');
  /**
   Local answers preserving every original model and question name.
   */
  const answers = request.questions
    .map(function answer(question: unknown) {
    if ((question === null) || ((typeof question) !== 'object')
      || (!('name' in question))
      || ((typeof question.name) !== 'string'))
      throw new NativeCliFixtureNetworkError('Native CLI classifier requires named original questions');
    return {
      name: question.name,
      type: 'predicate',
      probability: 0.9
    };
  });
  /**
   Receipt entry for this local classification, appended before its response returns.
   */
  const receiptEntry = {
    url,
    questions: request.questions
      .length
  };
  await appendFile(
    receiptPath,
    `${JSON.stringify(receiptEntry)}\n`,
    {
      encoding: 'utf8',
      mode: 0o600
    }
  );
  return Response.json({
    model: request.model,
    answers,
    usage: {
      input_tokens: 0,
      output_tokens: 0
    }
  });
};

//endregion
