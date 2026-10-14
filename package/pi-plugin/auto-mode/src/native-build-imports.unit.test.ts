/**
 Built native import rewrites preserve executable boundaries and unrelated source text.

 @module
 */
import { describe, expect, it } from '@monochromatic-dev/module-test/ts';
import { parse } from 'yuku-parser';
import { NativeImportBuildError, rewriteNativeImports } from '../dist/native/contract/integration/native-batch/build-imports.ts';

//region Source roles and original bytes remain observable at the built boundary

await describe({
  name: '',
  children: [
    it({
      name: 'rewrites static and nested literal imports while preserving unrelated source',
      fn: async function checkImportRoles() {
        /**
         Comments and strings deliberately resemble executable import declarations.
         */
        const source = [
          '// import decoy from "./comment.mjs";',
          'const text = "import(\\\"./string.mjs\\\")";',
          'import {',
          '  value,',
          '} from "./static.mjs";',
          'import "./side-effect.mjs";',
          'export { value } from "./named.mjs";',
          'export * from "./all.mjs";',
          'export const local = 1;',
          'export async function load(path) {',
          '  return [import("./dynamic.mjs"), import(path), 2, null];',
          '}',
        ].join('\n');
        /**
         Observed resolver calls distinguish native static and dynamic dependencies.
         */
        const observed: string[] = [];
        /**
         Only actual module strings receive this replacement prefix.
         */
        const rewritten = rewriteNativeImports({
          source,
          path: 'roles.mjs',
          select: function relocate({ specifier, kind }) {
            observed.push(`${kind}:${specifier}`);
            return `file:///qualified/${specifier.slice(2)}`;
          },
        });
        expect(observed).toEqual([
          'static:./static.mjs',
          'static:./side-effect.mjs',
          'static:./named.mjs',
          'static:./all.mjs',
          'dynamic:./dynamic.mjs',
        ]);
        expect(rewritten).toBe(source
          .replace('"./static.mjs"', '"file:///qualified/static.mjs"')
          .replace('"./side-effect.mjs"', '"file:///qualified/side-effect.mjs"')
          .replace('"./named.mjs"', '"file:///qualified/named.mjs"')
          .replace('"./all.mjs"', '"file:///qualified/all.mjs"')
          .replace('"./dynamic.mjs"', '"file:///qualified/dynamic.mjs"'));
        expect(parse(rewritten, { sourceType: 'module' }).diagnostics).toEqual([]);
      },
    }),
    it({
      name: 'preserves exact source when selection leaves imports unchanged',
      fn: async function checkUnchangedImports() {
        /**
         Original quoting, comments, and source escapes remain byte-for-byte unchanged.
         */
        const source = "import value from './a\\x2emjs';\n// retained\nexport { value };\n";
        expect(rewriteNativeImports({ source, path: 'unchanged.mjs', select: function preserve({ specifier }) { return specifier; } })).toBe(source);
        expect(rewriteNativeImports({ source: 'export const value = 1;', path: 'empty.mjs', select: function unused({ specifier }) { return specifier; } })).toBe('export const value = 1;');
      },
    }),
    it({
      name: 'rejects invalid original source before calling the resolver',
      fn: async function checkInvalidSource() {
        /**
         A failed parse must not select or emit any module replacement.
         */
        const calls: string[] = [];
        expect(function invalidImport() {
          rewriteNativeImports({ source: 'import {', path: 'broken.mjs', select: function record({ specifier }) { calls.push(specifier); return specifier; } });
        }).toThrow(NativeImportBuildError);
        expect(calls).toEqual([]);
      },
    }),

    //endregion Source roles and original bytes remain observable at the built boundary

    //region Encoded replacements cannot escape the original module literal

    ...[
      "./quote'\".mjs",
      './backslash\\file.mjs',
      './line\nreturn\rseparator\u2028paragraph\u2029.mjs',
      './`;globalThis.injected=true;//.mjs',
      './${globalThis.injected=true}.mjs',
      '../parent/../../module.mjs',
      './nul\u0000.mjs',
      './rocket-🚀.mjs',
    ].map(function boundaryCase(target, index) {
      return it({
        name: `retains adversarial module value inside one literal ${index}`,
        fn: async function checkLiteralEncoding() {
          /**
           Source-escaped original values must be decoded before selecting a replacement.
           */
          const source = 'import value from "./sou\\u0072ce.mjs";\nexport { value };';
          /**
           Resolver receives the decoded specifier rather than its original spelling.
           */
          const rewritten = rewriteNativeImports({ source, path: 'boundary.mjs', select: function replace({ specifier }) { expect(specifier).toBe('./source.mjs'); return target; } });
          /**
           Reparse the emitted JavaScript to detect any injected executable structure.
           */
          const parsed = parse(rewritten, { sourceType: 'module' });
          expect(parsed.diagnostics).toEqual([]);
          expect(parsed.program.body.length).toBe(2);
          /**
           The first declaration must remain the original import operation.
           */
          const [declaration] = parsed.program.body;
          if (declaration?.type !== 'ImportDeclaration') throw new NativeImportBuildError('Import boundary fixture lost its original declaration');
          expect(declaration.source.value).toBe(target);
          expect(rewritten).toBe(`import value from ${JSON.stringify(target)};\nexport { value };`);
        },
      });
    }),

    //endregion Encoded replacements cannot escape the original module literal
  ],
});
