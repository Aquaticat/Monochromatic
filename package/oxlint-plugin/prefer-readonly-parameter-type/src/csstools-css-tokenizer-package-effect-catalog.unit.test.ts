import { readFileSync, } from 'node:fs';
import { fileURLToPath, } from 'node:url';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  closeSemanticBridge,
  intrinsicCallableEffectQuery,
  intrinsicEffect,
  NO_INTRINSIC_EFFECT,
  NO_INTRINSIC_QUERY,
  openSemanticFile,
} from '../dist/final/node/index.mjs';
import { isIdentifier, } from 'typescript/unstable/ast/is';

/**
 * css-edit source containing a token-type guard call.
 */
const CALL_SITE_PATH = fileURLToPath(new URL(
  '../../../module/css-edit/src/token.ts',
  import.meta.url,
),);

await describe({
  name: '@csstools/css-tokenizer package effects',
  children: [
    it({
      name: 'records token-type guards as pure discriminant reads',
      fn: async () => {
        const sourceText = readFileSync(CALL_SITE_PATH, 'utf8',);
        const session = openSemanticFile({
          fileName: CALL_SITE_PATH,
          sourceText,
          hasBOM: false,
        },);
        const identifier = session.nodeAtOffset(sourceText.indexOf('isTokenWhitespace(',) + 1,);
        if (!isIdentifier(identifier,))
          throw new Error('Expected isTokenWhitespace identifier.',);
        const symbol = session.checker.getResolvedSymbol(identifier,);
        const query = symbol === undefined
          ? NO_INTRINSIC_QUERY
          : intrinsicCallableEffectQuery({
            project: session.project,
            memberSymbol: symbol,
          },);
        if (query === NO_INTRINSIC_QUERY)
          throw new Error('Expected @csstools/css-tokenizer package identity.',);
        const effect = intrinsicEffect(query,);
        closeSemanticBridge();
        if (effect === NO_INTRINSIC_EFFECT)
          throw new Error('Expected @csstools/css-tokenizer effect.',);
        expect(effect.targets,).toEqual([],);
        expect(effect.opaqueTargets,).toBe(undefined,);
      },
    },),
  ],
},);
