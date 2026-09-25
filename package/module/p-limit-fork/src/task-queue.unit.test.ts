/**
 Tests for FIFO queue semantics of scheduled calls, exercised through the
 public `pLimit` entry point (the queue itself is package-internal).
 
 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { pLimit, } from '../dist/final/neutral/index.mjs';

import {
  createGate,
  type Gate,
  yieldTurn,
} from './test-support.ts';

await describe({
  name: 'task queue behavior',
  children: [
    it({
      name: 'admits queued calls in FIFO order one slot at a time',
      fn: async () => {
        const limit = pLimit(1,);
        /**
         Start order recorded by every call as its function runs.
         */
        const started: string[] = [];
        /**
         Gates keyed by call id, released in a deliberate order.
         */
        const gates = new Map<string, Gate>();
        for (const id of [
          'first',
          'second',
          'third',
        ]) {
          /**
           Gate for this call, opened by the test below.
           */
          const gate = createGate();
          gates.set(id, gate);
          void limit({
            fn: async function gatedCall(): Promise<string> {
              started.push(id,);
              await gate.open;
              return id;
            },
            args: [],
          },);
        }

        await yieldTurn();
        expect(started,).toEqual([
          'first',
        ],);

        gates.get('first',)
          ?.release();
        await yieldTurn();
        expect(started,).toEqual([
          'first',
          'second',
        ],);

        gates.get('second',)
          ?.release();
        gates.get('third',)
          ?.release();
        await yieldTurn();
        expect(started,).toEqual([
          'first',
          'second',
          'third',
        ],);
      },
    },),

    it({
      name: 'admits a whole freed batch in FIFO order',
      fn: async () => {
        const limit = pLimit(1,);
        /**
         Start order recorded by every call as its function runs.
         */
        const started: string[] = [];
        /**
         Gates for the three blocked calls, released at the end.
         */
        const gates: Gate[] = [];
        for (const id of [
          'a',
          'b',
          'c',
        ]) {
          /**
           Gate for this call, opened by the test below.
           */
          const gate = createGate();
          gates.push(gate,);
          void limit({
            fn: async function gatedCall(): Promise<string> {
              started.push(id,);
              await gate.open;
              return id;
            },
            args: [],
          },);
        }

        await yieldTurn();
        expect(started,).toEqual([
          'a',
        ],);
        expect(limit.pendingCount,).toBe(2,);

        limit.concurrency = 3;
        await yieldTurn();
        expect(started,).toEqual([
          'a',
          'b',
          'c',
        ],);
        expect(limit.pendingCount,).toBe(0,);
        for (const gate of gates)
          gate.release();
        await yieldTurn();
        expect(limit.activeCount,).toBe(0,);
      },
    },),

    it({
      name: 'reports queued calls through pendingCount and empties the queue in order',
      fn: async () => {
        const limit = pLimit(2,);
        /**
         Gates for the two calls that occupy both slots immediately.
         */
        const gates = [
          createGate(),
          createGate(),
        ];
        for (const gate of gates)
          void limit({
            fn: async function blockedCall(): Promise<void> {
              await gate.open;
            },
            args: [],
          },);

        void limit({
          fn: function queuedCall(): number {
            return 1;
          },
          args: [],
        },);
        void limit({
          fn: function queuedCallTwo(): number {
            return 2;
          },
          args: [],
        },);
        await yieldTurn();
        expect(limit.pendingCount,).toBe(2,);
        expect(limit.activeCount,).toBe(2,);

        for (const gate of gates)
          gate.release();
        await yieldTurn();
        expect(limit.pendingCount,).toBe(0,);
        expect(limit.activeCount,).toBe(0,);
      },
    },),
  ],
},);
