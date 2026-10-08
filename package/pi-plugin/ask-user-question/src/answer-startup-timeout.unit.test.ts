import { once, } from 'node:events';
import { createConnection, } from 'node:net';

import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';

import { createAnswerChannel, } from '../dist/final/node/index.mjs';

//region Startup cancellation

await describe({
  name: 'answer channel cancellation',
  children: [
    it({
      name: 'preserves caller cancellation while no helper has started',
      fn: async () => {
        await using channel = await createAnswerChannel();
        const controller = new AbortController();
        controller.abort();
        let caught: unknown;
        try {
          await channel.wait({ signal: controller.signal, },);
        }
        catch (error: unknown) {
          caught = error;
        }
        expect(caught,).toBeInstanceOf(Error,);
        expect(caught,).toHaveProperty('cause', controller.signal.reason,);
      },
    },),
    it({
      name: 'disposes unauthenticated sockets without hanging shutdown',
      fn: async () => {
        const channel = await createAnswerChannel();
        const socket = createConnection({ host: channel.host, port: channel.port, },);
        try {
          await once(socket, 'connect',);
          const closed = once(socket, 'close',);
          socket.resume();
          await channel[Symbol.asyncDispose]();
          await closed;
          expect(socket.destroyed,).toBe(true,);
        }
        finally {
          socket.destroy();
          await channel[Symbol.asyncDispose]();
        }
      },
    },),
  ],
},);

//endregion Startup cancellation
