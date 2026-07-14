import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';
import { fileURLToPath, } from 'node:url';

import spawn from 'nano-spawn';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { isFunctionLikeDeclaration, } from 'typescript/unstable/ast/is';

import {
  buildEffectSummaryIndex,
  clearEffectSummaryCache,
  clearFinalEffectIndexCache,
  closeSemanticBridge,
  effectSummaryCacheStats,
  finalEffectIndexCacheStats,
  NO_EFFECT_SUMMARY,
  openSemanticFile,
} from '../dist/final/node/index.mjs';

/** Effect summary semantic fixture. */
const FIXTURE_PATH = fileURLToPath(new URL(
  '../../../test-fixture/oxlint-no-restricted-syntax/src/valid/typescript-sync-adapter.ts',
  import.meta.url,
),);

/** Built package entry exercised by independent process probe. */
const BUILT_ENTRY_URL = new URL(
  '../dist/final/node/index.mjs',
  import.meta.url,
).href;

/** Current effect fixture text. */
const SOURCE = readFileSync(
  FIXTURE_PATH,
  'utf8',
);

/** Disposable persistent cache directory. */
type DisposableCacheDirectory = {
  readonly path: string;
  readonly [Symbol.dispose]: () => void;
};

/**
 * Creates disposable persistent cache root.
 *
 * @returns cache directory removed after test scope.
 */
function disposableCacheDirectory(): DisposableCacheDirectory {
  const path = mkdtempSync(join(tmpdir(), 'readonly-effect-cache-',),);
  return {
    path,
    [Symbol.dispose](): void {
      rmSync(path, { recursive: true, force: true, },);
    },
  };
}

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
          'wholeParameterContractEffect',
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
        /** Documented uncertainty remains distinct from proven mutation. */
        const documentedEffects = [
          'documentedUncertainSemanticEffect',
          'transitiveDocumentedUncertainSemanticEffect',
        ].map(function documentedSummary(functionName,) {
          const nameNode = session.nodeAtOffset(SOURCE.indexOf(functionName,),);
          const declaration = nameNode.parent;
          if (!isFunctionLikeDeclaration(declaration,))
            throw new Error(`Expected function declaration for ${functionName}.`,);
          const summary = index.get(declaration,);
          if (summary === NO_EFFECT_SUMMARY)
            throw new Error(`Expected effect summary for ${functionName}.`,);
          return {
            functionName,
            affected: [...summary.mutatedParameterIndexes,],
            referentMutated: [...summary.referentMutatedParameterIndexes,],
            documentedUncertain: [...summary.documentedUncertainParameterIndexes,],
            opaque: [...summary.opaqueParameterIndexes,],
            provenance: [...summary.opaqueProvenanceByParameter.get(0,) ?? [],],
          };
        },);
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
            functionName: 'wholeParameterContractEffect',
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
        expect(documentedEffects,).toEqual([
          {
            functionName: 'documentedUncertainSemanticEffect',
            affected: [0,],
            referentMutated: [],
            documentedUncertain: [0,],
            opaque: [],
            provenance: ['JSON.stringify',],
          },
          {
            functionName: 'transitiveDocumentedUncertainSemanticEffect',
            affected: [0,],
            referentMutated: [],
            documentedUncertain: [0,],
            opaque: [],
            provenance: ['JSON.stringify',],
          },
        ],);
      },
    },),
    it({
      name: 'reuses direct scans in process and through persistent cache',
      fn: async () => {
        using cache = disposableCacheDirectory();
        clearEffectSummaryCache();
        clearFinalEffectIndexCache();
        const firstSession = openSemanticFile({
          fileName: FIXTURE_PATH,
          sourceText: SOURCE,
          hasBOM: false,
        },);
        buildEffectSummaryIndex({
          project: firstSession.project,
          activeSourceFile: firstSession.sourceFile,
          cacheRootOverride: cache.path,
        },);
        /** Counters after uncached whole-project scan and persistent write. */
        const firstStats = effectSummaryCacheStats();
        expect(firstStats.directSummaryBuildCount > 0,).toBe(true,);
        expect(firstStats.persistentCacheWriteCount > 0,).toBe(true,);
        clearEffectSummaryCache();
        clearFinalEffectIndexCache();
        const secondSession = openSemanticFile({
          fileName: FIXTURE_PATH,
          sourceText: SOURCE,
          hasBOM: false,
        },);
        buildEffectSummaryIndex({
          project: secondSession.project,
          activeSourceFile: secondSession.sourceFile,
          cacheRootOverride: cache.path,
        },);
        /** Counters after process cache reset and persistent reuse. */
        const persistentStats = effectSummaryCacheStats();
        expect(persistentStats.directSummaryBuildCount,).toBe(0,);
        expect(persistentStats.persistentSourceCacheHitCount > 0,).toBe(true,);
        const thirdSession = openSemanticFile({
          fileName: FIXTURE_PATH,
          sourceText: SOURCE,
          hasBOM: false,
        },);
        buildEffectSummaryIndex({
          project: thirdSession.project,
          activeSourceFile: thirdSession.sourceFile,
          cacheRootOverride: cache.path,
        },);
        /** Counters after same-process fixed-point index reuse. */
        const processStats = effectSummaryCacheStats();
        /** Fixed-point cache counters after unchanged project query. */
        const finalStats = finalEffectIndexCacheStats();
        expect(processStats.directSummaryBuildCount,).toBe(0,);
        expect(processStats.sourceCacheHitCount,).toBe(persistentStats.sourceCacheHitCount,);
        expect(finalStats.hitCount > 0,).toBe(true,);
        closeSemanticBridge();
        clearEffectSummaryCache();
        clearFinalEffectIndexCache();
      },
    },),
    it({
      name: 'invalidates unchanged caller summaries when project dependency changes',
      fn: async () => {
        using projectRoot = disposableCacheDirectory();
        /** Disposable persistent cache root separated from TypeScript inputs. */
        const cacheRoot = join(projectRoot.path, '.effect-cache',);
        /** Unchanged caller source whose call target changes on disk. */
        const inputPath = join(projectRoot.path, 'input.ts',);
        /** Imported implementation participating in caller effect resolution. */
        const helperPath = join(projectRoot.path, 'helper.ts',);
        writeFileSync(
          join(projectRoot.path, 'tsconfig.json',),
          '{"compilerOptions":{"strict":true},"include":["*.ts"]}\n',
        );
        writeFileSync(
          inputPath,
          "import { inspect, } from './helper.js';\nexport function caller(value: { text: string; },): string { return inspect(value); }\n",
        );
        writeFileSync(
          helperPath,
          'export function inspect(value: { text: string; },): string { return value.text; }\n',
        );
        clearEffectSummaryCache();
        clearFinalEffectIndexCache();
        const firstSession = openSemanticFile({
          fileName: inputPath,
          sourceText: readFileSync(inputPath, 'utf8',),
          hasBOM: false,
        },);
        buildEffectSummaryIndex({
          project: firstSession.project,
          activeSourceFile: firstSession.sourceFile,
          cacheRootOverride: cacheRoot,
        },);
        closeSemanticBridge();
        writeFileSync(
          helperPath,
          'export function inspect(value: { text: string; },): string { value.text = value.text.trim(); return value.text; }\n',
        );
        clearEffectSummaryCache();
        clearFinalEffectIndexCache();
        const changedSession = openSemanticFile({
          fileName: inputPath,
          sourceText: readFileSync(inputPath, 'utf8',),
          hasBOM: false,
        },);
        buildEffectSummaryIndex({
          project: changedSession.project,
          activeSourceFile: changedSession.sourceFile,
          cacheRootOverride: cacheRoot,
        },);
        /** Counters proving project fingerprint rejected stale caller entry. */
        const changedStats = effectSummaryCacheStats();
        expect(changedStats.directSummaryBuildCount > 0,).toBe(true,);
        expect(changedStats.persistentSourceCacheHitCount,).toBe(0,);
        closeSemanticBridge();
        clearEffectSummaryCache();
        clearFinalEffectIndexCache();
      },
    },),
    it({
      name: 'rejects corrupt nested persistent payloads',
      fn: async () => {
        using projectRoot = disposableCacheDirectory();
        /** Disposable persistent cache root. */
        const cacheRoot = join(projectRoot.path, '.effect-cache',);
        /** Single-source configured project input. */
        const inputPath = join(projectRoot.path, 'input.ts',);
        /** Stable single-source input text. */
        const inputSource = 'export function inspect(value: { text: string; },): string { return value.text; }\n';
        writeFileSync(
          join(projectRoot.path, 'tsconfig.json',),
          '{"compilerOptions":{"strict":true},"include":["input.ts"]}\n',
        );
        writeFileSync(inputPath, inputSource,);
        clearEffectSummaryCache();
        clearFinalEffectIndexCache();
        const firstSession = openSemanticFile({
          fileName: inputPath,
          sourceText: inputSource,
          hasBOM: false,
        },);
        buildEffectSummaryIndex({
          project: firstSession.project,
          activeSourceFile: firstSession.sourceFile,
          cacheRootOverride: cacheRoot,
        },);
        closeSemanticBridge();
        /** Relative persistent entry paths discovered after cold write. */
        const cacheEntries: string[] = [];
        for (const entry of readdirSync(cacheRoot, {
          recursive: true,
          encoding: 'utf8',
        },)) {
          if (entry.endsWith('.json',))
            cacheEntries.push(entry,);
        }
        const [cacheEntry,] = cacheEntries;
        if (cacheEntry === undefined)
          throw new Error('Expected persistent summary cache entry.',);
        /** Exact persistent JSON before nested corruption. */
        const cacheText = readFileSync(join(cacheRoot, cacheEntry,), 'utf8',);
        /** Cache JSON with valid envelope and invalid nested parameter count. */
        const corruptText = cacheText.replace(
          '"parameterCount":1',
          '"parameterCount":"invalid"',
        );
        if (corruptText === cacheText)
          throw new Error('Expected serialized parameter count to corrupt.',);
        writeFileSync(
          join(cacheRoot, cacheEntry,),
          corruptText,
        );
        clearEffectSummaryCache();
        clearFinalEffectIndexCache();
        const secondSession = openSemanticFile({
          fileName: inputPath,
          sourceText: inputSource,
          hasBOM: false,
        },);
        buildEffectSummaryIndex({
          project: secondSession.project,
          activeSourceFile: secondSession.sourceFile,
          cacheRootOverride: cacheRoot,
        },);
        /** Counters proving malformed nested payload became a miss. */
        const recoveredStats = effectSummaryCacheStats();
        expect(recoveredStats.directSummaryBuildCount > 0,).toBe(true,);
        closeSemanticBridge();
        clearEffectSummaryCache();
        clearFinalEffectIndexCache();
      },
    },),
    it({
      name: 'reuses persistent summaries across independent Node processes',
      fn: async () => {
        using cache = disposableCacheDirectory();
        /** Independent process probe importing only built package API. */
        const probePath = join(cache.path, 'persistent-probe.mjs',);
        /** Probe source printing cache counters for exact fixture analysis. */
        const probeSource = `import { readFileSync } from 'node:fs';\nimport { buildEffectSummaryIndex, closeSemanticBridge, effectSummaryCacheStats, openSemanticFile } from ${JSON.stringify(BUILT_ENTRY_URL)};\nconst [fileName, cacheRoot] = process.argv.slice(2);\nconst sourceText = readFileSync(fileName, 'utf8');\nconst session = openSemanticFile({ fileName, sourceText, hasBOM: false });\nbuildEffectSummaryIndex({ project: session.project, activeSourceFile: session.sourceFile, cacheRootOverride: cacheRoot });\nconsole.log(JSON.stringify(effectSummaryCacheStats()));\ncloseSemanticBridge();\n`;
        writeFileSync(probePath, probeSource,);
        const first = await spawn(
          'node',
          [probePath, FIXTURE_PATH, cache.path,],
        );
        const second = await spawn(
          'node',
          [probePath, FIXTURE_PATH, cache.path,],
        );
        /** Cold-process counters showing direct analysis and writes. */
        const coldStats = JSON.parse(first.stdout.trim(),) as {
          readonly directSummaryBuildCount: number;
          readonly persistentSourceCacheHitCount: number;
        };
        /** Warm-process counters showing persistent reuse without direct analysis. */
        const warmStats = JSON.parse(second.stdout.trim(),) as {
          readonly directSummaryBuildCount: number;
          readonly persistentSourceCacheHitCount: number;
        };
        expect(coldStats.directSummaryBuildCount > 0,).toBe(true,);
        expect(coldStats.persistentSourceCacheHitCount,).toBe(0,);
        expect(warmStats.directSummaryBuildCount,).toBe(0,);
        expect(warmStats.persistentSourceCacheHitCount > 0,).toBe(true,);
      },
    },),
  ],
},);
