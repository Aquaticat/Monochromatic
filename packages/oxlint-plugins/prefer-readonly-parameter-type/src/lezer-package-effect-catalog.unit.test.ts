import { readFileSync, } from 'node:fs';
import { fileURLToPath, } from 'node:url';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  closeSemanticBridge,
  intrinsicEffect,
  intrinsicEffectQuery,
  NO_INTRINSIC_EFFECT,
  NO_INTRINSIC_QUERY,
  openSemanticFile,
} from '../dist/final/node/index.mjs';
import { isPropertyAccessExpression, } from 'typescript/unstable/ast/is';

/**
 * File-enforcer XML source containing Lezer navigation calls.
 */
const XML_SOURCE_PATH = fileURLToPath(new URL(
  '../../../dev-script/file-enforcer/src/pipeline/xml.ts',
  import.meta.url,
),);

/**
 * XML source text used for exact declaration resolution.
 */
const XML_SOURCE = readFileSync(XML_SOURCE_PATH, 'utf8',);

await describe({
  name: 'Lezer package effects',
  children: [
    it({
      name: 'resolves observational syntax-node navigation with result provenance',
      fn: async () => {
        const session = openSemanticFile({
          fileName: XML_SOURCE_PATH,
          sourceText: XML_SOURCE,
          hasBOM: false,
        },);
        const pattern = 'element.getChild';
        const member = session.nodeAtOffset(
          XML_SOURCE.indexOf(pattern,) + pattern.lastIndexOf('.',) + 1,
        );
        const propertyAccess = member.parent;
        if (!isPropertyAccessExpression(propertyAccess,))
          throw new Error('Expected Lezer property access.',);
        const receiverType = session.checker.getTypeAtLocation(propertyAccess.expression,);
        const memberSymbol = session.checker.getSymbolAtLocation(propertyAccess.name,);
        if ((receiverType === undefined) || (memberSymbol === undefined))
          throw new Error('Expected Lezer semantic identity.',);
        const query = intrinsicEffectQuery({
          project: session.project,
          receiverType,
          memberSymbol,
        },);
        if (query === NO_INTRINSIC_QUERY)
          throw new Error('Expected Lezer intrinsic query.',);
        const effect = intrinsicEffect(query,);
        closeSemanticBridge();
        expect(effect,).not.toBe(NO_INTRINSIC_EFFECT,);
        if (effect === NO_INTRINSIC_EFFECT)
          throw new Error('Expected Lezer getChild effect.',);
        expect(effect.targets,).toEqual([],);
        expect(effect.receiverValuesReachResult,).toBe(true,);
      },
    },),
  ],
},);
