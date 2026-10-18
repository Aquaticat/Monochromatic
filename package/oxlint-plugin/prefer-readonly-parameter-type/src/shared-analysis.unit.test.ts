import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  buildEffectSummaryIndex,
  clearEffectSummaryCache,
  clearFinalEffectIndexCache,
  closeSemanticBridge,
  effectSummaryCacheStats,
  openSemanticFile,
} from '../dist/final/node/index.mjs';

/** Helper source analysed once and shared by every project that agrees on its inputs. */
const HELPER_SOURCE = 'export function inspect(value: { text: string; },): string { return value.text; }\n';

/** Helper source whose parameter type comes from a path alias. */
const ALIAS_HELPER_SOURCE = "import type { Shape, } from '@shape';\nexport function area(value: Shape,): number { return value.size; }\n";

/** Helper source whose callee comes from a path alias. */
const ALIAS_CALLEE_HELPER_SOURCE = "import { dependency, } from '@dependency';\nexport function relay(value: { text: string; },): string { return dependency(value); }\n";

/** Active source in each project importing the shared helper. */
const INPUT_SOURCE = "import { inspect, } from '../shared/helper.js';\nexport function caller(value: { text: string; },): string { return inspect(value); }\n";

/** Active source in each project importing the alias-typed helper. */
const ALIAS_INPUT_SOURCE = "import { area, } from '../shared/helper.js';\nexport function measure(value: { size: number; },): number { return area(value); }\n";

/** Active source in each project importing the alias-callee helper. */
const ALIAS_CALLEE_INPUT_SOURCE = "import { relay, } from '../shared/helper.js';\nexport function forward(value: { text: string; },): string { return relay(value); }\n";

/** Observing dependency body written under two names so projects can resolve the alias to either. */
const DEPENDENCY_SOURCE = 'export function dependency(value: { text: string; },): string { return value.text; }\n';

/** Strict configuration shared by projects that must agree on checking options. */
const STRICT_COMPILER_OPTIONS = '"strict":true';

/** Include list reaching the project directory and the shared directory. */
const INCLUDE = '"include":["*.ts","../shared/*.ts"]';

/** Disposable fixture root. */
type DisposableFixtureRoot = {
  readonly path: string;
  readonly [Symbol.dispose]: () => void;
};

/**
 Creates disposable fixture root.
 
 @returns directory removed after the test scope.
 */
function disposableFixtureRoot(): DisposableFixtureRoot {
  const path = mkdtempSync(join(tmpdir(), 'readonly-shared-',),);
  return {
    path,
    [Symbol.dispose](): void {
      rmSync(path, { recursive: true, force: true, },);
    },
  };
}

/** One project directory next to the shared directory. */
type ProjectFixture = {
  readonly name: string;
  readonly compilerOptions: string;
  readonly inputSource: string;
  readonly files: Readonly<Record<string, string>>;
};

/**
 Writes one project directory with its configuration, active source, and extra files.
 
 @param root - Disposable fixture root.
 
 @param project - Project name, configuration, and files.
 
 @returns absolute path of the project's active source.
 */
function writeProject({
  root,
  project,
}: {
  readonly root: string;
  readonly project: ProjectFixture;
},): string {
  const directory = join(root, project.name,);
  mkdirSync(directory, { recursive: true, },);
  writeFileSync(
    join(directory, 'tsconfig.json',),
    `{"compilerOptions":{${project.compilerOptions}},${INCLUDE}}\n`,
  );
  writeFileSync(join(directory, 'input.ts',), project.inputSource,);
  Object.entries(project.files,)
    .forEach(function writeExtra([name, source,],): void {
      writeFileSync(join(directory, name,), source,);
    },);
  return join(directory, 'input.ts',);
}

/**
 Writes the shared directory every project includes.
 
 @param root - Disposable fixture root.
 
 @param files - File names and sources written under the shared directory.
 */
function writeSharedDirectory({
  root,
  files,
}: {
  readonly root: string;
  readonly files: Readonly<Record<string, string>>;
},): void {
  const directory = join(root, 'shared',);
  mkdirSync(directory, { recursive: true, },);
  Object.entries(files,)
    .forEach(function writeShared([name, source,],): void {
      writeFileSync(join(directory, name,), source,);
    },);
}

/**
 Builds the effect index of one project's active source and reads the cache counters.
 
 @param inputPath - Active source path.
 
 @param inputSource - Active source text.
 
 @param cacheRoot - Persistent cache root shared by both projects.
 
 @returns counters observed after the build.
 */
function buildProject({
  inputPath,
  inputSource,
  cacheRoot,
}: {
  readonly inputPath: string;
  readonly inputSource: string;
  readonly cacheRoot: string;
},): ReturnType<typeof effectSummaryCacheStats> {
  clearEffectSummaryCache();
  clearFinalEffectIndexCache();
  const session = openSemanticFile({
    fileName: inputPath,
    sourceText: inputSource,
    hasBOM: false,
  },);
  buildEffectSummaryIndex({
    project: session.project,
    activeSourceFile: session.sourceFile,
    cacheRootOverride: cacheRoot,
  },);
  const stats = effectSummaryCacheStats();
  closeSemanticBridge();
  return stats;
}

/**
 Builds the first project cold, then the second against the cache the first wrote.
 
 @param root - Disposable fixture root.
 
 @param first - First project.
 
 @param second - Second project.
 
 @returns counters observed while building the second project.
 */
function buildBothProjects({
  root,
  first,
  second,
}: {
  readonly root: string;
  readonly first: ProjectFixture;
  readonly second: ProjectFixture;
},): ReturnType<typeof effectSummaryCacheStats> {
  /** Persistent cache root outside every project. */
  const cacheRoot = join(root, '.effect-cache',);
  buildProject({
    inputPath: writeProject({
      root,
      project: first,
    },),
    inputSource: first.inputSource,
    cacheRoot,
  },);
  return buildProject({
    inputPath: writeProject({
      root,
      project: second,
    },),
    inputSource: second.inputSource,
    cacheRoot,
  },);
}

/**
 Releases bridge and process caches after one case.
 */
function releaseCycle(): void {
  closeSemanticBridge();
  clearEffectSummaryCache();
  clearFinalEffectIndexCache();
}

await describe({
  name: 'cross-project sharing of one file analysis',
  concurrency: 1,
  children: [
    it({
      name: 'shares a file between projects that differ only in an unreachable file',
      fn: async () => {
        using root = disposableFixtureRoot();
        writeSharedDirectory({
          root: root.path,
          files: { 'helper.ts': HELPER_SOURCE, },
        },);
        /** Counters of the second project, whose own unreachable files differ from the first's. */
        const stats = buildBothProjects({
          root: root.path,
          first: {
            name: 'first',
            compilerOptions: STRICT_COMPILER_OPTIONS,
            inputSource: INPUT_SOURCE,
            files: { 'unrelated.ts': 'export const unrelated: number = 1;\n', },
          },
          second: {
            name: 'second',
            compilerOptions: STRICT_COMPILER_OPTIONS,
            inputSource: INPUT_SOURCE,
            files: { 'other.d.ts': 'export type Other = { readonly other: string; };\n', },
          },
        },);
        /* The helper is analysed once; only the second project's own active source is built. */
        expect(stats.sharedSourceCacheHitCount,).toBe(1,);
        expect(stats.directSummaryBuildCount,).toBe(1,);
        releaseCycle();
      },
    },),
    it({
      name: 'does not share a file whose reachable declaration file differs',
      fn: async () => {
        using root = disposableFixtureRoot();
        writeSharedDirectory({
          root: root.path,
          files: { 'helper.ts': ALIAS_HELPER_SOURCE, },
        },);
        /** Counters of the second project, whose alias reaches a different declaration. */
        const stats = buildBothProjects({
          root: root.path,
          first: {
            name: 'first',
            compilerOptions: `${STRICT_COMPILER_OPTIONS},"paths":{"@shape":["./shape.d.ts"]}`,
            inputSource: ALIAS_INPUT_SOURCE,
            files: { 'shape.d.ts': 'export type Shape = { readonly size: number; };\n', },
          },
          second: {
            name: 'second',
            compilerOptions: `${STRICT_COMPILER_OPTIONS},"paths":{"@shape":["./shape.d.ts"]}`,
            inputSource: ALIAS_INPUT_SOURCE,
            files: { 'shape.d.ts': 'export type Shape = { size: number; readonly extra: string; };\n', },
          },
        },);
        expect(stats.sharedSourceCacheHitCount,).toBe(0,);
        expect(stats.directSummaryBuildCount,).toBe(2,);
        releaseCycle();
      },
    },),
    it({
      name: 'does not share a file between projects that differ in a checking option',
      fn: async () => {
        using root = disposableFixtureRoot();
        writeSharedDirectory({
          root: root.path,
          files: { 'helper.ts': HELPER_SOURCE, },
        },);
        /** Counters of the second project, whose checking options differ from the first's. */
        const stats = buildBothProjects({
          root: root.path,
          first: {
            name: 'first',
            compilerOptions: STRICT_COMPILER_OPTIONS,
            inputSource: INPUT_SOURCE,
            files: {},
          },
          second: {
            name: 'second',
            compilerOptions: `${STRICT_COMPILER_OPTIONS},"exactOptionalPropertyTypes":true`,
            inputSource: INPUT_SOURCE,
            files: {},
          },
        },);
        expect(stats.sharedSourceCacheHitCount,).toBe(0,);
        expect(stats.directSummaryBuildCount,).toBe(2,);
        releaseCycle();
      },
    },),
    it({
      name: 'does not share a file when paths change what one import resolves to',
      fn: async () => {
        using root = disposableFixtureRoot();
        writeSharedDirectory({
          root: root.path,
          files: {
            'helper.ts': ALIAS_CALLEE_HELPER_SOURCE,
            'dependency-a.ts': DEPENDENCY_SOURCE,
            'dependency-b.ts': DEPENDENCY_SOURCE,
          },
        },);
        /** Counters of the second project, whose alias resolves to a sibling with equal content. */
        const stats = buildBothProjects({
          root: root.path,
          first: {
            name: 'first',
            compilerOptions: `${STRICT_COMPILER_OPTIONS},"paths":{"@dependency":["../shared/dependency-a.ts"]}`,
            inputSource: ALIAS_CALLEE_INPUT_SOURCE,
            files: {},
          },
          second: {
            name: 'second',
            compilerOptions: `${STRICT_COMPILER_OPTIONS},"paths":{"@dependency":["../shared/dependency-b.ts"]}`,
            inputSource: ALIAS_CALLEE_INPUT_SOURCE,
            files: {},
          },
        },);
        expect(stats.sharedSourceCacheHitCount,).toBe(0,);
        expect(stats.directSummaryBuildCount,).toBe(3,);
        releaseCycle();
      },
    },),
    it({
      name: 'shares a file between projects whose paths differ without changing any resolution',
      fn: async () => {
        using root = disposableFixtureRoot();
        writeSharedDirectory({
          root: root.path,
          files: {
            'helper.ts': ALIAS_CALLEE_HELPER_SOURCE,
            'dependency-a.ts': DEPENDENCY_SOURCE,
          },
        },);
        /** Counters of the second project, whose extra alias is never imported. */
        const stats = buildBothProjects({
          root: root.path,
          first: {
            name: 'first',
            compilerOptions: `${STRICT_COMPILER_OPTIONS},"paths":{"@dependency":["../shared/dependency-a.ts"]}`,
            inputSource: ALIAS_CALLEE_INPUT_SOURCE,
            files: {},
          },
          second: {
            name: 'second',
            compilerOptions: `${STRICT_COMPILER_OPTIONS},"paths":{"@dependency":["../shared/dependency-a.ts"],"@unused":["./unused.ts"]}`,
            inputSource: ALIAS_CALLEE_INPUT_SOURCE,
            files: { 'unused.ts': 'export const unused: number = 1;\n', },
          },
        },);
        expect(stats.sharedSourceCacheHitCount,).toBe(2,);
        expect(stats.directSummaryBuildCount,).toBe(1,);
        releaseCycle();
      },
    },),
    it({
      name: 'does not share a file when an ambient declaration differs',
      fn: async () => {
        using root = disposableFixtureRoot();
        writeSharedDirectory({
          root: root.path,
          files: { 'helper.ts': HELPER_SOURCE, },
        },);
        /** Counters of the second project, whose global script differs from the first's. */
        const stats = buildBothProjects({
          root: root.path,
          first: {
            name: 'first',
            compilerOptions: STRICT_COMPILER_OPTIONS,
            inputSource: INPUT_SOURCE,
            files: { 'ambient.d.ts': 'declare const sharedAnalysisAmbient: string;\n', },
          },
          second: {
            name: 'second',
            compilerOptions: STRICT_COMPILER_OPTIONS,
            inputSource: INPUT_SOURCE,
            files: { 'ambient.d.ts': 'declare const sharedAnalysisAmbient: number;\n', },
          },
        },);
        expect(stats.sharedSourceCacheHitCount,).toBe(0,);
        expect(stats.directSummaryBuildCount,).toBe(2,);
        releaseCycle();
      },
    },),
  ],
},);
