/**
 Native literal-rule instrumentation preserves original JavaScript boundaries in the built artifact.

 @module
 */
import { describe, expect, it } from '@monochromatic-dev/module-test/ts';
import { parse } from 'yuku-parser';

//region The copied build module supplies the consumer callable

/**
 Native builder consumers require only this source transformation.
 */
type NativeLiteralRules = {
  /** Original source must retain the qualified literal insertion membership. */
  readonly rewriteNativeLiteralRules: (source: string) => string;
};

/**
 Establish the callable export before exercising built source instrumentation.

 @param value - copied module loaded through its file URL

 @throws Error when the required built callable is missing
 */
function assertNativeLiteralRules(value: unknown): asserts value is NativeLiteralRules {
  if (((typeof value) !== 'object') || (value === null) || (!('rewriteNativeLiteralRules' in value))
    || ((typeof value.rewriteNativeLiteralRules) !== 'function')) throw new Error('Built native literal-rule module lacks its callable export');
}

/**
 Runtime import targets the copied native artifact rather than its implementation source.
 */
const built: unknown = await import(new URL('../dist/native/contract/integration/native-batch/build-literal-rules.ts', import.meta.url).href);
assertNativeLiteralRules(built);
/**
 Consumer assertions call the same transformation as native prompt preparation.
 */
const { rewriteNativeLiteralRules } = built;

//endregion The copied build module supplies the consumer callable

//region Only executable literal call statements acquire the original observation boundary

await describe({
  name: '',
  children: [
    it({
      name: 'retains comments, strings, dynamic calls, and source formatting',
      fn: async function originalCallSites() {
        /**
         These statements resemble native insertions but do not belong to the literal call profile.
         */
        const decoys = [
          '// addRule("comment");',
          'const text = "addRule(\\\"string\\\");";',
          'object.addRule("method");',
          'addRule?.("optional");',
          'addRule(variable);',
          'addRule(12);',
          'addRule(`template`);',
          'addRule("extra", another);',
          'function result() { return addRule("returned"); }',
        ].join('\n');
        /**
         Original calls include nested syntax, escaped identifier text, and comments before arguments.
         */
        const source = `${decoys}\naddRule("first");\nif (enabled) addRule ('second');\nfunction nested() { addRule(/* retained */"third"); addRu\\u006ce("fourth"); }\naddRule("fifth")\n`;
        /**
         Callee spans alone change; the original literal values and surrounding bytes stay intact.
         */
        const output = rewriteNativeLiteralRules(source);
        expect(output).toBe(`${decoys}\naddBuiltInRule("first");\nif (enabled) addBuiltInRule ('second');\nfunction nested() { addBuiltInRule(/* retained */"third"); addBuiltInRule("fourth"); }\naddBuiltInRule("fifth")\n`);
        expect(parse(output, { sourceType: 'module' }).diagnostics).toEqual([]);
      },
    }),
    it({
      name: 'preserves adversarial literal contents without creating executable statements',
      fn: async function literalContents() {
        /**
         Original strings exercise quote, comment, newline, Unicode, and interpolation boundaries.
         */
        const values = [
          'quote\'"; globalThis.injected=true; //',
          'line\nreturn\rseparator\u2028paragraph\u2029',
          '/* addRule("decoy"); */',
          `\\path/../\` \${globalThis.injected=true}`,
          'nul\u0000 rocket 🚀',
        ];
        /**
         Each original value is encoded at the fixture's JavaScript interpolation boundary.
         */
        const source = values.map(function originalRule(value) {
          return `addRule(${JSON.stringify(value)});`;
        }).join('\n');
        /**
         Expected source changes only the insertion callable for each original statement.
         */
        const expected = values.map(function observedRule(value) {
          return `addBuiltInRule(${JSON.stringify(value)});`;
        }).join('\n');
        /**
         The consuming parser detects any additional executable structure after rewriting.
         */
        const output = rewriteNativeLiteralRules(source);
        expect(output).toBe(expected);
        expect(parse(output, { sourceType: 'module' }).program.body).toHaveLength(values.length);
      },
    }),
    ...[4, 6].map(function changedMembership(count) {
      return it({
        name: `rejects changed literal insertion membership ${count}`,
        fn: async function unexpectedRuleCount() {
          expect(function requireQualifiedMembership() {
            rewriteNativeLiteralRules('addRule("literal");\n'.repeat(count));
          }).toThrow(`Native literal default-rule branches: expected 5, observed ${count}`);
        },
      });
    }),
    it({
      name: 'rejects unparsed source before selecting insertion sites',
      fn: async function invalidBuilder() {
        expect(function requireParsedBuilder() {
          rewriteNativeLiteralRules('function incomplete(');
        }).toThrow('Cannot parse native literal-rule source');
      },
    }),
  ],
});

//endregion Only executable literal call statements acquire the original observation boundary
