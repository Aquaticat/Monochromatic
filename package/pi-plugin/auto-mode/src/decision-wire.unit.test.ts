/**
 Verify the built Decisions adapter independently of provider traffic.

 @module
 */
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import {
  createAssessmentSender,
  decodeDecisionResponse,
  encodeDecisionRequest,
} from '../dist/final/node/index.mjs';
import { decisionFixtureRequest, decisionFixtureResponse, } from './decision-wire-fixture.ts';
import { assessmentFailure, assessmentFixtureKey, assessmentInput, } from './assessment-transport-fixture.ts';

//region Complete source and question preservation

await describe({
  name: encodeDecisionRequest.name,
  children: [
    it({ name: 'preserves every state value, question, criterion, and syntax delimiter', fn: async () => {
      const original = decisionFixtureRequest();
      const encoded = encodeDecisionRequest(JSON.stringify(original,),);
      const parsed: unknown = JSON.parse(encoded.body,);
      expect(parsed).toEqual({
        model: 'openai/gpt-6-luna-decisions',
        input: JSON.stringify(original.state),
        questions: [
          { name: 'head_0', type: 'choice', instructions: JSON.stringify(original.questions.head_0.instructions),
            choices: [
              { value: 'permission', description: 'Explicit permission for the complete operation.' },
              { value: 'none' }, { value: 'unknown', description: 'Missing premises.' },
            ] },
          { name: 'head_1', type: 'predicate', instructions: JSON.stringify({
            instructions: original.questions.head_1.instructions, criteria: original.questions.head_1.criteria,
          }) },
        ],
      });
      expect(encoded.questions,).toEqual([
        { name: 'head_0', type: 'choice', labels: ['permission', 'none', 'unknown',], },
        { name: 'head_1', type: 'noul', labels: [], },
      ],);
    }, },),
    ...[
      { name: 'unparseable source', body: '{ private invalid JSON', },
      { name: 'non-object root', body: '[]', },
      { name: 'null root', body: 'null' },
      { name: 'null state', body: JSON.stringify({ ...decisionFixtureRequest(), state: null }) },
      { name: 'array questions', body: JSON.stringify({ ...decisionFixtureRequest(), questions: [] }) },
      { name: 'wrong serving identity', body: JSON.stringify({ ...decisionFixtureRequest(), model: 'typesafe/jev-1.13.0', },), },
      { name: 'extra root obligation', body: JSON.stringify({ ...decisionFixtureRequest(), omitted: 'must not disappear', },), },
      { name: 'empty questions', body: JSON.stringify({ ...decisionFixtureRequest(), questions: {}, },), },
      { name: 'empty question name', body: JSON.stringify({ ...decisionFixtureRequest(), questions: { '': decisionFixtureRequest().questions.head_0 } }) },
      { name: 'unsupported kind', body: JSON.stringify({ ...decisionFixtureRequest(), questions: { head_0: { type: 'score', instructions: '', criteria: {}, }, }, },), },
      { name: 'missing instructions', body: JSON.stringify({ ...decisionFixtureRequest(), questions: { head_0: { type: 'choice', criteria: {}, }, }, },), },
      { name: 'empty choices', body: JSON.stringify({ ...decisionFixtureRequest(), questions: { head_0: { type: 'choice', instructions: {}, criteria: {}, }, }, },), },
      { name: 'numeric description', body: JSON.stringify({ ...decisionFixtureRequest(), questions: { head_0: { type: 'choice', instructions: {}, criteria: { yes: 1, no: null, }, }, }, },), },
    ].map(function invalidRequest({ name, body, },) {
      return it({ name: `rejects ${name} without returning a reduced request`, fn: async () => {
        expect(function encodeInvalidRequest() {
          encodeDecisionRequest(body,);
        },).toThrow();
      }, },);
    },),
    it({ name: 'accepts 200 questions and rejects 201 without truncation', fn: async () => {
      const original = decisionFixtureRequest();
      const entries = Array.from({ length: 201, }, (_, index,) => [`head_${String(index,)}`, original.questions.head_0,] as const,);
      const accepted = encodeDecisionRequest(JSON.stringify({ ...original, questions: Object.fromEntries(entries.slice(0, 200,),), },),);
      expect(accepted.questions,).toHaveLength(200,);
      expect(function overflow() {
        encodeDecisionRequest(JSON.stringify({ ...original, questions: Object.fromEntries(entries,), },),);
      },).toThrow('one through 200',);
    }, },),
    it({ name: 'accepts 255 criteria and rejects 256 without dropping labels', fn: async () => {
      const original = decisionFixtureRequest();
      const criteria = Array.from({ length: 256 }, (_, index) => [`choice_${String(index)}`, null] as const);
      const question = original.questions.head_0;
      const accepted = encodeDecisionRequest(JSON.stringify({ ...original, questions: {
        head_0: { ...question, criteria: Object.fromEntries(criteria.slice(0, 255)) },
      } }));
      expect(accepted.questions[0]?.labels).toHaveLength(255);
      expect(function excessiveVocabulary() {
        encodeDecisionRequest(JSON.stringify({ ...original, questions: {
          head_0: { ...question, criteria: Object.fromEntries(criteria) },
        } }));
      }).toThrow('two through 255');
    } }),
  ],
},);

//endregion Complete source and question preservation

//region Complete response identity precedes interpretation

await describe({
  name: decodeDecisionResponse.name,
  children: [
    it({ name: 'preserves probabilities without substituting confidence or rounding', fn: async () => {
      const encoded = encodeDecisionRequest(
        JSON.stringify(decisionFixtureRequest(),),
      );
      const result: unknown = JSON.parse(decodeDecisionResponse({ raw: JSON.stringify(decisionFixtureResponse(),), questions: encoded.questions, },),);
      expect(result).toEqual({
        model: 'openai/gpt-6-luna-decisions',
        answers: {
          head_0: { type: 'choice', choice: 'permission', confidence: 0.61,
            probabilities: { permission: 0.8, none: 0.1, unknown: 0.1 } },
          head_1: { type: 'noul', noul: 0.9 },
        },
        usage: { input_tokens: 123, output_tokens: 0, total_tokens: 123 },
      });
    }, },),
    ...[
      { name: 'wrong model', response: { ...decisionFixtureResponse(), model: 'gpt-6-luna', }, },
      { name: 'renamed answer with otherwise valid data', response: { ...decisionFixtureResponse(), answers: [
        { ...decisionFixtureResponse().answers[0], name: 'unrelated_question' }, decisionFixtureResponse().answers[1],
      ] }, },
      { name: 'missing answer', response: { ...decisionFixtureResponse(), answers: decisionFixtureResponse().answers.slice(0, 1,), }, },
      { name: 'reordered answers', response: { ...decisionFixtureResponse(), answers: decisionFixtureResponse().answers.toReversed(), }, },
      { name: 'refusal', response: { ...decisionFixtureResponse(), answers: [{ type: 'refusal', name: 'head_0', }, decisionFixtureResponse().answers[1],], }, },
      { name: 'duplicate answer', response: { ...decisionFixtureResponse(), answers: [decisionFixtureResponse().answers[0], decisionFixtureResponse().answers[0],], }, },
      { name: 'invalid usage', response: { ...decisionFixtureResponse(), usage: { input_tokens: -1, output_tokens: 0, }, }, },
      { name: 'fractional usage', response: { ...decisionFixtureResponse(), usage: { input_tokens: 1.5, output_tokens: 0 } } },
      { name: 'unsafe usage count', response: { ...decisionFixtureResponse(), usage: { input_tokens: Number.MAX_SAFE_INTEGER + 1, output_tokens: 0 } } },
      { name: 'missing usage', response: { ...decisionFixtureResponse(), usage: undefined } },
      ...[
        { name: 'wrong predicate type', type: 'choice', probability: 0.9 },
        { name: 'negative predicate', type: 'predicate', probability: -0.1 },
        { name: 'excessive predicate', type: 'predicate', probability: 1.1 },
        { name: 'missing predicate value', type: 'predicate', probability: undefined },
      ].map(function malformedPredicate({ name, type, probability }) {
        return { name, response: { ...decisionFixtureResponse(), answers: [
          decisionFixtureResponse().answers[0], { name: 'head_1', type, probability },
        ] } };
      }),
      ...[
        { name: 'missing confidence', confidence: undefined },
        { name: 'nonfinite confidence', confidence: Number.POSITIVE_INFINITY },
        { name: 'excessive confidence', confidence: 1.1 },
        { name: 'foreign selected choice', choice: 'unrelated' },
        { name: 'missing probability list', probabilities: undefined },
      ].map(function malformedCategorical({ name, ...changes }) {
        return { name, response: { ...decisionFixtureResponse(), answers: [
          { ...decisionFixtureResponse().answers[0], ...changes }, decisionFixtureResponse().answers[1],
        ] } };
      }),
      ...[
        { name: 'duplicate probability', probabilities: [{ value: 'permission', probability: 0.8, }, { value: 'none', probability: 0.1, }, { value: 'none', probability: 0.1, },], },
        { name: 'extra probability', probabilities: [{ value: 'permission', probability: 0.8, }, { value: 'none', probability: 0.1, }, { value: 'unknown', probability: 0.1, }, { value: 'other', probability: 0, },], },
        { name: 'wrong probability label', probabilities: [{ value: 'permission', probability: 0.8, }, { value: 'none', probability: 0.1, }, { value: 'other', probability: 0.1, },], },
        { name: 'unnormalized distribution', probabilities: [{ value: 'permission', probability: 0.8, }, { value: 'none', probability: 0.3, }, { value: 'unknown', probability: 0.1, },], },
        { name: 'negative probability', probabilities: [{ value: 'permission', probability: 0.8, }, { value: 'none', probability: -0.1, }, { value: 'unknown', probability: 0.3, },], },
      ].map(function malformedDistribution({ name, probabilities, },) {
        return { name, response: { ...decisionFixtureResponse(), answers: [
          { ...decisionFixtureResponse().answers[0], probabilities, }, decisionFixtureResponse().answers[1],
        ], }, };
      },),
    ].map(function invalidResponse({ name, response, },) {
      return it({ name: `rejects ${name} before returning estimates`, fn: async () => {
        const encoded = encodeDecisionRequest(
          JSON.stringify(decisionFixtureRequest(),),
        );
        expect(function decodeInvalidResponse() {
          decodeDecisionResponse({ raw: JSON.stringify(response,), questions: encoded.questions, },);
        },).toThrow();
      }, },);
    },),
  ],
},);

//endregion Complete response identity

//region Actual composed sender crosses the local HTTP boundary once

await describe({
  name: createAssessmentSender.name,
  children: [
    it({ name: 'dispatches the Decisions contract and returns the original decoder shape', fn: async () => {
      const calls: string[] = [];
      const send = createAssessmentSender({ now: () => 0, readCredential: () => assessmentFixtureKey,
        fetchImpl: async function localDecision(url, options,) {
          expect(url).toBe('https://api.llmgateway.io/v1/decisions');
          calls.push('request');
          expect(options?.body).toBe(encodeDecisionRequest(
            JSON.stringify(decisionFixtureRequest()),
          ).body);
          return Response.json(decisionFixtureResponse());
        }, },);
      const result: unknown = JSON.parse(await send({ ...assessmentInput(), body: JSON.stringify(decisionFixtureRequest(),), },),);
      expect(calls,).toEqual(['request',],);
      expect(result).toHaveProperty('answers.head_0.probabilities.permission', 0.8);
    }, },),
    it({ name: 'withholds invalid original input before reading a credential', fn: async () => {
      const reads: number[] = [];
      const send = createAssessmentSender({ now: () => 0, readCredential() {
      reads.push(1,);
      return assessmentFixtureKey; },
        fetchImpl: async function unexpectedHttp() { throw new Error('Unexpected HTTP',); }, },);
      await assessmentFailure(async function invalidOriginal() {
        return await send({ ...assessmentInput(), body: '{}', },);
      },);
      expect(reads,).toHaveLength(0,);
    }, },),
    it({ name: 'does not reset an expired original deadline for conversion', fn: async () => {
      const send = createAssessmentSender({ now: () => 5_000, readCredential: () => assessmentFixtureKey,
        fetchImpl: async function unexpectedHttp() { throw new Error('Unexpected HTTP',); }, },);
      const error = await assessmentFailure(async function expiredOriginal() {
        return await send({ ...assessmentInput(), body: JSON.stringify(decisionFixtureRequest(),), },);
      },);
      expect(String(error,),).toContain('original assessment lifetime',);
    }, },),
  ],
},);

//endregion Composed sender
