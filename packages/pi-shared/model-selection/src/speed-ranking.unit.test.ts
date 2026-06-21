/**
 * Unit tests for speed-ranking helpers.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  findFastestInMajorVersions,
  scoreModelSpeed,
} from './core.ts';
import { fixtureModel, } from './test-fixtures.ts';

//region Fixtures

/** Score expected for models whose id says highspeed. */
const HIGH_SPEED_SCORE = 100;

/** Score expected for models whose id says mini. */
const MINI_SCORE = 50;

/** Score expected when a model has no speed signal. */
const NO_SPEED_SCORE = 0;

//endregion Fixtures

await describe({
  name: '',
  children: [
    describe({
      name: scoreModelSpeed.name,
      children: [
        it({
          name: 'scores explicit speed-name signals',
          fn: async function testScoreModelSpeed() {
            expect(scoreModelSpeed(fixtureModel({
              provider: 'moonshotai',
              id: 'kimi-k2.7-code-highspeed',
            },),),).toBe(HIGH_SPEED_SCORE,);
            expect(scoreModelSpeed(fixtureModel({
              provider: 'openai',
              id: 'gpt-4o-mini',
            },),),).toBe(MINI_SCORE,);
            expect(scoreModelSpeed(fixtureModel({
              provider: 'openai',
              id: 'gpt-4o',
            },),),).toBe(NO_SPEED_SCORE,);
          },
        },),
      ],
    },),
    describe({
      name: findFastestInMajorVersions.name,
      children: [
        it({
          name: 'ranks speed-name signal before lower input cost',
          fn: async function testFindFastestMajorVersions() {
            /** Models include a cheaper latest major version and a faster named one. */
            const models = [
              fixtureModel({ provider: 'openai', id: 'gpt-3.5-turbo', inputCost: 1, },),
              fixtureModel({ provider: 'openai', id: 'gpt-4o-mini', inputCost: 1, },),
              fixtureModel({ provider: 'openai', id: 'gpt-4o-highspeed', inputCost: 9, },),
            ];
            const result = findFastestInMajorVersions({
              models,
              majorVersions: 1,
            },);
            expect(result.map(function mapModel(model,) {
              return model.id;
            },),)
              .toEqual([
                'gpt-4o-highspeed',
                'gpt-4o-mini',
              ],);
          },
        },),
      ],
    },),
  ],
},);
