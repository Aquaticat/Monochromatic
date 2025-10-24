import { describe, expectTypeOf, test } from 'vitest';

import { customParserForArray } from './customParsers.ts';
import * as Jsonc from '../../../../t/index.ts';
import type { FragmentStringJsonc } from '@_/types/t string/t hasQuotedSyntax/t doubleQuote/t jsonc/t/index.ts';

describe('types: customParserForArray', () => {
  test('return type is Jsonc.Array & { remainingContent }', () => {
    type Ret = ReturnType<typeof customParserForArray>;
    type Expected = Jsonc.Array & { remainingContent: FragmentStringJsonc };
    expectTypeOf<Ret>().toEqualTypeOf<Expected>();
  });
});
