import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  AnswerHelperStartupTimeoutError,
  createAnswerChannel,
} from '../dist/final/node/index.mjs';

await describe({
  name: 'answer helper startup deadline',
  children: [
    it({
      name: 'reports failed startup rather than generic user cancellation',
      timeout: 40_000,
      fn: async () => {
        await using channel = await createAnswerChannel();
        let caught: unknown;
        try {
          await channel.wait({},);
        }
        catch (error: unknown) {
          caught = error;
        }
        expect(caught,).toBeInstanceOf(AnswerHelperStartupTimeoutError,);
        if (!(caught instanceof AnswerHelperStartupTimeoutError))
          throw new Error('Expected helper startup timeout.',);
        expect(caught.message,).toContain('30 seconds',);
        expect(caught.message,).toContain('detached terminal',);
        expect(caught.cause,).toBeInstanceOf(Error,);
      },
    },),
    it({
      name: 'preserves caller abort instead of claiming startup timeout',
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
        expect(caught,).not.toBeInstanceOf(AnswerHelperStartupTimeoutError,);
      },
    },),
  ],
},);
