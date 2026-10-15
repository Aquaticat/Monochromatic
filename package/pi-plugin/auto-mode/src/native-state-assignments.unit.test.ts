/**
 Native source guards count executable message assignments in the copied build artifact.

 @module
 */
import { describe, expect, it } from '@monochromatic-dev/module-test/ts';

//region Built source qualification retains a callable consumer contract

/**
 Only the assignment qualification boundary is needed by these consumers.
 */
type NativeStateBuild = {
  /** Source drift has a separate error constructor. */
  readonly NativeStateBuildError: new(message: string) => Error;
  /** Each original native owner must retain exactly one executable assignment. */
  readonly assertNativeMessageAssignment: (input: {
    /** Original module text, including non-executable decoys. */
    readonly source: string;
    /** Native owner selects its original access path. */
    readonly owner: 'Agent' | 'Session';
  }) => void;
};

/**
 Check copied module exports before invoking their consumer contract.

 @param value - built namespace loaded by URL

 @throws Error when the native build artifact lacks a required callable
 */
function assertNativeStateBuild(value: unknown): asserts value is NativeStateBuild {
  if (((typeof value) !== 'object') || (value === null) || (!('NativeStateBuildError' in value))
    || ((typeof value.NativeStateBuildError) !== 'function') || (!('assertNativeMessageAssignment' in value))
    || ((typeof value.assertNativeMessageAssignment) !== 'function')) throw new Error('Built native state module lacks its callable exports');
}

/**
 Import the copied artifact without adding generated source to the package type-check scope.
 */
const built: unknown = await import(new URL('../dist/native/contract/integration/native-batch/build-state-assignments.ts', import.meta.url).href);
assertNativeStateBuild(built);
/**
 Consumer assertions exercise the same module used by native preparation.
 */
const { NativeStateBuildError, assertNativeMessageAssignment } = built;

//endregion Built source qualification retains a callable consumer contract

//region Each owner counts only executable assignments to its original path

await describe({
  name: '',
  children: [
    ...(['Agent', 'Session'] as const).map(function nativeOwner(owner) {
      /**
       Native owner paths differ before their shared message leaf.
       */
      const target = owner === 'Agent' ? 'this._state' : 'this.agent.state';
      return describe({
        name: owner,
        children: [
          it({
            name: 'ignores comments, strings, reads, and unrelated assignment owners',
            fn: async function originalAssignment() {
              /**
               Decoys include real assignment spelling without any executable write to this owner.
               */
              const source = [
                `// ${target}.messages = [];`,
                `const text = ${JSON.stringify(`${target}.messages = [];`)};`,
                `/* ${target}.messages = []; */`,
                `${target}.messages === [];`,
                `${target}.messages;`,
                'other.agent.state.messages = [];',
                'other._state.messages = [];',
                'messages = [];',
                `${target}.tools = [];`,
                `${target}[key] = [];`,
                `${target}.messages = [];`,
              ].join('\n');
              expect(assertNativeMessageAssignment({ source, owner })).toBeUndefined();
            },
          }),
          ...['.messages', String.raw`.mes\u0073ages`, '["messages"]'].map(function assignmentSpelling(leaf) {
            return it({
              name: `retains decoded executable assignment ${leaf}`,
              fn: async function decodedAssignment() {
                expect(assertNativeMessageAssignment({ source: `${target}${leaf} = [];`, owner })).toBeUndefined();
              },
            });
          }),
          it({
            name: 'rejects absent original assignments',
            fn: async function absentAssignment() {
              expect(function requireOriginalWrite() {
                assertNativeMessageAssignment({ source: `${target}.messages;`, owner });
              }).toThrow(NativeStateBuildError);
            },
          }),
          it({
            name: 'rejects an additional nested assignment with another operator',
            fn: async function addedAssignment() {
              expect(function requireSingleWrite() {
                assertNativeMessageAssignment({ source: `${target}.messages = []; function added() { ${target}["messages"] ||= []; }`, owner });
              }).toThrow(NativeStateBuildError);
            },
          }),
        ],
      });
    }),
    it({
      name: 'rejects invalid source before interpreting assignment membership',
      fn: async function invalidSource() {
        expect(function requireParsedSource() {
          assertNativeMessageAssignment({ source: 'export const value =', owner: 'Agent' });
        }).toThrow('Cannot parse native Agent assignment source');
      },
    }),
  ],
});

//endregion Each owner counts only executable assignments to its original path
