/**
 Built native member rewrites preserve original JavaScript syntax outside selected direct instance references.

 @module
 */
import { describe, expect, it } from '@monochromatic-dev/module-test/ts';
import { parse } from 'yuku-parser';

//region The consumer contract names only the built private-member transformation

/**
 Native source generators select decoded member names and retain their original source bytes.
 */
type NativeMembers = {
  /** Convert qualified original instance references to private member syntax. */
  readonly privatizeNativeMembers: (input: {
    /** Original parsed module whose matching private declarations already exist. */
    readonly source: string;
    /** Original decoded member names selected for private ownership. */
    readonly members: readonly string[];
  }) => string;
};

/**
 Verify the callable built export before exercising its source-generation contract.

 @param value - copied native module loaded through its file URL

 @throws Error when the required built export is missing
 */
function assertNativeMembers(value: unknown): asserts value is NativeMembers {
  if (((typeof value) !== 'object') || (value === null) || (!('privatizeNativeMembers' in value))
    || ((typeof value.privatizeNativeMembers) !== 'function')) throw new Error('Built native member module lacks its callable export');
}

/**
 Only the generated native artifact is loaded as the implementation under test.
 */
const built: unknown = await import(new URL('../dist/native/contract/integration/native-batch/build-members.ts', import.meta.url).href);
assertNativeMembers(built);
/**
 Consumer assertions exercise the transformation used by original native owner generators.
 */
const { privatizeNativeMembers } = built;

//endregion The consumer contract names only the built private-member transformation

//region Source parsing distinguishes qualified member references from textual lookalikes

await describe({
  name: '',
  children: [
    it({
      name: 'preserves nonmember text and unrelated accesses while retaining original identifier spelling',
      fn: async function originalMemberSpans() {
        /**
         Matching names inside strings, comments, computed access, and another receiver remain unchanged.
         */
        const retained = [
          'class State {',
          '  #state; #π;',
          '  read(other) {',
          '    // this.state',
          '    const text = "this.state";',
          '    other.state; this.stateful; this["state"]; this.#state;',
        ].join('\n');
        /**
         Original punctuation and source escapes remain visible around each selected identifier.
         */
        const source = `${retained}\n    this /* retained */ .state; this.st\\u0061te; this?.state; this.π;\n  }\n}`;
        /**
         Only the parser-owned original property token receives a private-name marker.
         */
        const output = privatizeNativeMembers({ source, members: ['state', 'π'] });
        expect(output).toBe(`${retained}\n    this /* retained */ .#state; this.#st\\u0061te; this?.#state; this.#π;\n  }\n}`);
        expect(parse(output, { sourceType: 'module' }).diagnostics).toEqual([]);
      },
    }),
    it({
      name: 'preserves unchanged source when no executable member is selected',
      fn: async function absentMemberSelection() {
        /**
         Arbitrary selected strings are lookup values and never become emitted source text.
         */
        const source = 'class State { read() { return this.state; } }';
        expect(privatizeNativeMembers({ source, members: [] })).toBe(source);
        expect(privatizeNativeMembers({ source, members: ['state; globalThis.injected=true;', '"}\n/*', '../state'] })).toBe(source);
      },
    }),
    it({
      name: 'rejects the reserved private constructor name before emitting source',
      fn: async function reservedPrivateName() {
        expect(function selectReservedName() {
          privatizeNativeMembers({ source: 'class State {}', members: ['constructor'] });
        }).toThrow('Native private member selection cannot include constructor');
      },
    }),
    it({
      name: 'rejects invalid original member source',
      fn: async function invalidMemberSource() {
        expect(function requireOriginalSyntax() {
          privatizeNativeMembers({ source: 'class State {', members: ['state'] });
        }).toThrow('Cannot parse native instance-member source');
      },
    }),
  ],
});

//endregion Source parsing distinguishes qualified member references from textual lookalikes
