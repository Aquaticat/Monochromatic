import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { createNoopSink, } from './noop.ts';

await describe({
  name: 'noop sink',
  children: [
    it({
      name: 'verifies as available',
      fn: async () => {
        const sink = createNoopSink();
        expect(await sink.verify(),)
          .toBe(true,);
      },
    },),

    it({
      name: 'discards writes without throwing and exposes no flush hook',
      fn: async () => {
        const sink = createNoopSink();
        await expect(
          sink.write({
            level: 'info',
            message: 'discarded',
            timestamp: 0,
          },),
        )
          .resolves
          .toBeUndefined();
        expect(sink.flush,)
          .toBeUndefined();
      },
    },),
  ],
},);
