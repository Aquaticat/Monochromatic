/**
 Built consumer verification for original native JSON traversal and judgment construction failures. @module
 */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';

/**
 Independent consumer contract exposes runtime malformed inputs without importing implementation types.
 */
type JudgmentInputModule = Readonly<{
  requireJSONInput: (input: unknown) => void;
  JudgmentConstructionError: new (message: string, options?: ErrorOptions) => Error;
}>;

/**
 Require the original input-admission exports before exercising native serialization.

 @param value - unknown built namespace

 @returns assertion exposing the independent judgment-input consumer contract

 @throws Error for an unavailable original native input export
 */
function assertJudgmentInputModule(value: unknown): asserts value is JudgmentInputModule {
  if ((value === null) || ((typeof value) !== 'object')
    || (!('requireJSONInput' in value)) || ((typeof value.requireJSONInput) !== 'function')
    || (!('JudgmentConstructionError' in value)) || ((typeof value.JudgmentConstructionError) !== 'function')) throw new Error('Built native judgment input exports are unavailable');
}

/**
 Tests consume the original entry path after rebuilding its maintained native artifact.
 */
const loaded: unknown = await import(new URL('../dist/native/contract/collector/program-rule-batch-sdk-copy-v2/input/judgment-input.mjs', import.meta.url).href);
assertJudgmentInputModule(loaded);
/**
 Runtime export admission retains the original JSON checker and error constructor.
 */
const { requireJSONInput, JudgmentConstructionError } = loaded;

await describe({
  name: requireJSONInput.name,
  children: [
    //region Original JSON traversal accepts preserved values and rejects reached lossy numeric or missing values.
    ...[null, true, false, 0, 1.5, Number.MAX_VALUE, '', '雪 🧭', [], {}, { nested: [null, true, { text: '../..\\path\n"quoted"' }] }].map(function preservedInput(input, index) {
      return it({
        name: `admits preserved JSON fixture ${index} without returning serialized text`,
        fn: async function preservedJSON() {
          assert.equal(requireJSONInput(input), undefined);
        },
      });
    }),
    ...[undefined, -0, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY].map(function lossyInput(value, index) {
      return it({
        name: `rejects lossy fixture ${index} at root, array, and nested object positions`,
        fn: async function lossyJSON() {
          for (const input of [value, [value], { nested: { value } }]) {
            assert.throws(function originalJSONTraversal() {
              requireJSONInput(input);
            }, { name: 'JudgmentConstructionError', message: 'Native tool input contains a value not preserved by the declared JSON profile' });
          }
        },
      });
    }),
    it({
      name: 'rejects an original array hole reached as an undefined value',
      fn: async function sparseJSON() {
        assert.throws(function omittedArrayValue() {
          requireJSONInput(Array.from({ length: 1 }).map(function createHole() { 
            return undefined; 
          }));
        }, { name: 'JudgmentConstructionError' });
        assert.throws(function originalArrayHole() {
          requireJSONInput(new Array(1));
        }, { name: 'JudgmentConstructionError' });
      },
    }),
    it({
      name: 'retains native cyclic and bigint serialization errors',
      fn: async function nativeJSONFailure() {
        const cycle: { self?: object } = {};
        cycle.self = cycle;
        for (const input of [cycle, 1n, { value: 1n }]) {
          assert.throws(function nativeSerializerRejects() {
            requireJSONInput(input);
          }, { name: 'TypeError' });
        }
      },
    }),
    it({
      name: 'retains original toJSON and getter ordering without broadening structural admission',
      fn: async function nativeCallbackOrder() {
        const events: string[] = [];
        const input = {
          get value() {
            events.push('get');
            return { toJSON() { 
              events.push('toJSON'); 
              return 1; 
            } };
          },
        };
        requireJSONInput(input);
        assert.deepEqual(events, ['get', 'toJSON']);
        assert.throws(function callbackReturnsMissing() {
          requireJSONInput({ toJSON() { 
            return undefined; 
          } });
        }, { name: 'JudgmentConstructionError' });
        const failure = new Error('Original JSON callback failure');
        assert.throws(function callbackThrowsOriginal() {
          requireJSONInput({ toJSON() { 
            throw failure; 
          } });
        }, function preservesOriginalFailure(error: unknown) { 
          return error === failure; 
        });
      },
    }),
    it({
      name: 'preserves the existing limited check for non-JSON values owned by earlier structural admission',
      fn: async function unchangedStructuralBoundary() {
        for (const value of [Symbol('original unsupported JSON input value'), function unadmittedCallable() { 
          return undefined; 
        }]) {
          assert.equal(requireJSONInput(value), undefined);
          assert.equal(requireJSONInput({ value }), undefined);
          assert.equal(requireJSONInput([value]), undefined);
        }
        assert.equal(requireJSONInput(new Date('2026-01-01T00:00:00.000Z')), undefined);
      },
    }),
    it({
      name: 'retains message and cause with a stable judgment construction category',
      fn: async function stableConstructionError() {
        const cause = new Error('Original construction cause');
        const error = new JudgmentConstructionError('Original diagnostic', { cause });
        assert.equal(error.message, 'Original diagnostic');
        assert.equal(error.cause, cause);
        assert.equal(error.name, 'JudgmentConstructionError');
        const derived: unknown = Reflect.construct(JudgmentConstructionError, ['Derived diagnostic', { cause }], TypeError);
        assert.ok(derived instanceof TypeError);
        assert.equal(derived.message, 'Derived diagnostic');
        assert.equal(derived.cause, cause);
        assert.equal(derived.name, 'JudgmentConstructionError');
      },
    }),
    //endregion
  ],
});
