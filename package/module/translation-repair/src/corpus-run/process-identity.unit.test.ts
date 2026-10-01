/**
 Tests for reading which process a process id names (ledger A16).

 Linux only: the reads come from `/proc`, and the cases assert this host
 answers before reading anything else, so a host without it fails loudly
 rather than passing on nothing read.

 @module
 */

import {
  DEFAULT_CONCURRENCY,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  hostIdentity,
  startTicksOf,
} from '../../dist/final/node/index.mjs';

/**
 Process id no process can hold: above the kernel's largest (`pid_max` is at
 most 4194304), so nothing is ever read under it.
 */
const GONE_PID = 2_147_483_646;

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: startTicksOf.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'READS the same start time twice for one living process, so a lock naming it matches',
          fn: async () => {
            /**
             Two reads of this process.
             */
            const [
              first,
              second,
            ] = await Promise.all([
              startTicksOf({ pid: process.pid, },),
              startTicksOf({ pid: process.pid, },),
            ],);
            expect(first.kind,).toBe('read',);
            expect(second,).toStrictEqual(first,);
          },
        },),
        it({
          name: 'READS another start time for another process, the control that a mismatch can show',
          fn: async () => {
            /**
             This process and the first process on the system.
             */
            const [
              mine,
              init,
            ] = await Promise.all([
              startTicksOf({ pid: process.pid, },),
              startTicksOf({ pid: 1, },),
            ],);
            expect(init.kind,).toBe('read',);
            expect(init,).not.toStrictEqual(mine,);
          },
        },),
        it({
          name: 'READS NOTHING for a process id no process holds',
          fn: async () => {
            expect(await startTicksOf({ pid: GONE_PID, },),).toStrictEqual({ kind: 'unread', },);
          },
        },),
      ],
    },),

    describe({
      name: hostIdentity.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'READS this machine, its boot and its process-id namespace',
          fn: async () => {
            /**
             This host's identity.
             */
            const read = await hostIdentity();
            expect(read.kind,).toBe('read',);
            if (read.kind === 'read') {
              expect(read.here.bootId.length,).toBeGreaterThan(0,);
              expect(read.here.pidNamespace.startsWith('pid:[',),).toBe(true,);
              expect(read.here.host.length,).toBeGreaterThan(0,);
            }
          },
        },),
      ],
    },),
  ],
},);
