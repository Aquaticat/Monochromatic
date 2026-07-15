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
 * Call sites covering both audited Optique entry points.
 */
const CALL_SITES = [
  {
    fileName: fileURLToPath(new URL(
      '../../../git-policy/cli/src/parser/status.ts',
      import.meta.url,
    ),),
    member: 'parseSync',
    argsIndex: 1,
    optionsIndex: 2,
  },
  {
    fileName: fileURLToPath(new URL(
      '../../../git-policy/cli/src/management.ts',
      import.meta.url,
    ),),
    member: 'runParserSync',
    argsIndex: 2,
    optionsIndex: 3,
  },
] as const;

await describe({
  name: 'Optique package effects',
  children: [
    it({
      name: 'keeps argument buffers observational while retaining capabilities',
      fn: async () => {
        const effects = CALL_SITES.map(function resolveEffect(callSite,) {
          const sourceText = readFileSync(callSite.fileName, 'utf8',);
          const session = openSemanticFile({
            fileName: callSite.fileName,
            sourceText,
            hasBOM: false,
          },);
          const identifier = session.nodeAtOffset(
            sourceText.indexOf(`${callSite.member}(`,) + 1,
          );
          if (!isIdentifier(identifier,))
            throw new Error(`Expected identifier for ${callSite.member}.`,);
          const symbol = session.checker.getResolvedSymbol(identifier,);
          const query = symbol === undefined
            ? NO_INTRINSIC_QUERY
            : intrinsicCallableEffectQuery({
              project: session.project,
              memberSymbol: symbol,
            },);
          if (query === NO_INTRINSIC_QUERY)
            throw new Error(`Expected Optique identity for ${callSite.member}.`,);
          const effect = intrinsicEffect(query,);
          closeSemanticBridge();
          if (effect === NO_INTRINSIC_EFFECT)
            throw new Error(`Expected Optique effect for ${callSite.member}.`,);
          return {
            member: callSite.member,
            targets: effect.targets,
            opaqueTargets: effect.opaqueTargets,
            argsIndex: callSite.argsIndex,
            optionsIndex: callSite.optionsIndex,
          };
        },);
        expect(effects,).toEqual([
          {
            member: 'parseSync',
            targets: [],
            opaqueTargets: [
              { kind: 'argument', index: 0, },
              { kind: 'argument', index: 2, },
            ],
            argsIndex: 1,
            optionsIndex: 2,
          },
          {
            member: 'runParserSync',
            targets: [],
            opaqueTargets: [
              { kind: 'argument', index: 0, },
              { kind: 'argument', index: 3, },
            ],
            argsIndex: 2,
            optionsIndex: 3,
          },
        ],);
      },
    },),
  ],
},);
