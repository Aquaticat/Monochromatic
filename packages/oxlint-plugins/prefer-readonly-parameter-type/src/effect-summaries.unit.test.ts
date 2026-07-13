import { readFileSync, } from 'node:fs';
import { fileURLToPath, } from 'node:url';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { isFunctionLikeDeclaration, } from 'typescript/unstable/ast/is';

import {
  buildEffectSummaryIndex,
  clearEffectSummaryCache,
  closeSemanticBridge,
  effectSummaryCacheStats,
  NO_EFFECT_SUMMARY,
  openSemanticFile,
} from '../dist/final/node/index.mjs';

/** Effect summary semantic fixture. */
const FIXTURE_PATH = fileURLToPath(new URL(
  '../../../test-fixture/oxlint-no-restricted-syntax/src/valid/typescript-sync-adapter.ts',
  import.meta.url,
),);

/** Current effect fixture text. */
const SOURCE = readFileSync(
  FIXTURE_PATH,
  'utf8',
);

await describe({
  name: buildEffectSummaryIndex.name,
  concurrency: 1,
  children: [
    it({
      name: 'propagates direct, cross-file, and immediate callback mutation',
      fn: async () => {
        const session = openSemanticFile({
          fileName: FIXTURE_PATH,
          sourceText: SOURCE,
          hasBOM: false,
        },);
        const index = buildEffectSummaryIndex({
          project: session.project,
          activeSourceFile: session.sourceFile,
        },);
        const effects = [
          'directSemanticEffect',
          'mutatePackagedState',
          'packagedSemanticEffect',
          'crossFileSemanticEffect',
          'callbackSemanticEffect',
          'directCallbackEffect',
          'asyncIteratorEffect',
          'arrayCallbackSemanticEffect',
          'aliasedCallbackSemanticEffect',
          'noSemanticEffect',
          'observationalIntrinsicEffect',
          'primitiveArraySortObservationEffect',
          'textEncoderObservationEffect',
          'objectArraySortOpaqueEffect',
          'observationalValueEffects',
          'pathObservationEffect',
          'dateObservationEffect',
          'fileUrlObservationEffect',
          'direntObservationEffect',
          'aliasSemanticEffect',
          'assignedAliasSemanticEffect',
          'reboundParameterSemanticEffect',
          'destructuredAliasSemanticEffect',
          'destructuredParameterSemanticEffect',
          'opaqueSemanticEffect',
          'primitiveOpaqueArgumentEffect',
          'packagedPrimitiveOpaqueArgumentEffect',
          'transitiveOpaqueSemanticEffect',
          'unusedClosureSemanticEffect',
          'calledClosureSemanticEffect',
          'returnedClosureSemanticEffect',
          'passedClosureSemanticEffect',
          'aliasedPassedClosureSemanticEffect',
          'unusedFunctionExpressionSemanticEffect',
          'returnedContainerClosureSemanticEffect',
          'passedContainerClosureSemanticEffect',
          'deadParentClosureSemanticEffect',
          'storedClosureSemanticEffect',
        ].map(function summaryFor(functionName,) {
          const nameNode = session.nodeAtOffset(SOURCE.indexOf(functionName,),);
          const declaration = nameNode.parent;
          if (!isFunctionLikeDeclaration(declaration,))
            throw new Error(`Expected function declaration for ${functionName}.`,);
          const summary = index.get(declaration,);
          if (summary === NO_EFFECT_SUMMARY)
            throw new Error(`Expected effect summary for ${functionName}.`,);
          return {
            functionName,
            mutated: [...summary.mutatedParameterIndexes,],
            opaque: [...summary.opaqueParameterIndexes,],
          };
        },);
        /** Transitive opaque callable declaration. */
        const transitiveNameNode = session.nodeAtOffset(
          SOURCE.indexOf('transitiveOpaqueSemanticEffect',),
        );
        /** Parent function declaration for transitive opaque callable. */
        const transitiveDeclaration = transitiveNameNode.parent;
        if (!isFunctionLikeDeclaration(transitiveDeclaration,))
          throw new Error('Expected transitive opaque function declaration.',);
        /** Transitive opaque callable summary retaining originating boundary. */
        const transitiveSummary = index.get(transitiveDeclaration,);
        if (transitiveSummary === NO_EFFECT_SUMMARY)
          throw new Error('Expected transitive opaque summary.',);
        /** Opaque boundary names propagated to wrapper parameter. */
        const transitiveProvenance = [
          ...transitiveSummary.opaqueProvenanceByParameter.get(0,) ?? [],
        ];
        closeSemanticBridge();

        expect(effects,).toEqual([
          {
            functionName: 'directSemanticEffect',
            mutated: [0,],
            opaque: [],
          },
          {
            functionName: 'mutatePackagedState',
            mutated: [0,],
            opaque: [],
          },
          {
            functionName: 'packagedSemanticEffect',
            mutated: [0,],
            opaque: [],
          },
          {
            functionName: 'crossFileSemanticEffect',
            mutated: [0,],
            opaque: [],
          },
          {
            functionName: 'callbackSemanticEffect',
            mutated: [0,],
            opaque: [],
          },
          {
            functionName: 'directCallbackEffect',
            mutated: [0,],
            opaque: [],
          },
          {
            functionName: 'asyncIteratorEffect',
            mutated: [0,],
            opaque: [],
          },
          {
            functionName: 'arrayCallbackSemanticEffect',
            mutated: [0,],
            opaque: [],
          },
          {
            functionName: 'aliasedCallbackSemanticEffect',
            mutated: [0,],
            opaque: [],
          },
          {
            functionName: 'noSemanticEffect',
            mutated: [],
            opaque: [],
          },
          {
            functionName: 'observationalIntrinsicEffect',
            mutated: [],
            opaque: [],
          },
          {
            functionName: 'primitiveArraySortObservationEffect',
            mutated: [],
            opaque: [],
          },
          {
            functionName: 'textEncoderObservationEffect',
            mutated: [],
            opaque: [],
          },
          {
            functionName: 'objectArraySortOpaqueEffect',
            mutated: [],
            opaque: [0,],
          },
          {
            functionName: 'observationalValueEffects',
            mutated: [],
            opaque: [],
          },
          {
            functionName: 'pathObservationEffect',
            mutated: [],
            opaque: [],
          },
          {
            functionName: 'dateObservationEffect',
            mutated: [],
            opaque: [],
          },
          {
            functionName: 'fileUrlObservationEffect',
            mutated: [],
            opaque: [],
          },
          {
            functionName: 'direntObservationEffect',
            mutated: [],
            opaque: [],
          },
          {
            functionName: 'aliasSemanticEffect',
            mutated: [0,],
            opaque: [],
          },
          {
            functionName: 'assignedAliasSemanticEffect',
            mutated: [0,],
            opaque: [],
          },
          {
            functionName: 'reboundParameterSemanticEffect',
            mutated: [],
            opaque: [],
          },
          {
            functionName: 'destructuredAliasSemanticEffect',
            mutated: [0,],
            opaque: [],
          },
          {
            functionName: 'destructuredParameterSemanticEffect',
            mutated: [0,],
            opaque: [],
          },
          {
            functionName: 'opaqueSemanticEffect',
            mutated: [],
            opaque: [0,],
          },
          {
            functionName: 'primitiveOpaqueArgumentEffect',
            mutated: [],
            opaque: [],
          },
          {
            functionName: 'packagedPrimitiveOpaqueArgumentEffect',
            mutated: [],
            opaque: [],
          },
          {
            functionName: 'transitiveOpaqueSemanticEffect',
            mutated: [],
            opaque: [0,],
          },
          {
            functionName: 'unusedClosureSemanticEffect',
            mutated: [],
            opaque: [],
          },
          {
            functionName: 'calledClosureSemanticEffect',
            mutated: [0,],
            opaque: [],
          },
          {
            functionName: 'returnedClosureSemanticEffect',
            mutated: [0,],
            opaque: [],
          },
          {
            functionName: 'passedClosureSemanticEffect',
            mutated: [0,],
            opaque: [],
          },
          {
            functionName: 'aliasedPassedClosureSemanticEffect',
            mutated: [0,],
            opaque: [],
          },
          {
            functionName: 'unusedFunctionExpressionSemanticEffect',
            mutated: [],
            opaque: [],
          },
          {
            functionName: 'returnedContainerClosureSemanticEffect',
            mutated: [0,],
            opaque: [],
          },
          {
            functionName: 'passedContainerClosureSemanticEffect',
            mutated: [0,],
            opaque: [],
          },
          {
            functionName: 'deadParentClosureSemanticEffect',
            mutated: [],
            opaque: [],
          },
          {
            functionName: 'storedClosureSemanticEffect',
            mutated: [0,],
            opaque: [0,],
          },
        ],);
        expect(transitiveProvenance,).toEqual(['JSON.stringify',],);
      },
    },),
    it({
      name: 'reuses direct scans for unchanged project sources',
      fn: async () => {
        clearEffectSummaryCache();
        const firstSession = openSemanticFile({
          fileName: FIXTURE_PATH,
          sourceText: SOURCE,
          hasBOM: false,
        },);
        buildEffectSummaryIndex({
          project: firstSession.project,
          activeSourceFile: firstSession.sourceFile,
        },);
        /** Counters after uncached whole-project scan. */
        const firstStats = effectSummaryCacheStats();
        expect(firstStats.directSummaryBuildCount > 0,).toBe(true,);
        const secondSession = openSemanticFile({
          fileName: FIXTURE_PATH,
          sourceText: SOURCE,
          hasBOM: false,
        },);
        buildEffectSummaryIndex({
          project: secondSession.project,
          activeSourceFile: secondSession.sourceFile,
        },);
        /** Counters after identical project snapshot source. */
        const secondStats = effectSummaryCacheStats();
        expect(secondStats.directSummaryBuildCount,).toBe(
          firstStats.directSummaryBuildCount,
        );
        expect(secondStats.sourceCacheHitCount > firstStats.sourceCacheHitCount,).toBe(true,);
        closeSemanticBridge();
        clearEffectSummaryCache();
      },
    },),
  ],
},);
