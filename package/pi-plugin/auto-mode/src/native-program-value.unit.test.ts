/**
 Native result conversion extraction retains original functions and rejects changed source qualification.

 @module
 */
import { describe, expect, it } from '@monochromatic-dev/module-test/ts';
import { parse } from 'yuku-parser';

//region The copied native module supplies the consuming source transformation

/**
 Native result preparation requires only its captured parser and original executor text.
 */
type NativeProgramValue = {
  /** Original conversion functions remain associated with their parsed source locations. */
  readonly nativeScriptValueSource: (input: {
    readonly source: string;
    readonly parse: typeof parse;
  }) => string;
};

/**
 Establish the built native callable before exercising result conversion extraction.

 @param value - copied module loaded through its file URL

 @throws Error when the required built callable is missing
 */
function assertNativeProgramValue(value: unknown): asserts value is NativeProgramValue {
  if (typeof value !== 'object' || value === null || !('nativeScriptValueSource' in value)
    || typeof value.nativeScriptValueSource !== 'function') throw new Error('Built native result conversion module lacks its callable export');
}

/**
 Runtime import targets the same copied preparation module as the native build.
 */
const built: unknown = await import(new URL('../dist/native/contract/integration/native-batch/program-value-source.ts', import.meta.url).href);
assertNativeProgramValue(built);
/**
 Consumer assertions call the installed native conversion extractor.
 */
const { nativeScriptValueSource } = built;

//endregion The copied native module supplies the consuming source transformation

//region Only qualified top-level conversion functions enter the generated module

await describe({
  name: '',
  children: [
    it({
      name: 'retains original conversion bodies in helper dependency order',
      fn: async function originalFunctions() {
        /**
         The literal crosses quote, newline, comment, path, and interpolation boundaries.
         */
        const literal = JSON.stringify('quote\'"; /* function textOf() {} */\n\\path/../` ${globalThis.injected=true}\u0000🚀');
        /**
         These complete original declarations must survive byte-for-byte.
         */
        const helper = `function textOf(value) { return value + ${literal}; }`;
        /**
         The exported converter retains its original reference to the private helper.
         */
        const converter = 'function toScriptValue(value) { return textOf(value); }';
        /**
         Similar syntax outside top-level function declarations cannot become a converter.
         */
        const source = [
          '// function textOf(comment) {}',
          `const decoy = ${JSON.stringify(converter)};`,
          'function nested() { function textOf() {} function toScriptValue() {} }',
          converter,
          helper,
        ].join('\n');
        /**
         Extraction orders the original helper before the exported converter without changing either body.
         */
        const output = nativeScriptValueSource({ source, parse });
        expect(output).toBe(`${helper}\n\nexport ${converter}\n`);
        expect(parse(output, { sourceType: 'module', semanticErrors: true }).diagnostics).toEqual([]);
      },
    }),
    ...['textOf', 'toScriptValue'].map(function missingFunction(name) {
      return it({
        name: `rejects absent original ${name} declaration`,
        fn: async function missingConverter() {
          /**
           One present original cannot supply the missing converter's identity.
           */
          const source = name === 'textOf' ? 'function toScriptValue() {}' : 'function textOf() {}';
          expect(function requireOriginalFunction() {
            nativeScriptValueSource({ source, parse });
          }).toThrow(`Original native result conversion function is unavailable or repeated: ${name}`);
        },
      });
    }),
    ...[
      'function textOf /* changed */() {}',
      'async function textOf() {}',
      'function t\\u0065xtOf() {}',
    ].map(function changedDeclaration(helper) {
      return it({
        name: `rejects changed original declaration ${helper}`,
        fn: async function unsupportedSpelling() {
          expect(function requireOriginalSpelling() {
            nativeScriptValueSource({ source: `${helper}\nfunction toScriptValue() {}`, parse });
          }).toThrow('Original native result conversion declaration changed: textOf');
        },
      });
    }),
    it({
      name: 'rejects invalid source before selecting conversion functions',
      fn: async function invalidExecutor() {
        expect(function requireParsedExecutor() {
          nativeScriptValueSource({ source: 'function incomplete(', parse });
        }).toThrow('Cannot parse original native result conversion source');
      },
    }),
    it({
      name: 'rejects duplicate module declarations before extraction',
      fn: async function repeatedConverter() {
        expect(function requireUniqueModuleDeclarations() {
          nativeScriptValueSource({ source: 'function textOf() {}\nfunction textOf() {}\nfunction toScriptValue() {}', parse });
        }).toThrow('Cannot parse original native result conversion source');
      },
    }),
  ],
});

//endregion Only qualified top-level conversion functions enter the generated module
