import {
  mkdirSync,
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

/** Second configured source used to verify cross-file final-index reuse. */
const HELPER_PATH = fileURLToPath(new URL(
  '../../../test-fixture/oxlint-no-restricted-syntax/src/valid/semantic-effects-helper.ts',
  import.meta.url,
),);

/** Statusline source proving audited object-property callback invocation. */
const STATUSLINE_USAGE_PATH = fileURLToPath(new URL(
  '../../../pi-plugins/statusline/src/usage-warning.ts',
  import.meta.url,
),);

/** Current statusline usage source text. */
const STATUSLINE_USAGE_SOURCE = readFileSync(
  STATUSLINE_USAGE_PATH,
  'utf8',
);

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
      name: 'records audited object-property callback invocation without unresolved effects',
      fn: async () => {
        const session = openSemanticFile({
          fileName: STATUSLINE_USAGE_PATH,
          sourceText: STATUSLINE_USAGE_SOURCE,
          hasBOM: false,
        },);
        const index = buildEffectSummaryIndex({
          project: session.project,
          activeSourceFile: session.sourceFile,
        },);
        const nameNode = session.nodeAtOffset(
          STATUSLINE_USAGE_SOURCE.indexOf('function formatUsageWarningStatus',)
            + 'function '.length,
        );
        const declaration = nameNode.parent;
        if (!isFunctionLikeDeclaration(declaration,))
          throw new Error('Expected statusline usage function declaration.',);
        const summary = index.get(declaration,);
        if (summary === NO_EFFECT_SUMMARY)
          throw new Error('Expected statusline usage effect summary.',);
        /** Audited invocation indexes retained before bridge cleanup. */
        const invoked = [...summary.invokedParameterIndexes,];
        /** Audited unresolved indexes retained before bridge cleanup. */
        const opaque = [...summary.opaqueParameterIndexes,];
        closeSemanticBridge();
        expect(invoked,).toEqual([0,],);
        expect(opaque,).toEqual([],);
      },
    },),
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
          'objectArraySortCallbackEffect',
          'objectArrayDefaultSortOpaqueEffect',
          'objectArrayUndefinedSortOpaqueEffect',
          'objectArrayOptionalSortOpaqueEffect',
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
            functionName: 'objectArraySortCallbackEffect',
            mutated: [],
            opaque: [],
          },
          {
            functionName: 'objectArrayDefaultSortOpaqueEffect',
            mutated: [],
            opaque: [0,],
          },
          {
            functionName: 'objectArrayUndefinedSortOpaqueEffect',
            mutated: [],
            opaque: [0,],
          },
          {
            functionName: 'objectArrayOptionalSortOpaqueEffect',
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
      name: 'keeps deferred callback invocation separate from forwarded argument uncertainty',
      fn: async () => {
        using projectRoot = disposableCacheDirectory();
        /** Disposable configured source path. */
        const inputPath = join(projectRoot.path, 'input.ts',);
        /** Source forwarding payload to deferred callback. */
        const inputSource = [
          'export function schedule(callback: (payload: { value: string }) => void, payload: { value: string }): void {',
          '  setTimeout(callback, 0, payload);',
          '}',
          '',
        ].join('\n',);
        writeFileSync(
          join(projectRoot.path, 'tsconfig.json',),
          `${JSON.stringify({ compilerOptions: { strict: true, lib: ['ESNext', 'DOM',], }, files: ['input.ts',], },)}\n`,
        );
        writeFileSync(inputPath, inputSource,);
        const session = openSemanticFile({
          fileName: inputPath,
          sourceText: inputSource,
          hasBOM: false,
        },);
        const index = buildEffectSummaryIndex({
          project: session.project,
          activeSourceFile: session.sourceFile,
        },);
        /** Scheduled function declaration. */
        const declaration = session.nodeAtOffset(inputSource.indexOf('schedule',),)
          .parent;
        if (!isFunctionLikeDeclaration(declaration,))
          throw new Error('Expected scheduled function declaration.',);
        /** Deferred callback effect summary. */
        const summary = index.get(declaration,);
        if (summary === NO_EFFECT_SUMMARY)
          throw new Error('Expected deferred callback effect summary.',);
        expect([...summary.invokedParameterIndexes,],).toEqual([0,],);
        expect([...summary.mutatedParameterIndexes,],).toEqual([0,],);
        expect([...summary.referentMutatedParameterIndexes,],).toEqual([],);
        expect([...summary.opaqueParameterIndexes,],).toEqual([1,],);
        expect(summary.callbackRelations,).toEqual([{
          callbackParameterIndex: 0,
          callbackArgumentIndex: 0,
          sourceParameterIndex: 1,
        },],);
        closeSemanticBridge();
      },
    },),
    it({
      name: 'treats a fresh frozen copy as separate from caller-owned input',
      fn: async () => {
        using projectRoot = disposableCacheDirectory();
        /** Disposable configured source path. */
        const inputPath = join(projectRoot.path, 'input.ts',);
        /** Source freezing a fresh shallow copy instead of caller-owned input. */
        const inputSource = [
          'export function freezeCopy(options: { nested: { value: string } }): void {',
          '  Object.freeze({ nested: options.nested });',
          '}',
          '',
        ].join('\n',);
        writeFileSync(
          join(projectRoot.path, 'tsconfig.json',),
          `${JSON.stringify({ compilerOptions: { strict: true, lib: ['ESNext',], }, files: ['input.ts',], },)}\n`,
        );
        writeFileSync(inputPath, inputSource,);
        const session = openSemanticFile({
          fileName: inputPath,
          sourceText: inputSource,
          hasBOM: false,
        },);
        const index = buildEffectSummaryIndex({
          project: session.project,
          activeSourceFile: session.sourceFile,
        },);
        /** Fresh-copy function declaration. */
        const declaration = session.nodeAtOffset(inputSource.indexOf('freezeCopy',),)
          .parent;
        if (!isFunctionLikeDeclaration(declaration,))
          throw new Error('Expected fresh-copy function declaration.',);
        /** Fresh-copy effect summary. */
        const summary = index.get(declaration,);
        if (summary === NO_EFFECT_SUMMARY)
          throw new Error('Expected fresh-copy effect summary.',);
        expect({
          mutated: [...summary.mutatedParameterIndexes,],
          referentMutated: [...summary.referentMutatedParameterIndexes,],
          invoked: [...summary.invokedParameterIndexes,],
          opaque: [...summary.opaqueParameterIndexes,],
          callbackRelations: summary.callbackRelations,
        },).toEqual({
          mutated: [],
          referentMutated: [],
          invoked: [],
          opaque: [],
          callbackRelations: [],
        },);
        closeSemanticBridge();
      },
    },),
    it({
      name: 'infers direct imported package effects from shipped implementation',
      fn: async () => {
        using projectRoot = disposableCacheDirectory();
        /** Disposable package root under ordinary Node resolution boundary. */
        const packageRoot = join(projectRoot.path, 'node_modules', 'effect-probe',);
        mkdirSync(packageRoot, { recursive: true, },);
        writeFileSync(
          join(projectRoot.path, 'package.json',),
          '{"name":"effect-consumer","private":true,"type":"module"}\n',
        );
        writeFileSync(
          join(projectRoot.path, 'tsconfig.json',),
          '{"compilerOptions":{"strict":true,"module":"NodeNext","moduleResolution":"NodeNext"},"include":["input.ts"]}\n',
        );
        writeFileSync(
          join(projectRoot.path, 'pnpm-lock.yaml',),
          "lockfileVersion: '9.0'\npackages:\n  effect-probe@1.2.3: {}\n",
        );
        writeFileSync(
          join(packageRoot, 'package.json',),
          '{"name":"effect-probe","version":"1.2.3","type":"module","types":"./index.d.ts","exports":{".":{"node":"./node.js","import":"./index.js"},"./barrel":{"types":"./barrel.d.ts","node":"./barrel.js"},"./typed":{"types":"./typed.d.ts","import":"./typed.ts"},"./missing":{"types":"./missing.d.ts","import":"./missing.js"}}}\n',
        );
        writeFileSync(
          join(packageRoot, 'index.d.ts',),
          'export declare function observe(value: { text: string; }): string;\nexport declare function observe(value: { text: string; }, fallback: string): string;\nexport declare function mutate(value: { text: string; }): string;\nexport declare const toolkit: { mutate(value: { text: string; }): string; };\nexport declare class Toolkit { static mutate(value: { text: string; }): string; mutate(value: { text: string; }): string; }\nexport declare function visit(value: { text: string; }, callback: (value: { text: string; }) => void): void;\n',
        );
        writeFileSync(
          join(packageRoot, 'node.js',),
          "export { mutate, observe, Toolkit, toolkit, visit, } from './internal.js';\n//# sourceMappingURL=node.js.map\n",
        );
        writeFileSync(
          join(packageRoot, 'node.js.map',),
          '{"version":3,"file":"node.js","sources":["source.js"],"names":[],"mappings":""}\n',
        );
        writeFileSync(
          join(packageRoot, 'index.js',),
          "export { observe, Toolkit, toolkit, visit, } from './internal.js';\nexport function mutate(value) { return value.text; }\n",
        );
        writeFileSync(
          join(packageRoot, 'source.js',),
          "export { mutate, observe, Toolkit, toolkit, visit, } from './internal.js';\n",
        );
        writeFileSync(
          join(packageRoot, 'internal.js',),
          "export function observe(value) { return value.text; }\nexport function mutate(value) { value.text = 'changed'; return value.text; }\nexport const toolkit = { mutate(value) { value.text = 'object'; return value.text; } };\nexport class Toolkit { static mutate(value) { value.text = 'static'; return value.text; } mutate(value) { value.text = 'instance'; return value.text; } }\nexport function visit(value, callback) { callback(value); }\n",
        );
        writeFileSync(
          join(packageRoot, 'barrel.d.ts',),
          'export declare function barrelMutate(value: { text: string; }): string;\n',
        );
        writeFileSync(
          join(packageRoot, 'barrel.js',),
          "import { barrelMutate, } from './barrel-internal.js';\nexport { barrelMutate, };\n",
        );
        writeFileSync(
          join(packageRoot, 'barrel-internal.d.ts',),
          'export declare function barrelMutate(value: { text: string; }): string;\n',
        );
        writeFileSync(
          join(packageRoot, 'barrel-internal.js',),
          "export function barrelMutate(value) { value.text = 'barrel'; return value.text; }\n",
        );
        writeFileSync(
          join(packageRoot, 'typed.d.ts',),
          'export declare function typedMutate(value: { text: string; }): string;\n',
        );
        writeFileSync(
          join(packageRoot, 'typed.ts',),
          "export function typedMutate(value: { text: string; }): string { value.text = 'typed'; return value.text; }\n",
        );
        writeFileSync(
          join(packageRoot, 'missing.d.ts',),
          'export declare function missing(value: { text: string; }): string;\n',
        );
        /** Consumer wrappers covering re-exported JS, overloads, shipped TS, and missing implementation. */
        const inputSource = "import { mutate, observe, Toolkit, toolkit, visit, } from 'effect-probe';\nimport { barrelMutate, } from 'effect-probe/barrel';\nimport { missing, } from 'effect-probe/missing';\nimport { typedMutate, } from 'effect-probe/typed';\nexport function observed(value: { text: string; }): string { return observe(value); }\nexport function mutated(value: { text: string; }): string { return mutate(value); }\nexport function barrelMutated(value: { text: string; }): string { return barrelMutate(value); }\nexport function objectMutated(value: { text: string; }): string { return toolkit.mutate(value); }\nconst toolkitInstance = new Toolkit();\nexport function staticMutated(value: { text: string; }): string { return Toolkit.mutate(value); }\nexport function instanceMutated(value: { text: string; }): string { return toolkitInstance.mutate(value); }\nexport function typedMutated(value: { text: string; }): string { return typedMutate(value); }\nexport function visited(value: { text: string; }, callback: (value: { text: string; }) => void): void { visit(value, callback); }\nexport function unresolved(value: { text: string; }): string { return missing(value); }\n";
        /** Consumer source path. */
        const inputPath = join(projectRoot.path, 'input.ts',);
        writeFileSync(inputPath, inputSource,);
        clearEffectSummaryCache();
        clearFinalEffectIndexCache();
        const session = openSemanticFile({
          fileName: inputPath,
          sourceText: inputSource,
          hasBOM: false,
        },);
        const index = buildEffectSummaryIndex({
          project: session.project,
          activeSourceFile: session.sourceFile,
        },);
        const effects = [
          'observed',
          'mutated',
          'barrelMutated',
          'objectMutated',
          'staticMutated',
          'instanceMutated',
          'typedMutated',
          'unresolved',
        ].map(function wrapperEffect(functionName,) {
          const nameNode = session.nodeAtOffset(inputSource.indexOf(functionName,),);
          const declaration = nameNode.parent;
          if (!isFunctionLikeDeclaration(declaration,))
            throw new Error(`Expected package wrapper ${functionName}.`,);
          const summary = index.get(declaration,);
          if (summary === NO_EFFECT_SUMMARY)
            throw new Error(`Expected package wrapper summary ${functionName}.`,);
          return {
            functionName,
            mutated: [...summary.referentMutatedParameterIndexes,],
            opaque: [...summary.opaqueParameterIndexes,],
          };
        },);
        expect(effects,).toEqual([
          {
            functionName: 'observed',
            mutated: [],
            opaque: [],
          },
          {
            functionName: 'mutated',
            mutated: [0,],
            opaque: [],
          },
          {
            functionName: 'barrelMutated',
            mutated: [0,],
            opaque: [],
          },
          {
            functionName: 'objectMutated',
            mutated: [0,],
            opaque: [],
          },
          {
            functionName: 'staticMutated',
            mutated: [0,],
            opaque: [],
          },
          {
            functionName: 'instanceMutated',
            mutated: [0,],
            opaque: [],
          },
          {
            functionName: 'typedMutated',
            mutated: [0,],
            opaque: [],
          },
          {
            functionName: 'unresolved',
            mutated: [],
            opaque: [0,],
          },
        ],);
        /** Wrapper declaration for unresolved external callback relation. */
        const visitedName = session.nodeAtOffset(inputSource.indexOf('visited',),);
        /** Function declaration receiving callback and forwarded value. */
        const visitedDeclaration = visitedName.parent;
        if (!isFunctionLikeDeclaration(visitedDeclaration,))
          throw new Error('Expected visited package wrapper.',);
        /** Summary retaining callback invocation and fail-closed source relation. */
        const visitedSummary = index.get(visitedDeclaration,);
        if (visitedSummary === NO_EFFECT_SUMMARY)
          throw new Error('Expected visited package wrapper summary.',);
        expect({
          referentMutated: [...visitedSummary.referentMutatedParameterIndexes,],
          invoked: [...visitedSummary.invokedParameterIndexes,],
          opaque: [...visitedSummary.opaqueParameterIndexes,],
        },).toEqual({
          referentMutated: [],
          invoked: [1,],
          opaque: [0,],
        },);
        closeSemanticBridge();
        clearEffectSummaryCache();
        clearFinalEffectIndexCache();
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
        /** Different active source from same unchanged configured project. */
        const helperSession = openSemanticFile({
          fileName: HELPER_PATH,
          sourceText: readFileSync(HELPER_PATH, 'utf8',),
          hasBOM: false,
        },);
        buildEffectSummaryIndex({
          project: helperSession.project,
          activeSourceFile: helperSession.sourceFile,
          cacheRootOverride: cache.path,
        },);
        /** Fixed-point cache counters after changing only active source path. */
        const crossFileStats = finalEffectIndexCacheStats();
        expect(crossFileStats.hitCount > finalStats.hitCount,).toBe(true,);
        closeSemanticBridge();
        clearEffectSummaryCache();
        clearFinalEffectIndexCache();
      },
    },),
    it({
      name: 'does not reuse an index that excluded the next active external-classified source',
      fn: async () => {
        using projectRoot = disposableCacheDirectory();
        /** Disposable persistent cache root separated from TypeScript inputs. */
        const cacheRoot = join(projectRoot.path, '.effect-cache',);
        /** Root-owned source used to build first fixed-point index. */
        const rootInputPath = join(projectRoot.path, 'input.ts',);
        /** Installed package directory classified as external by root project. */
        const nestedRoot = join(
          projectRoot.path,
          'node_modules',
          'effect-cache-probe',
        );
        /** Package callable omitted from first root-project effect index. */
        const nestedInputPath = join(nestedRoot, 'index.ts',);
        mkdirSync(nestedRoot, { recursive: true, },);
        writeFileSync(
          join(projectRoot.path, 'tsconfig.json',),
          '{"compilerOptions":{"module":"NodeNext","moduleResolution":"NodeNext","strict":true},"include":["input.ts"]}\n',
        );
        writeFileSync(
          join(nestedRoot, 'package.json',),
          '{"name":"effect-cache-probe","type":"module","exports":"./index.ts"}\n',
        );
        writeFileSync(
          rootInputPath,
          "import { nestedValue, } from 'effect-cache-probe';\nexport const rootValue: string = nestedValue('root');\n",
        );
        writeFileSync(
          nestedInputPath,
          'export function nestedValue(value: string): string { return value; }\n',
        );
        clearEffectSummaryCache();
        clearFinalEffectIndexCache();
        const session = openSemanticFile({
          fileName: rootInputPath,
          sourceText: readFileSync(rootInputPath, 'utf8',),
          hasBOM: false,
        },);
        /** Nested source decoded in root program but classified as external. */
        const nestedSource = session.project.program.getSourceFile(nestedInputPath,);
        if (nestedSource === undefined)
          throw new Error('Expected root project to decode nested source.',);
        expect(session.project.program.isSourceFileFromExternalLibrary(nestedSource,),).toBe(true,);
        buildEffectSummaryIndex({
          project: session.project,
          activeSourceFile: session.sourceFile,
          cacheRootOverride: cacheRoot,
        },);
        /** Index rebuilt with nested external-classified source as active target. */
        const nestedIndex = buildEffectSummaryIndex({
          project: session.project,
          activeSourceFile: nestedSource,
          cacheRootOverride: cacheRoot,
        },);
        /** Nested function declaration requiring exact summary lookup. */
        const [nestedDeclaration,] = nestedSource.statements;
        if ((nestedDeclaration === undefined)
          || (!isFunctionLikeDeclaration(nestedDeclaration,)))
          throw new Error('Expected nested function declaration.',);
        expect(nestedIndex.get(nestedDeclaration,),).not.toBe(NO_EFFECT_SUMMARY,);
        closeSemanticBridge();
        clearEffectSummaryCache();
        clearFinalEffectIndexCache();
      },
    },),
    it({
      name: 'invalidates unchanged caller summaries when dependency changes across bridge lifecycle',
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
        /** Final-index writes proving new semantic lifecycle recomputed project. */
        const changedFinalStats = finalEffectIndexCacheStats();
        expect(changedStats.directSummaryBuildCount > 0,).toBe(true,);
        expect(changedFinalStats.writeCount,).toBe(1,);
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
