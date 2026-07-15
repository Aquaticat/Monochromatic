import { readFileSync, } from 'node:fs';
import { fileURLToPath, } from 'node:url';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  buildEffectSummaryIndex,
  closeSemanticBridge,
  intrinsicEffect,
  intrinsicEffectQuery,
  NO_EFFECT_SUMMARY,
  NO_INTRINSIC_EFFECT,
  openSemanticFile,
} from '../dist/final/node/index.mjs';
import {
  isFunctionLikeDeclaration,
  isPropertyAccessExpression,
} from 'typescript/unstable/ast/is';

/**
 * Build-tool source used for exact PostCSS declaration provenance.
 */
const MIXIN_SOURCE_PATH = fileURLToPath(new URL(
  '../../../build-tool/css/src/mixin.ts',
  import.meta.url,
),);

/**
 * Build-tool source text containing audited PostCSS calls.
 */
const MIXIN_SOURCE = readFileSync(MIXIN_SOURCE_PATH, 'utf8',);

/**
 * Overlay source covering each `walkAtRules` callback overload.
 */
const WALK_OVERLOAD_SOURCE = `
import type { AtRule, Root } from 'postcss';
export function walkOne(root: Root, callback: (node: AtRule) => void): void {
  root.walkAtRules(callback);
}
export function walkTwo(root: Root, callback: (node: AtRule) => void): void {
  root.walkAtRules('mixin', callback);
}
`;

/**
 * Resolves intrinsic identity for one property access in source text.
 *
 * @param session - Open semantic session for source file
 *
 * @param sourceText - Source text containing member access
 *
 * @param pattern - Complete receiver and member text to locate
 *
 * @returns Exact intrinsic effect query
 *
 * @example
 * ```ts
 * queryForPattern({ session, sourceText, pattern: 'root.walkAtRules' });
 * ```
 */
function queryForPattern({
  session,
  sourceText,
  pattern,
}: {
  readonly session: ReturnType<typeof openSemanticFile>;
  readonly sourceText: string;
  readonly pattern: string;
}): ReturnType<typeof intrinsicEffectQuery> {
  const memberOffset = sourceText.indexOf(pattern,) + pattern.lastIndexOf('.',) + 1;
  const memberNode = session.nodeAtOffset(memberOffset,);
  const propertyAccess = memberNode.parent;
  if (!isPropertyAccessExpression(propertyAccess,))
    throw new Error(`Expected property access for ${pattern}.`,);
  const receiverType = session.checker.getTypeAtLocation(propertyAccess.expression,);
  const memberSymbol = session.checker.getSymbolAtLocation(propertyAccess.name,);
  if ((receiverType === undefined) || (memberSymbol === undefined))
    throw new Error(`Expected semantic identity for ${pattern}.`,);
  return intrinsicEffectQuery({
    project: session.project,
    receiverType,
    memberSymbol,
  },);
}

await describe({
  name: 'PostCSS package effects',
  children: [
    it({
      name: 'records traversal mutation and callback relations',
      fn: async () => {
        const effect = intrinsicEffect({
          provenance: {
            kind: 'package',
            packageName: 'postcss',
            major: 8,
          },
          ownerType: 'Container_',
          member: 'walkAtRules',
        },);
        expect(effect,).not.toBe(NO_INTRINSIC_EFFECT,);
        if (effect === NO_INTRINSIC_EFFECT)
          throw new Error('Expected PostCSS traversal effect.',);
        expect(effect.targets,).toEqual([
          { kind: 'receiver', },
          {
            kind: 'argument',
            index: 0,
            callArgumentCount: 2,
          },
        ],);
        expect(effect.invokedArguments,).toEqual([
          { argumentIndex: 0, callArgumentCount: 1, },
          { argumentIndex: 1, callArgumentCount: 2, },
        ],);
        expect(effect.callbacks,).toEqual([
          {
            argumentIndex: 0,
            receiverParameterIndexes: [0,],
            callArgumentCount: 1,
          },
          {
            argumentIndex: 1,
            receiverParameterIndexes: [0,],
            callArgumentCount: 2,
          },
        ],);
      },
    },),
    it({
      name: 'records clone result provenance and exact package major',
      fn: async () => {
        const effect = intrinsicEffect({
          provenance: {
            kind: 'package',
            packageName: 'postcss',
            major: 8,
          },
          ownerType: 'AtRule_',
          member: 'clone',
        },);
        expect(effect,).not.toBe(NO_INTRINSIC_EFFECT,);
        if (effect === NO_INTRINSIC_EFFECT)
          throw new Error('Expected PostCSS clone effect.',);
        expect(effect.targets,).toEqual([],);
        expect(effect.opaqueTargets,).toEqual([
          { kind: 'receiver', },
          { kind: 'argument', index: 0, },
        ],);
        expect(effect.receiverValuesReachResult,).toBe(true,);
        expect(intrinsicEffect({
          provenance: {
            kind: 'package',
            packageName: 'postcss',
            major: 7,
          },
          ownerType: 'AtRule_',
          member: 'clone',
        },),).toBe(NO_INTRINSIC_EFFECT,);
      },
    },),
    it({
      name: 'distinguishes PostCSS observation uncertainty from mutation',
      fn: async () => {
        const error = intrinsicEffect({
          provenance: {
            kind: 'package',
            packageName: 'postcss',
            major: 8,
          },
          ownerType: 'Node_',
          member: 'error',
        },);
        const remove = intrinsicEffect({
          provenance: {
            kind: 'package',
            packageName: 'postcss',
            major: 8,
          },
          ownerType: 'Node_',
          member: 'remove',
        },);
        const toString = intrinsicEffect({
          provenance: {
            kind: 'package',
            packageName: 'postcss',
            major: 8,
          },
          ownerType: 'Node_',
          member: 'toString',
        },);
        expect(error,).not.toBe(NO_INTRINSIC_EFFECT,);
        expect(remove,).not.toBe(NO_INTRINSIC_EFFECT,);
        expect(toString,).not.toBe(NO_INTRINSIC_EFFECT,);
        if ((error === NO_INTRINSIC_EFFECT)
          || (remove === NO_INTRINSIC_EFFECT)
          || (toString === NO_INTRINSIC_EFFECT))
          throw new Error('Expected PostCSS Node effects.',);
        expect(error.targets,).toEqual([],);
        expect(error.opaqueTargets,).toEqual([
          { kind: 'receiver', },
          { kind: 'argument', index: 1, },
        ],);
        expect(remove.targets,).toEqual([{ kind: 'receiver', },],);
        expect(toString.targets,).toEqual([],);
        expect(toString.opaqueTargets,).toEqual([{ kind: 'receiver', },],);
        expect(toString.invokedArgumentIndexes,).toEqual([0,],);
      },
    },),
    it({
      name: 'selects callback positions by walk overload arity',
      fn: async () => {
        const session = openSemanticFile({
          fileName: MIXIN_SOURCE_PATH,
          sourceText: WALK_OVERLOAD_SOURCE,
          hasBOM: false,
        },);
        const index = buildEffectSummaryIndex({
          project: session.project,
          activeSourceFile: session.sourceFile,
        },);
        const summaries = [
          'walkOne',
          'walkTwo',
        ].map(function walkSummary(functionName,) {
          const nameNode = session.nodeAtOffset(WALK_OVERLOAD_SOURCE.indexOf(functionName,),);
          const declaration = nameNode.parent;
          if (!isFunctionLikeDeclaration(declaration,))
            throw new Error(`Expected function declaration for ${functionName}.`,);
          const summary = index.get(declaration,);
          if (summary === NO_EFFECT_SUMMARY)
            throw new Error(`Expected effect summary for ${functionName}.`,);
          return {
            functionName,
            mutated: [...summary.referentMutatedParameterIndexes,],
            invoked: [...summary.invokedParameterIndexes,],
            opaque: [...summary.opaqueParameterIndexes,],
          };
        },);
        closeSemanticBridge();
        expect(summaries,).toEqual([
          {
            functionName: 'walkOne',
            mutated: [0,],
            invoked: [1,],
            opaque: [],
          },
          {
            functionName: 'walkTwo',
            mutated: [0,],
            invoked: [1,],
            opaque: [],
          },
        ],);
      },
    },),
    it({
      name: 'resolves exact PostCSS owners from build-tool source',
      fn: async () => {
        const session = openSemanticFile({
          fileName: MIXIN_SOURCE_PATH,
          sourceText: MIXIN_SOURCE,
          hasBOM: false,
        },);
        const queries = [
          'root.walkAtRules',
          'child.clone',
          'node.error',
          'node.remove',
          'node.replaceWith',
        ].map(function postcssQuery(pattern,) {
          return queryForPattern({
            session,
            sourceText: MIXIN_SOURCE,
            pattern,
          },);
        },);
        closeSemanticBridge();
        expect(queries,).toEqual([
          {
            provenance: { kind: 'package', packageName: 'postcss', major: 8, },
            ownerType: 'Container_',
            member: 'walkAtRules',
          },
          {
            provenance: { kind: 'package', packageName: 'postcss', major: 8, },
            ownerType: 'AtRule_',
            member: 'clone',
          },
          {
            provenance: { kind: 'package', packageName: 'postcss', major: 8, },
            ownerType: 'Node_',
            member: 'error',
          },
          {
            provenance: { kind: 'package', packageName: 'postcss', major: 8, },
            ownerType: 'Node_',
            member: 'remove',
          },
          {
            provenance: { kind: 'package', packageName: 'postcss', major: 8, },
            ownerType: 'Node_',
            member: 'replaceWith',
          },
        ],);
      },
    },),
  ],
},);
