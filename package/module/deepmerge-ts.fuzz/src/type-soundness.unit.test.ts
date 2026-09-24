/**
 Runtime replay of the generated type-level soundness corpus.

 `./type-soundness.generated.ts` is checked by `lint:types`: every case
 assigns deepmerge-ts's runtime result, written as a literal at generation
 time, to the call's static result type. This test reruns each call and
 confirms it still returns that literal, so the corpus cannot silently drift
 from the build under test (an upgrade or `DEEPMERGE_FUZZ_TARGET` override).
 On failure, regenerate with the `generate:type-cases` task and re-run
 `lint:types`.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { TYPE_CASES, } from './type-soundness.generated.ts';

await describe({
  name: 'type-level soundness corpus',
  children: [
    it({
      name: 'every generated call still returns the literal its type was checked against',
      fn: async () => {
        expect(TYPE_CASES.length,).toBeGreaterThan(0,);
        for (const [index, run,] of TYPE_CASES.entries()) {
          /**
           Fresh call result and the literal recorded at generation time.
           */
          const { merged, value, } = run();
          expect({ index, merged, },).toEqual({ index, merged: value, },);
        }
      },
    },),
  ],
},);
