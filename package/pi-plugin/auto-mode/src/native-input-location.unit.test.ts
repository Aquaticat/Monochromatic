/**
 Consumer verification of every native source position and unchanged wire values. @module
 */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { InputLocationError, inputLocationCases, sourceInputLocation } from './native-input-location-fixture.ts';

await describe({
  name: sourceInputLocation.name,
  children: [
    //region Supported native slots preserve exact supplied values and fresh mutable copies.
    ...inputLocationCases.map(function originalSlot(location) {
      return it({
        name: `copies the original ${String(location.field)} position without granting authority`,
        fn: async function copyOriginalSlot() {
          const original = Object.freeze({ ...location });
          const source = Object.freeze({ inputLocation: original });
          const result = sourceInputLocation(source);
          assert.deepEqual(result, { inputLocation: original });
          assert.notEqual(result.inputLocation, original);
          assert.notEqual(result.inputLocation, sourceInputLocation(source).inputLocation);
          assert.equal(Object.isFrozen(result), false);
          assert.equal(Object.isFrozen(result.inputLocation), false);
          assert.deepEqual(Reflect.ownKeys(result), ['inputLocation']);
        },
      });
    }),
    it({
      name: 'omits missing and inherited positions while admitting hidden own data fields',
      fn: async function ownLocationMembership() {
        const inherited: unknown = Object.create({ inputLocation: { field: 'customPrompt' } });
        assert.deepEqual(sourceInputLocation({}), {});
        assert.deepEqual(sourceInputLocation(inherited), {});
        const location = Object.defineProperty({}, 'field', { value: 'customPrompt' });
        const source = Object.defineProperty({}, 'inputLocation', { value: location });
        assert.deepEqual(sourceInputLocation(source), { inputLocation: { field: 'customPrompt' } });
        assert.deepEqual(sourceInputLocation(Object.freeze([])), {});
      },
    }),
    ...[-0, Number.MAX_SAFE_INTEGER].map(function validOrdinal(ordinal) {
      return it({
        name: `retains the admitted ordinal ${Object.is(ordinal, -0) ? 'negative zero' : 'maximum safe integer'}`,
        fn: async function ordinalBoundary() {
          for (const location of inputLocationCases) {
            if (!Object.hasOwn(location, 'ordinal')) continue;
            const inputLocation = { ...location, ordinal };
            assert.deepEqual(sourceInputLocation({ inputLocation }), { inputLocation });
          }
        },
      });
    }),
    it({
      name: 'copies delimiter and traversal text without parsing or normalizing companion values',
      fn: async function opaqueCompanionText() {
        const adversarial = `../..\\path\n"quoted"\r\t\${value}; \`command\` */ <script> 雪 🧭`;
        for (const location of inputLocationCases) {
          const inputLocation = Object.fromEntries(Object.entries(location).map(function replaceCompanion([key, value]) {
            return [key, ((key !== 'field') && ((typeof value) === 'string')) ? adversarial : value];
          }));
          assert.deepEqual(sourceInputLocation({ inputLocation }), { inputLocation });
        }
      },
    }),
    it({
      name: 'retains a stable operation category under ordinary and derived error construction',
      fn: async function stableErrorCategory() {
        const ordinary = new InputLocationError('Original diagnostic');
        assert.equal(ordinary.name, 'SourceInputLocationError');
        assert.equal(ordinary.message, 'Original diagnostic');
        const derived: unknown = Reflect.construct(InputLocationError, ['Derived diagnostic'], TypeError);
        assert.ok(derived instanceof TypeError);
        assert.equal(derived.name, 'SourceInputLocationError');
        assert.equal(derived.message, 'Derived diagnostic');
      },
    }),
    //endregion
  ],
});
