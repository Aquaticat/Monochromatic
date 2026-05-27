/**
 * Unit tests for Advisor-specific core helpers.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';

import { prepareAdvisorArguments, } from './tool-params.ts';

await describe({
  name: prepareAdvisorArguments.name,
  children: [
    it({
      name: 'normalizes raw string arguments',
      fn: async function testRawStringArguments() {
        expect(prepareAdvisorArguments('expensive/reviewer',),).toEqual({
          model: 'expensive/reviewer',
        },);
      },
    },),
  ],
},);
