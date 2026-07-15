/**
 * Deterministic bounded asynchronous mapping tests.
 *
 * @module
 */
import { wait, } from '@monochromatic-dev/module-async-time/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { mapBounded, } from './map-bounded.ts';

await describe({
  name: mapBounded.name,
  children: [
    it({
      name: 'rejects nonpositive concurrency',
      fails: true,
      fn: async function testInvalidConcurrency() {
        await mapBounded({
          values: ['value',],
          concurrency: 0,
          map: async function identity({ value, }) {
            return value;
          },
        },);
      },
    },),
    it({
      name: 'returns empty output without invoking mapper',
      fn: async function testEmptyInput() {
        expect(await mapBounded({
          values: [],
          concurrency: 1,
          map: function rejectUnexpectedMapper(): Promise<never> {
            return Promise.reject(new Error('Empty bounded map invoked mapper.',),);
          },
        },),).toEqual([],);
      },
    },),
    it({
      name: 'preserves input order across concurrent lanes',
      fn: async function testStableOrder() {
        expect(await mapBounded({
          values: [
            2,
            0,
            1,
          ],
          concurrency: 2,
          map: async function delayedValue({ value, }) {
            await wait(value,);
            return String(value,);
          },
        },),).toEqual([
          '2',
          '0',
          '1',
        ],);
      },
    },),
  ],
},);
