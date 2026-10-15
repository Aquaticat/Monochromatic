/**
 Independent built consumers preserve original parser and pattern ownership. @module
 */
import assert from 'node:assert/strict';

/**
 Consumer observations do not import implementation declarations.
 */
export type CallSite = Readonly<{
  group: number;
  ordinal: number;
  name: string;
  pattern: object;
  callee: Readonly<{ start: number; end: number; text: string }>;
  alias: string;
}>;
/**
 Opaque overrides permit independent malformed-runtime fixtures.
 */
type CallInput = Readonly<Record<string, unknown>>;
/**
 Original built helper receives opaque consumer input.
 */
type CallModule = Readonly<{
  inspectProfileCall: (input: CallInput) => CallSite;
}>;
/**
 Parser fixtures need only the original expression statement boundary.
 */
type ParserModule = Readonly<{
  parse: (source: string) => Readonly<{
    diagnostics: readonly unknown[];
    program: Readonly<{ body: readonly Readonly<{ type: string; expression: unknown }>[] }>;
  }>;
}>;
/**
 Pattern consumers use the original private ownership checks.
 */
type PatternModule = Readonly<{
  ResultProgramProfileError: new (message: string) => Error;
  readPattern: (input: CallInput) => object;
  materializePattern: (input: Readonly<{ pattern: object; result?: string }>) => unknown;
}>;

/**
 Check the independently expected built call export.

 @param value - rebuilt call namespace

 @throws Error for an absent call inspection export
 */
function assertCallModule(value: unknown): asserts value is CallModule {
  assert.ok(value !== null && typeof value === 'object' && 'inspectProfileCall' in value
    && typeof value.inspectProfileCall === 'function');
}
/**
 Check the original parser export.

 @param value - rebuilt parser namespace

 @throws Error for an absent original parser
 */
function assertParserModule(value: unknown): asserts value is ParserModule {
  assert.ok(value !== null && typeof value === 'object' && 'parse' in value && typeof value.parse === 'function');
}
/**
 Check the original pattern owner and diagnostic exports.

 @param value - rebuilt pattern namespace

 @throws Error for an absent original pattern contract
 */
function assertPatternModule(value: unknown): asserts value is PatternModule {
  assert.ok(value !== null && typeof value === 'object'
    && 'readPattern' in value && typeof value.readPattern === 'function'
    && 'materializePattern' in value && typeof value.materializePattern === 'function'
    && 'ResultProgramProfileError' in value && typeof value.ResultProgramProfileError === 'function');
}
/**
 Built call inspection is loaded independently from the maintained source.
 */
const loaded: unknown = await import(new URL('../dist/native/contract/collector/program-rule-batch-sdk-copy-v2/input/profile-call.ts', import.meta.url).href);
assertCallModule(loaded);
/**
 Explicit contract retains narrowing across consumer function declarations.
 */
const calls: CallModule = loaded;
/**
 Built parser preserves the actual production syntax representation.
 */
const parsed: unknown = await import(new URL('../dist/native/contract/collector/program-rule-batch-sdk-copy-v2/input/parser.mjs', import.meta.url).href);
assertParserModule(parsed);
/**
 Original parser remains available to independent expression fixtures.
 */
const parser: ParserModule = parsed;
/**
 Built pattern decoder retains the production weak-set membership.
 */
const decoded: unknown = await import(new URL('../dist/native/contract/collector/program-rule-batch-sdk-copy-v2/input/result-pattern.mjs', import.meta.url).href);
assertPatternModule(decoded);
/**
 Original pattern functions remain independent of the extracted helper.
 */
export const patterns: PatternModule = decoded;

//region Build original parser inputs and invoke the rebuilt boundary.
/**
 Parse an expression through the built production parser.

 @param source - original expression text

 @returns original expression syntax

 @throws Error for unexpected parser diagnostics or statement shape
 */
export function parseCall(source: string): unknown {
  const result = parser.parse(source);
  assert.deepEqual(result.diagnostics, []);
  const [statement] = result.program.body;
  assert.ok(statement?.type === 'ExpressionStatement');
  return statement.expression;
}
/**
 Inspect a disposable original call with explicit consumer overrides.

 @param input - opaque original inputs and borrowed owner substitutions

 @returns original frozen callsite

 @throws Error for unsupported original calls or decoder failures
 */
export function inspect(input: CallInput = {}): CallSite {
  return calls.inspectProfileCall({
    call: parseCall('tools.tool({})'),
    group: 2,
    ordinal: 3,
    allowed: new Set(['tool']),
    source: 'tools.tool({})',
    prefix: '',
    readPattern: patterns.readPattern,
    ResultProgramProfileError: patterns.ResultProgramProfileError,
    ...input,
  });
}
/**
 Create synthetic parser nodes for original source-boundary probes.

 @param input - original callee boundary and member overrides

 @returns direct call whose argument decoder can be independently substituted
 */
export function syntheticCall(input: CallInput = {}): object {
  return {
    type: 'CallExpression', optional: false, arguments: [{}],
    callee: {
      type: 'MemberExpression', computed: false, optional: false,
      object: { type: 'Identifier', name: 'tools' },
      property: { type: 'Identifier', name: 'tool' },
      start: 0, end: 10,
      ...input,
    },
  };
}
//endregion
