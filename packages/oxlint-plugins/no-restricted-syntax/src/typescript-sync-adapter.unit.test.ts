import {
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';
import { fileURLToPath, } from 'node:url';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  closeSemanticBridge,
  openSemanticFile,
  semanticBridgeCacheStats,
  typescriptOffset,
} from '../dist/final/node/index.mjs';

/** Source fixture resolved through configured package project. */
const FIXTURE_PATH = fileURLToPath(new URL(
  '../../../test-fixture/oxlint-no-restricted-syntax/src/valid/typescript-sync-adapter.ts',
  import.meta.url,
),);

/** Configured fixture package root for disposable semantic files. */
const FIXTURE_ROOT = fileURLToPath(new URL(
  '../../../test-fixture/oxlint-no-restricted-syntax/src/',
  import.meta.url,
),);

/** Disposable configured-project directory. */
type SemanticFixtureDirectory = {
  readonly path: string;
  [Symbol.dispose]: () => void;
};

/**
 * Creates non-hidden disposable directory included by fixture project.
 *
 * @returns disposable configured-project directory.
 */
function createSemanticFixtureDirectory(): SemanticFixtureDirectory {
  /** Unique directory path under configured fixture package. */
  const path = mkdtempSync(join(FIXTURE_ROOT, 'semantic-acceptance-',),);
  return {
    path,
    [Symbol.dispose]: function removeSemanticFixtureDirectory(): void {
      rmSync(path, { recursive: true, force: true, },);
    },
  };
}

/** Original source retained on disk while overlays change in memory. */
const SOURCE = readFileSync(
  FIXTURE_PATH,
  'utf8',
);

/** Parameter identifier offset queried through both snapshots. */
const PARAMETER_OFFSET = SOURCE.indexOf('box: SemanticFixtureBox',);

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: openSemanticFile.name,
      children: [
        it({
          name: 'discovers configured project and resolves parameter type',
          fn: async () => {
            const session = openSemanticFile({
              fileName: FIXTURE_PATH,
              sourceText: SOURCE,
              hasBOM: false,
            },);
            const node = session.nodeAtOffset(PARAMETER_OFFSET,);
            const type = session.checker.getTypeAtLocation(node,);

            expect(session.project.configFileName,).toContain(
              'packages/test-fixture/oxlint-no-restricted-syntax/tsconfig.json',
            );
            if (type === undefined)
              throw new Error('Expected fixture parameter type.',);
            expect(session.checker.typeToString(type,),).toBe('SemanticFixtureBox<string>',);
          },
        },),
        it({
          name: 'refreshes semantic type from virtual overlay without disk write',
          fn: async () => {
            const overlaid = SOURCE.replace(
              'box: SemanticFixtureBox<string>',
              'box: Readonly<SemanticFixtureBox<string>>',
            );
            const session = openSemanticFile({
              fileName: FIXTURE_PATH,
              sourceText: overlaid,
              hasBOM: false,
            },);
            const node = session.nodeAtOffset(PARAMETER_OFFSET,);
            const type = session.checker.getTypeAtLocation(node,);

            if (type === undefined)
              throw new Error('Expected overlaid fixture parameter type.',);
            expect(session.checker.typeToString(type,),).toBe('Readonly<SemanticFixtureBox<string>>',);
            expect(readFileSync(FIXTURE_PATH, 'utf8',),).toBe(SOURCE,);
          },
        },),
        it({
          name: 'fails closed when offset is outside source tree',
          fn: async () => {
            const session = openSemanticFile({
              fileName: FIXTURE_PATH,
              sourceText: SOURCE,
              hasBOM: false,
            },);
            let caught: unknown;
            try {
              session.nodeAtOffset(SOURCE.length + 1,);
            }
            catch (error) {
              caught = error;
            }
            expect(caught,).toBeInstanceOf(Error,);
            expect((caught as Error).message,).toContain('No TypeScript node contains offset',);
          },
        },),
        it({
          name: 'retains semantic nodes through parser recovery',
          fn: async () => {
            /** Incomplete member access retained by recovering parser. */
            const malformedSource = `export function inspect(value: { readonly text: string; },): string {\n  return value.\n`;
            /** Semantic session over malformed in-memory source. */
            const session = openSemanticFile({
              fileName: FIXTURE_PATH,
              sourceText: malformedSource,
              hasBOM: false,
            },);
            /** Recovered parameter identifier. */
            const node = session.nodeAtOffset(malformedSource.indexOf('value:',),);
            /** Recovered parameter type. */
            const type = session.checker.getTypeAtLocation(node,);
            if (type === undefined)
              throw new Error('Expected parser-recovered parameter type.',);
            expect(session.checker.typeToString(type,),).toBe('{ readonly text: string; }',);
          },
        },),
        it({
          name: 'invalidates deleted source during rename',
          fn: async () => {
            closeSemanticBridge();
            using directory = createSemanticFixtureDirectory();
            /** Original source path opened before rename. */
            const originalPath = join(directory.path, 'original.ts',);
            /** Renamed source path created after first snapshot. */
            const renamedPath = join(directory.path, 'renamed.ts',);
            /** Original source text. */
            const originalSource = 'export const originalValue: string = \'before\';\n';
            writeFileSync(originalPath, originalSource,);
            openSemanticFile({
              fileName: originalPath,
              sourceText: originalSource,
              hasBOM: false,
            },);
            renameSync(originalPath, renamedPath,);
            /** Changed text supplied at renamed path. */
            const renamedSource = 'export const renamedValue: number = 1;\n';
            writeFileSync(renamedPath, renamedSource,);
            /** Session after deleted plus created invalidation. */
            const session = openSemanticFile({
              fileName: renamedPath,
              sourceText: renamedSource,
              hasBOM: false,
            },);
            const node = session.nodeAtOffset(renamedSource.indexOf('renamedValue',),);
            const type = session.checker.getTypeAtLocation(node,);
            if (type === undefined)
              throw new Error('Expected renamed source type.',);
            expect(session.checker.typeToString(type,),).toBe('number',);
          },
        },),
        it({
          name: 'opens configured source through symbolic link path',
          fn: async () => {
            closeSemanticBridge();
            using directory = createSemanticFixtureDirectory();
            /** Real source path targeted by symbolic link. */
            const realPath = join(directory.path, 'real.ts',);
            /** Symbolic source path passed to bridge. */
            const linkedPath = join(directory.path, 'linked.ts',);
            /** Source shared by real and symbolic paths. */
            const source = 'export const linkedValue: string = \'linked\';\n';
            writeFileSync(realPath, source,);
            symlinkSync(realPath, linkedPath,);
            const session = openSemanticFile({
              fileName: linkedPath,
              sourceText: source,
              hasBOM: false,
            },);
            const node = session.nodeAtOffset(source.indexOf('linkedValue',),);
            const type = session.checker.getTypeAtLocation(node,);
            if (type === undefined)
              throw new Error('Expected symbolic-link source type.',);
            expect(session.checker.typeToString(type,),).toBe('string',);
          },
        },),
        it({
          name: 'accepts Windows source paths with noncanonical casing',
          fn: async () => {
            if (process.platform !== 'win32') {
              expect(true,).toBe(true,);
              return;
            }
            closeSemanticBridge();
            using directory = createSemanticFixtureDirectory();
            /** Canonically cased source written inside configured project. */
            const canonicalPath = join(directory.path, 'MixedCase.ts',);
            /** Noncanonical source path accepted by case-insensitive Windows filesystem. */
            const noncanonicalPath = join(directory.path, 'mixedcase.ts',);
            /** Source queried through noncanonical path. */
            const source = 'export const mixedCaseValue: string = \'case\';\n';
            writeFileSync(canonicalPath, source,);
            const session = openSemanticFile({
              fileName: noncanonicalPath,
              sourceText: source,
              hasBOM: false,
            },);
            const node = session.nodeAtOffset(source.indexOf('mixedCaseValue',),);
            const type = session.checker.getTypeAtLocation(node,);
            if (type === undefined)
              throw new Error('Expected noncanonical-path source type.',);
            expect(session.checker.typeToString(type,),).toBe('string',);
          },
        },),
        it({
          name: 'rejects inferred project and recovers for next configured source',
          fn: async () => {
            /** Disposable source outside every configured project. */
            const unconfiguredRoot = mkdtempSync(join(tmpdir(), 'semantic-unconfigured-',),);
            using unconfigured: SemanticFixtureDirectory = {
              path: unconfiguredRoot,
              [Symbol.dispose]: function removeUnconfiguredFixture(): void {
                rmSync(unconfiguredRoot, { recursive: true, force: true, },);
              },
            };
            /** Unconfigured source path. */
            const fileName = join(unconfigured.path, 'input.ts',);
            /** Unconfigured source text. */
            const sourceText = 'export const value: string = \'outside\';\n';
            writeFileSync(fileName, sourceText,);
            let caught: unknown;
            try {
              openSemanticFile({ fileName, sourceText, hasBOM: false, },);
            }
            catch (error) {
              caught = error;
            }
            expect(caught,).toBeInstanceOf(Error,);
            expect((caught as Error).message,).toContain('no configured project',);
            const recovered = openSemanticFile({
              fileName: FIXTURE_PATH,
              sourceText: SOURCE,
              hasBOM: false,
            },);
            expect(recovered.project.configFileName,).toContain(
              'packages/test-fixture/oxlint-no-restricted-syntax/tsconfig.json',
            );
          },
        },),
        it({
          name: 'bounds overlays by active file and projects by configured root',
          fn: async () => {
            openSemanticFile({ fileName: FIXTURE_PATH, sourceText: SOURCE, hasBOM: false, },);
            openSemanticFile({ fileName: FIXTURE_PATH, sourceText: SOURCE, hasBOM: false, },);
            expect(semanticBridgeCacheStats(),).toEqual({
              overlayCount: 1,
              projectRootCount: 1,
            },);
          },
        },),
        it({
          name: 'closes idempotently and starts again',
          fn: async () => {
            closeSemanticBridge();
            closeSemanticBridge();
            const session = openSemanticFile({
              fileName: FIXTURE_PATH,
              sourceText: SOURCE,
              hasBOM: false,
            },);
            expect(session.sourceFile.fileName,).toBe(FIXTURE_PATH,);
            closeSemanticBridge();
          },
        },),
      ],
    },),
    describe({
      name: typescriptOffset.name,
      children: [
        it({
          name: 'restores one UTF-16 unit for stripped byte-order mark',
          fn: async () => {
            expect(typescriptOffset({ offset: 4, hasBOM: true, },),).toBe(5,);
            expect(typescriptOffset({ offset: 4, hasBOM: false, },),).toBe(4,);
          },
        },),
      ],
    },),
  ],
},);
