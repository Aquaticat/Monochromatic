import { readFileSync, } from 'node:fs';
import { fileURLToPath, } from 'node:url';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  closeSemanticBridge,
  openSemanticFile,
  typescriptOffset,
} from '../dist/final/node/index.mjs';

/** Source fixture resolved through configured package project. */
const FIXTURE_PATH = fileURLToPath(new URL(
  '../../../test-fixture/oxlint-no-restricted-syntax/src/valid/typescript-sync-adapter.ts',
  import.meta.url,
),);

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
