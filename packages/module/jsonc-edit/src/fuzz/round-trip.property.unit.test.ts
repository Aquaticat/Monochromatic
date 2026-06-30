/**
 * Property tests proving values and canonical formatting survive a full
 * parse-edit-stringify-reparse round-trip.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  array,
  assert,
  dictionary,
  jsonValue,
  oneof,
  property,
  string,
} from 'fast-check';

import type { StringJsonc, } from '../brand.ts';
import { fuzzRuns, } from '../fuzz-budget.ts';
import {
  jsoncGetValue,
  jsoncStringify,
  parseJsoncEdit,
} from '../index.ts';

const container = oneof(
  dictionary(string(), jsonValue(),),
  array(jsonValue(),),
);

await describe({
  name: 'round-trip property',
  children: [
    it({
      name: 'a JSON value survives parse, read, and canonical comparison',
      fn: async () => {
        assert(
          property(container, (value,) => {
            const source = JSON.stringify(value,) as StringJsonc;
            const got = jsoncGetValue({
              state: parseJsoncEdit({ source, },),
              path: [],
            },);
            expect(JSON.stringify(got,),).toBe(JSON.stringify(value,),);
          },),
          { numRuns: fuzzRuns, },
        );
      },
    },),
    it({
      name: 'canonical stringify reaches a fixpoint after one normalization',
      fn: async () => {
        assert(
          property(container, (value,) => {
            const once = jsoncStringify({
              state: parseJsoncEdit({ source: JSON.stringify(value,) as StringJsonc, },),
            },);
            const twice = jsoncStringify({
              state: parseJsoncEdit({ source: once as StringJsonc, },),
            },);
            expect(twice,).toBe(once,);
          },),
          { numRuns: fuzzRuns, },
        );
      },
    },),
  ],
},);
