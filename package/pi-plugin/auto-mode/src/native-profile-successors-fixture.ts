/**
 Independent built consumers preserve original successor syntax and call ownership. @module
 */
import assert from 'node:assert/strict';
import {
  type CallSite,
  inspect,
  parseCall,
  patterns
} from './native-profile-call-fixture.ts';

/**
 Consumer declaration observations do not import implementation types.
 */
export type Successors = Readonly<{
  bindingName: string;
  groups: readonly Readonly<{
    ordinal: number;
    kind: string;
    members: readonly CallSite[]
  }>[];
  sites: readonly CallSite[];
  profile: string;
}>;
/**
 Malformed-runtime probes supply independent opaque inputs.
 */
type Input = Readonly<Record<string, unknown>>;
/**
 Built successor module has an independently expected call boundary.
 */
type SuccessorModule = Readonly<{ inspectProfileSuccessors: (input: Input) => Successors }>;

/**
 Narrow the built namespace without importing its declarations.

 @param value - rebuilt module namespace
 
 @returns narrowed independent consumer contract
 
 @throws Error for an absent inspection export
 */
function assertSuccessorModule(value: unknown): asserts value is SuccessorModule {
  assert.ok((value !== null) && ((typeof value) === 'object')
    && ('inspectProfileSuccessors' in value)
    && ((typeof value.inspectProfileSuccessors) === 'function'));
}
/**
 Consumer import resolves the rebuilt helper through the production loader.
 */
const loaded: unknown = await import(new URL(
  '../dist/native/contract/collector/program-rule-batch-sdk-copy-v2/input/profile-successors.ts',
  import.meta.url
).href);
assertSuccessorModule(loaded);
/**
 Explicit contract retains narrowing across fixture declarations.
 */
const successors: SuccessorModule = loaded;
/**
 Original producer identity is reusable without granting execution authority.
 */
export const producer: CallSite = inspect({
  group: 0,
  ordinal: 0
});

//region Parse original syntax and invoke independent built contracts.
/**
 Inspect original successor syntax with opaque consumer substitutions.

 @param source - original combinator expression
 
 @param input - original borrowed state and callback substitutions
 
 @returns original unfrozen successor declaration parts
 
 @throws Error for unsupported syntax or borrowed callback failures
 
 @example inspectSuccessors({});
 */
export function inspectSuccessors({
  source = 'Promise.all([tools.tool({ result })])',
  input = {}
}: Readonly<{
  source?: string;
  input?: Input
}> = {}): Successors {
  return successors.inspectProfileSuccessors({
    returned: { argument: { argument: parseCall(source) } },
    declaration: { id: { name: 'result' } },
    producer,
    allowed: new Set(['tool']),
    source,
    prefix: '',
    inspectCall: inspect,
    ResultProgramProfileError: patterns.ResultProgramProfileError,
    ...input,
  });
}
/**
 Construct synthetic group syntax for isolated original admission checks.

 @param input - original combinator overrides
 
 @returns original admitted-return envelope containing synthetic syntax
 
 @example returnedGroup({ optional: true });
 */
export function returnedGroup(input: Input = {}): object {
  return { argument: { argument: {
    type: 'CallExpression',
    optional: false,
    callee: {
      type: 'MemberExpression',
      computed: false,
      optional: false,
      object: {
        type: 'Identifier',
        name: 'Promise'
      },
      property: {
        type: 'Identifier',
        name: 'all'
      }
    },
    arguments: [{
      type: 'ArrayExpression',
      elements: [parseCall('tools.tool({})')]
    }],
    ...input,
  } } };
}
/**
 Assert the original diagnostic constructor and full message.

 @param source - syntax expected to reject
 
 @param message - original profile rejection detail
 
 @param input - opaque original runtime substitutions
 
 @throws Error when original rejection changes
 
 @example rejects({ source: 'Promise.race([])', message: 'native parallel combinator required' });
 */
export function rejects({
  source,
  message,
  input = {}
}: Readonly<{
  source?: string;
  message: string;
  input?: Input
}>): void {
  assert.throws(
    function rejectedSuccessors() {
    inspectSuccessors({
      ...(source === undefined ? {} : { source }),
      input
    });
  },
    {
      constructor: patterns.ResultProgramProfileError,
      name: 'ResultProgramProfileError',
      message: `Result-derived program is outside the inspected profile: ${message}`
    }
  );
}
//endregion
