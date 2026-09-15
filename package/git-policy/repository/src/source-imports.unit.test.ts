/** Bundled import detection unit tests. @module */
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  importsPackage,
  isNonTestSourcePath,
} from '../dist/final/node/index.mjs';

await describe({
  name: '',
  children: [
    describe({
      name: importsPackage.name,
      children: [
        ...[
          "import { a } from '@scope/b';",
          'import type { A } from "@scope/b/ts";',
          "import '@scope/b';",
          "export * from '@scope/b';",
          "const m = await import('@scope/b');",
          'const m = await import ( `@scope/b/sub` );',
          "const m = require('@scope/b');",
          "import { a }\nfrom\n'@scope/b';",
        ].map(function acceptSource(sourceText,) {
          return it({
            name: `detects ${JSON.stringify(sourceText,)}`,
            fn: async function testDetected(): Promise<void> {
              expect(importsPackage({ sourceText, packageName: '@scope/b', },),).toBe(true,);
            },
          },);
        },),
        ...[
          "import { a } from '@scope/bc';",
          "const name = '@scope/b';",
          "reimport '@scope/b';",
          "myrequire('@scope/b');",
          "import { a } from 'x@scope/b';",
          '@scope/b',
          '',
        ].map(function rejectSource(sourceText,) {
          return it({
            name: `ignores ${JSON.stringify(sourceText,)}`,
            fn: async function testIgnored(): Promise<void> {
              expect(importsPackage({ sourceText, packageName: '@scope/b', },),).toBe(false,);
            },
          },);
        },),
        it({
          name: 'finds a later specifier after an earlier non-specifier mention',
          fn: async function testLaterOccurrence(): Promise<void> {
            expect(importsPackage({
              sourceText: "const note = '@scope/b';\nimport { a } from '@scope/b';",
              packageName: '@scope/b',
            },),).toBe(true,);
          },
        },),
      ],
    },),
    describe({
      name: isNonTestSourcePath.name,
      children: [
        it({
          name: 'accepts source files under the package src directory',
          fn: async function testAccepted(): Promise<void> {
            expect(isNonTestSourcePath({ directory: 'package/module/a', path: 'package/module/a/src/index.ts', },),).toBe(true,);
            expect(isNonTestSourcePath({ directory: 'package/module/a', path: 'package/module/a/src/deep/view.tsx', },),).toBe(true,);
          },
        },),
        it({
          name: 'rejects tests, other extensions, other directories, and sibling prefixes',
          fn: async function testRejected(): Promise<void> {
            expect(isNonTestSourcePath({ directory: 'package/module/a', path: 'package/module/a/src/index.unit.test.ts', },),).toBe(false,);
            expect(isNonTestSourcePath({ directory: 'package/module/a', path: 'package/module/a/src/README.md', },),).toBe(false,);
            expect(isNonTestSourcePath({ directory: 'package/module/a', path: 'package/module/a/test/index.ts', },),).toBe(false,);
            expect(isNonTestSourcePath({ directory: 'package/module/a', path: 'package/module/ab/src/index.ts', },),).toBe(false,);
          },
        },),
      ],
    },),
  ],
},);
