/**
 * Unit tests for budget report helpers.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  budgetModelSlug,
  NoBudgetModelError,
  toBudgetModelCandidate,
} from './budget.ts';
import { fixtureModel, } from './test-fixtures.ts';

//region Fixtures

/** Model fixture used by report tests. */
const model = fixtureModel({
  provider: 'openai',
  id: 'gpt-4o-mini',
  inputCost: 1,
  outputCost: 2,
},);

//endregion Fixtures

await describe({
  name: '',
  children: [
    describe({
      name: toBudgetModelCandidate.name,
      children: [
        it({
          name: 'builds candidate report metadata',
          fn: async function testCandidateReport() {
            expect(toBudgetModelCandidate({
              model,
              hasConfiguredAuth: true,
            },),)
              .toEqual({
                provider: 'openai',
                modelId: 'gpt-4o-mini',
                costInput: 1,
                costOutput: 2,
                hasApiKey: true,
              },);
          },
        },),
      ],
    },),
    describe({
      name: budgetModelSlug.name,
      children: [
        it({
          name: 'formats provider/model slug',
          fn: async function testBudgetModelSlug() {
            expect(budgetModelSlug(model,),).toBe('openai/gpt-4o-mini',);
          },
        },),
      ],
    },),
    describe({
      name: NoBudgetModelError.name,
      children: [
        it({
          name: 'includes reason and candidates in message',
          fn: async function testNoBudgetModelError() {
            const error = new NoBudgetModelError('no auth', {
              sameProvider: toBudgetModelCandidate({
                model,
                hasConfiguredAuth: false,
              },),
              cheapestOverall: toBudgetModelCandidate({
                model,
                hasConfiguredAuth: true,
              },),
            },);
            expect(error.message,).toContain('Reason: no auth',);
            expect(error.message,).toContain('Best same-provider option',);
            expect(error.message,).toContain('Cheapest with API key',);
          },
        },),
      ],
    },),
  ],
},);
