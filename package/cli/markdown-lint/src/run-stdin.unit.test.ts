import { createHash, } from 'node:crypto';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  runStdin,
  StdinPathError,
} from '@monochromatic-dev/cli-markdown-lint';

import {
  FIXTURE_IMAGE_BYTES,
  FIXTURE_OBJECT_BASE,
  makeLfsRepo,
} from './lfs-test-fixture.ts';

/**
 Expected oid of the fixture image.
 */
const FIXTURE_OID = createHash('sha256',)
  .update(FIXTURE_IMAGE_BYTES,)
  .digest('hex',);

/**
 Object URL the rule produces for the fixture image referenced from `pkg/README.md`.
 */
const FIXTURE_URL = `${FIXTURE_OBJECT_BASE}/${FIXTURE_OID}/pkg/asset/shot.png`;

/**
 Run an operation and return what it threw, or `undefined` when it settled.

 @param operation - operation expected to reject

 @returns caught value
 */
async function captureRejection(operation: () => Promise<unknown>,): Promise<unknown> {
  try {
    await operation();
    return undefined;
  }
  catch (error) {
    return error;
  }
}

/**
 Source with one LFS image and one pipe table, so two different rules apply.
 */
const SOURCE = '![shot](asset/shot.png)\n\n| A | B |\n| - | - |\n| 1 | 2 |\n';

await describe({
  name: runStdin.name,
  children: [
    it({
      name: 'fixes a piped source as if it lived at the given path',
      fn: async function fixes() {
        await using repo = await makeLfsRepo();
        /**
         Fix result for the README-like source.
         */
        const result = await runStdin({
          stdinPath: 'pkg/README.md',
          source: '![shot](asset/shot.png)\n',
          fix: true,
          reporter: 'json',
          cwd: repo.path,
        },);
        expect(result.fixedSource,).toBe(`![shot](${FIXTURE_URL})\n`,);
        expect(result.hadViolations,).toBe(false,);
      },
    },),
    it({
      name: 'reports without rewriting when fix is off',
      fn: async function reports() {
        await using repo = await makeLfsRepo();
        /**
         Lint result for the README-like source.
         */
        const result = await runStdin({
          stdinPath: 'pkg/README.md',
          source: '![shot](asset/shot.png)\n',
          fix: false,
          reporter: 'json',
          cwd: repo.path,
        },);
        expect(result.fixedSource,).toBe('![shot](asset/shot.png)\n',);
        expect(result.hadViolations,).toBe(true,);
        expect(result.output.includes('lfs-image-url',),).toBe(true,);
        expect(result.output.includes('pkg/README.md',),).toBe(true,);
      },
    },),
    it({
      name: 'runs only the selected rules',
      fn: async function selects() {
        await using repo = await makeLfsRepo();
        /**
         Fix result with only the LFS rule enabled; the pipe table stays.
         */
        const result = await runStdin({
          stdinPath: 'pkg/README.md',
          source: SOURCE,
          fix: true,
          reporter: 'json',
          cwd: repo.path,
          ruleIds: ['lfs-image-url',],
        },);
        expect(result.fixedSource.includes(FIXTURE_URL,),).toBe(true,);
        expect(result.fixedSource.includes('| A | B |',),).toBe(true,);
        expect(result.hadViolations,).toBe(false,);
      },
    },),
    it({
      name: 'honours the exclude patterns',
      fn: async function excludes() {
        await using repo = await makeLfsRepo();
        /**
         Fix result with the file excluded from the LFS rule.
         */
        const result = await runStdin({
          stdinPath: 'pkg/README.md',
          source: '![shot](asset/shot.png)\n',
          fix: true,
          reporter: 'json',
          cwd: repo.path,
          lfsImageExclude: ['pkg/',],
          ruleIds: ['lfs-image-url',],
        },);
        expect(result.fixedSource,).toBe('![shot](asset/shot.png)\n',);
      },
    },),
    it({
      name: 'treats an .mdx path as MDX',
      fn: async function mdx() {
        await using repo = await makeLfsRepo();
        /**
         Fix result for an MDX source with an import line.
         */
        const result = await runStdin({
          stdinPath: 'pkg/page.mdx',
          source: 'import X from "./x";\n\n![shot](asset/shot.png)\n',
          fix: true,
          reporter: 'json',
          cwd: repo.path,
          ruleIds: ['lfs-image-url',],
        },);
        expect(result.fixedSource.includes(FIXTURE_URL,),).toBe(true,);
      },
    },),
    it({
      name: 'rejects a path that is not Markdown or MDX',
      fn: async function rejects() {
        await using repo = await makeLfsRepo();
        /**
         Failure surfaced for a text path.
         */
        const caught = await captureRejection(async function reject(): Promise<unknown> {
          return await runStdin({
            stdinPath: join('pkg', 'notes.txt',),
            source: 'x',
            fix: false,
            reporter: 'json',
            cwd: repo.path,
          },);
        },);
        expect(caught,).toBeInstanceOf(StdinPathError,);
      },
    },),
  ],
},);
