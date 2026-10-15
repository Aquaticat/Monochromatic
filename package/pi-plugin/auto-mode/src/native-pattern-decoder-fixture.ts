/**
 Independent consumers use rebuilt syntax decoding and original private ownership. @module
 */
import assert from 'node:assert/strict';
import {
  parseCall,
  patterns
} from './native-profile-call-fixture.ts';

/**
 Consumer observations deliberately avoid implementation declarations.
 */
export type Pattern = Readonly<
  {
    kind: 'literal';
    value: unknown
  }
  | { kind: 'result' }
  | {
    kind: 'array';
    items: readonly Pattern[]
  }
  | {
    kind: 'object';
    entries: readonly Readonly<{
      key: string;
      pattern: Pattern
    }>[]
  }
>;
/**
 Opaque runtime inputs allow malformed parser fixtures independently of production types.
 */
type Input = Readonly<Record<string, unknown>>;
/**
 Built consumers expect only the independently named decoding export.
 */
type Decoder = Readonly<{ readOwnedPattern: (input: Input) => Pattern }>;

/**
 Check the independently expected decoder export.

 @param value - rebuilt decoder namespace

 @returns narrowed independent consumer contract

 @throws Error for absent decoding export
 */
function assertDecoder(value: unknown): asserts value is Decoder {
  assert.ok((value !== null) && ((typeof value) === 'object')
    && ('readOwnedPattern' in value)
    && ((typeof value.readOwnedPattern) === 'function'));
}
/**
 Built helper retains its original borrowed owner boundary.
 */
const loaded: unknown = await import(new URL(
  '../dist/native/contract/collector/program-rule-batch-sdk-copy-v2/input/pattern-decoder.ts',
  import.meta.url
).href);
assertDecoder(loaded);
/**
 Explicit consumer type follows runtime export admission.
 */
const decoder: Decoder = loaded;

//region Construct original parser inputs and invoke rebuilt boundaries.
/**
 Parse argument syntax through the built production parser.

 @param source - original argument text

 @returns original parser node by identity

 @throws Error for invalid parser fixture

 @example parseArgument('{ value: 1 }');
 */
export function parseArgument(source: string): unknown {
  /**
   Original direct call provides its untouched argument node.
   */
  const call = parseCall(`tools.tool(${source})`);
  assert.ok((call !== null) && ((typeof call) === 'object')
    && ('arguments' in call)
    && Array.isArray(call.arguments));
  return call.arguments[0];
}
/**
 Decode with independent ownership unless a test supplies the original owner.

 @param input - original node and explicit borrowed callback overrides

 @returns original borrowed owner's pattern result

 @throws Error for unsupported input or borrowed owner failure

 @example decode({ node: parseArgument('null') });
 */
export function decode(input: Input): Pattern {
  return decoder.readOwnedPattern({
    node: undefined,
    bindingName: undefined,
    depth: 0,
    owned: Object.freeze,
    ResultProgramProfileError: patterns.ResultProgramProfileError,
    ...input
  });
}
/**
 Require exact original profile diagnostics rather than arbitrary failure.

 @param input - independently malformed original decoder input

 @param message - expected original diagnostic suffix

 @example rejects({ input: { depth: 9 }, message: 'argument nesting exceeds profile' });
 */
export function rejects({
  input,
  message
}: Readonly<{
  input: Input;
  message: string
}>): void {
  assert.throws(
    function rejectedPattern() { 
      decode(input); 
    },
    {
      constructor: patterns.ResultProgramProfileError,
      name: 'ResultProgramProfileError',
      message: `Result-derived program is outside the inspected profile: ${message}`,
    }
  );
}
/**
 Synthetic property inputs isolate guards that real syntax may overlap.

 @param input - independently overridden original property fields

 @returns original object shape containing one ordinary data property

 @example objectNode({ computed: true });
 */
export function objectNode(input: Input = {}): object {
  return {
    type: 'ObjectExpression',
    properties: [{
      type: 'Property',
      computed: false,
      method: false,
      kind: 'init',
      shorthand: false,
      key: { type: 'Identifier', name: 'value' },
      value: { type: 'Literal', value: 1 },
      ...input
    }]
  };
}
//endregion
