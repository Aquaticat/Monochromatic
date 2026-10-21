/**
 Unit tests for the Advisor session-event accounting sink.
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { appendAdvisorOperationRecord, } from '../dist/final/node/index.mjs';

/**
 Argument shape of the session-event accounting sink.
 */
type AppendRecordOptions = Parameters<typeof appendAdvisorOperationRecord>[0];

await describe({
  name: appendAdvisorOperationRecord.name,
  children: [
    it({
      name: 'appends the operation record as an advisor/operation event',
      fn: async () => {
        const appended: unknown[][] = [];
        const session = {
          append: (type: string, data: unknown): void => {
            appended.push([type, data,],);
          },
        } as unknown as AppendRecordOptions['session'];
        const operation = {
          id: 'op-1',
        } as unknown as AppendRecordOptions['operation'];
        appendAdvisorOperationRecord({
          session,
          operation,
        },);
        expect(appended,).toEqual([
          ['advisor/operation', operation,],
        ],);
      },
    },),
  ],
},);
