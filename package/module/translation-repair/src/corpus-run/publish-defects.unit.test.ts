/**
 Tests for collecting publish-time content check failures as defects the page
 ships with (the owner, 2026-09-27: a settled page ships with its defects
 reported; ledger E1).

 Only a check's own refusal becomes a defect. Anything else it throws is a
 fault in the code and must still stop the entry, or a bug would ship as a
 content report.

 Fixtures are cat-themed invention. No corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  defectsLine,
  type PublishCheckStep,
  publishDefects,
} from '../../dist/final/node/index.mjs';

/**
 Refusal the whisker check throws when the page fails it.

 @example
 ```ts
 throw new WhiskerRefusalError();
 ```
 */
class WhiskerRefusalError extends Error {
  /**
   Names the check so the message is recognisable in a defect.
   */
  constructor() {
    super('entry WhiskerCat drops 1 whisker',);
    this.name = 'WhiskerRefusalError';
  }
}

/**
 Refusal a different check throws, standing in for a class the whisker step
 does not own.

 @example
 ```ts
 throw new TailRefusalError();
 ```
 */
class TailRefusalError extends Error {
  /**
   Names the check so the message is recognisable.
   */
  constructor() {
    super('entry WhiskerCat drops 1 tail',);
    this.name = 'TailRefusalError';
  }
}

/**
 Check that passes.
 */
const PASSING: PublishCheckStep = {
  check: 'headings',
  refusal: WhiskerRefusalError,
  run: function passes(): void {
    // A CLEAN PAGE throws nothing.
  },
};

/**
 Check that fails with its own refusal.
 */
const REFUSING: PublishCheckStep = {
  check: 'destinations',
  refusal: WhiskerRefusalError,
  run: function refuses(): void {
    throw new WhiskerRefusalError();
  },
};

/**
 Second check failing with its own refusal, to show order is kept.
 */
const REFUSING_FRONT_MATTER: PublishCheckStep = {
  check: 'front-matter',
  refusal: TailRefusalError,
  run: function refuses(): void {
    throw new TailRefusalError();
  },
};

await describe({
  name: publishDefects.name,
  children: [
    it({
      name: 'COLLECTS NOTHING for checks that pass, the control the collection rests on',
      fn: async () => {
        expect(publishDefects({ steps: [PASSING,], },),).toStrictEqual([],);
      },
    },),
    it({
      name: 'COLLECTS A CHECK\'S OWN REFUSAL as a defect naming the check and its message',
      fn: async () => {
        expect(publishDefects({
          steps: [
            PASSING,
            REFUSING,
          ],
        },),).toStrictEqual([{
          check: 'destinations',
          message: 'entry WhiskerCat drops 1 whisker',
        },],);
      },
    },),
    it({
      name: 'RUNS EVERY CHECK after one fails, and keeps their order',
      fn: async () => {
        expect(publishDefects({
          steps: [
            REFUSING_FRONT_MATTER,
            PASSING,
            REFUSING,
          ],
        },),).toStrictEqual([
          {
            check: 'front-matter',
            message: 'entry WhiskerCat drops 1 tail',
          },
          {
            check: 'destinations',
            message: 'entry WhiskerCat drops 1 whisker',
          },
        ],);
      },
    },),
    it({
      name: 'RETHROWS ANOTHER CHECK\'S REFUSAL, since the step owns only its own class',
      fn: async () => {
        expect(() => {
          publishDefects({
            steps: [{
              check: 'headings',
              refusal: WhiskerRefusalError,
              run: function refusesWrongly(): void {
                throw new TailRefusalError();
              },
            },],
          },);
        },).toThrow(TailRefusalError,);
      },
    },),
    it({
      name: 'RETHROWS A FAULT IN THE CODE, so a bug never ships as a content report',
      fn: async () => {
        expect(() => {
          publishDefects({
            steps: [{
              check: 'contributor-names',
              refusal: WhiskerRefusalError,
              run: function faults(): void {
                throw new TypeError('whisker is not a function',);
              },
            },],
          },);
        },).toThrow(TypeError,);
      },
    },),
  ],
},);

await describe({
  name: defectsLine.name,
  children: [
    it({
      name: 'PRINTS NOTHING for a clean page',
      fn: async () => {
        expect(defectsLine({
          entryId: 'WhiskerCat',
          defects: [],
        },),).toBe('',);
      },
    },),
    it({
      name: 'NAMES THE ENTRY AND EVERY FAILED CHECK in the order they ran',
      fn: async () => {
        expect(defectsLine({
          entryId: 'WhiskerCat',
          defects: [
            {
              check: 'front-matter',
              message: 'entry WhiskerCat drops 1 tail',
            },
            {
              check: 'destinations',
              message: 'entry WhiskerCat drops 1 whisker',
            },
          ],
        },),).toBe('DEFECTS WhiskerCat checks=front-matter,destinations',);
      },
    },),
  ],
},);
