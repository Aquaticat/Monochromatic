import {
  pipeAsync,
  pipedAsync,
} from './function.pipe.ts';

import {
  logtapeConfiguration,
  logtapeConfigure,
  suite,
  test,
} from '@monochromatic-dev/module-es/ts';
import {
  assert,
  assert1,
} from './error.ts';

await logtapeConfigure(logtapeConfiguration());

suite('pipedAsync', [
  test('input', async () => {
    assert1(
      await pipedAsync(1),
    );
  }),

  test('fn1', async () => {
    assert(2, await pipedAsync(
      1,
      (i) => i + 1,
    ));
  }),

  test('async fn1', async () => {
    assert(2, await pipedAsync(
      1,
      async (i) => i + 1,
    ));
  }),

  test('fn2', async () => {
    assert(4, await pipedAsync(
      1,
      (i) => i + 1,
      (i) => i + 2,
    ));
  }),
]);
