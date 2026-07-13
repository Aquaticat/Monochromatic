import { readFileSync, } from 'node:fs';
import { fileURLToPath, } from 'node:url';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  closeSemanticBridge,
  INTRINSIC_EFFECTS,
  intrinsicEffect,
  intrinsicEffectQuery,
  NO_INTRINSIC_EFFECT,
  NO_INTRINSIC_QUERY,
  openSemanticFile,
} from '../dist/final/node/index.mjs';
import { isPropertyAccessExpression, } from 'typescript/unstable/ast/is';

/** Intrinsic-provenance source fixture. */
const FIXTURE_PATH = fileURLToPath(new URL(
  '../../../test-fixture/oxlint-no-restricted-syntax/src/valid/typescript-sync-adapter.ts',
  import.meta.url,
),);

/** Current fixture source text. */
const SOURCE = readFileSync(
  FIXTURE_PATH,
  'utf8',
);

await describe({
  name: intrinsicEffect.name,
  children: [
    it({
      name: 'matches exact ECMAScript owner and member symbols',
      fn: async () => {
        const effect = intrinsicEffect({
          provenance: { kind: 'ecmascript', },
          ownerType: 'Set',
          member: 'add',
        },);
        expect(effect,).not.toBe(NO_INTRINSIC_EFFECT,);
        if (effect === NO_INTRINSIC_EFFECT)
          throw new Error('Expected Set.add intrinsic effect.',);
        expect(effect.targets,).toEqual([{ kind: 'receiver', },],);
      },
    },),
    it({
      name: 'matches audited observational intrinsics with no mutation targets',
      fn: async () => {
        const arrayCheck = intrinsicEffect({
          provenance: { kind: 'ecmascript', },
          ownerType: 'ArrayConstructor',
          member: 'isArray',
        },);
        expect(arrayCheck,).not.toBe(NO_INTRINSIC_EFFECT,);
        if (arrayCheck === NO_INTRINSIC_EFFECT)
          throw new Error('Expected Array.isArray observational effect.',);
        expect(arrayCheck.targets,).toEqual([],);
      },
    },),
    it({
      name: 'does not match method name on another owner',
      fn: async () => {
        expect(intrinsicEffect({
          provenance: { kind: 'ecmascript', },
          ownerType: 'Array',
          member: 'add',
        },),).toBe(NO_INTRINSIC_EFFECT,);
      },
    },),
    it({
      name: 'gates package effects by exact major version',
      fn: async () => {
        expect(intrinsicEffect({
          provenance: {
            kind: 'package',
            packageName: 'typescript',
            major: 7,
          },
          ownerType: 'API',
          member: 'updateSnapshot',
        },),).not.toBe(NO_INTRINSIC_EFFECT,);
        expect(intrinsicEffect({
          provenance: {
            kind: 'package',
            packageName: 'typescript',
            major: 6,
          },
          ownerType: 'API',
          member: 'updateSnapshot',
        },),).toBe(NO_INTRINSIC_EFFECT,);
      },
    },),
    it({
      name: 'resolves exact ECMAScript and DOM declaration provenance',
      fn: async () => {
        const session = openSemanticFile({
          fileName: FIXTURE_PATH,
          sourceText: SOURCE,
          hasBOM: false,
        },);
        const queries = [
          'values.add',
          'controller.abort',
          'Array.isArray',
          'Object.is',
        ].map(function queryMember(memberText,) {
          const memberOffset = SOURCE.indexOf(memberText,) + memberText.indexOf('.',) + 1;
          const memberNode = session.nodeAtOffset(memberOffset,);
          const propertyAccess = memberNode.parent;
          if (!isPropertyAccessExpression(propertyAccess,))
            throw new Error(`Expected property access for ${memberText}.`,);
          const receiverType = session.checker.getTypeAtLocation(propertyAccess.expression,);
          const memberSymbol = session.checker.getSymbolAtLocation(propertyAccess.name,);
          if ((receiverType === undefined) || (memberSymbol === undefined))
            throw new Error(`Expected semantic receiver and member for ${memberText}.`,);
          return intrinsicEffectQuery({
            project: session.project,
            receiverType,
            memberSymbol,
          },);
        },);
        closeSemanticBridge();

        expect(queries,).toEqual([
          {
            provenance: { kind: 'ecmascript', },
            ownerType: 'Set',
            member: 'add',
          },
          {
            provenance: { kind: 'dom', },
            ownerType: 'AbortController',
            member: 'abort',
          },
          {
            provenance: { kind: 'ecmascript', },
            ownerType: 'ArrayConstructor',
            member: 'isArray',
          },
          {
            provenance: { kind: 'ecmascript', },
            ownerType: 'ObjectConstructor',
            member: 'is',
          },
        ],);
        expect(queries,).not.toContain(NO_INTRINSIC_QUERY,);
      },
    },),
    it({
      name: 'records evidence for every audited entry',
      fn: async () => {
        expect(INTRINSIC_EFFECTS.every(function hasEvidence(entry,): boolean {
          return entry.evidence.length > 0;
        },),).toBe(true,);
      },
    },),
  ],
},);
