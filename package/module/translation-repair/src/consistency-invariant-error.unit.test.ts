/**
 Tests for the consistency pass's invariant error: a named class whose message
 says what broke, behind the word the coverage census looks for.

 @module
 */

import {
  DEFAULT_CONCURRENCY,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  ConsistencyInvariantError,
  exchangeFailureText,
} from '../dist/final/node/index.mjs';

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: ConsistencyInvariantError.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'SAYS WHAT BROKE, behind the word the coverage census and a reader look for',
          fn: async () => {
            const error = new ConsistencyInvariantError({ invariant: 'a group lists no place', },);
            expect({
              name: error.name,
              message: error.message,
              isError: Error.isError(error,),
            },).toEqual({
              name: 'ConsistencyInvariantError',
              message: 'unreachable: a group lists no place',
              isError: true,
            },);
          },
        },),
        it({
          name: 'RECORDS ONLY ITS CLASS NAME where a failure is recorded, its sentence staying with the log and the stack',
          fn: async () => {
            expect(exchangeFailureText({
              error: new ConsistencyInvariantError({ invariant: 'a group lists no place', },),
            },),).toBe('refused by ConsistencyInvariantError',);
          },
        },),
      ],
    },),
  ],
},);
