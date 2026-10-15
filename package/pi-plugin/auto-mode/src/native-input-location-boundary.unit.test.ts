/**
 Consumer controls for descriptor admission, native field shape, and ordinal bounds. @module
 */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { inputLocationCases, inputLocationFailure, sourceInputLocation } from './native-input-location-fixture.ts';

await describe({
  name: sourceInputLocation.name,
  children: [
    //region Malformed descriptors never acquire representation validity or invoke accessors.
    it({
      name: 'rejects a source accessor without reading its value',
      fn: function sourceAccessor() {
        const control = { reads: 0 };
        const source = Object.defineProperty({}, 'inputLocation', { get() { control.reads += 1; return { field: 'customPrompt' }; } });
        assert.throws(function readAccessor() { sourceInputLocation(source); }, inputLocationFailure('Source input location requires a data property'));
        assert.equal(control.reads, 0);
      },
    }),
    ...[null, undefined, false, 0, '', [], Object.create(null), function invalidPosition() { return undefined; }].map(function malformedLocation(inputLocation: unknown, index) {
      return it({
        name: `rejects nonordinary position fixture ${index}`,
        fn: function nonordinaryLocation() {
          assert.throws(function copyMalformed() { sourceInputLocation({ inputLocation }); }, inputLocationFailure('Source input location requires an ordinary record'));
        },
      });
    }),
    it({
      name: 'rejects empty, symbol-bearing, and excessive own key sets',
      fn: function unsupportedOwnKeys() {
        for (const inputLocation of [{}, { [Symbol('position')]: 'customPrompt' }, { field: 'customPrompt', a: 1, b: 2, c: 3 }]) {
          assert.throws(function copyUnsupportedKeys() { sourceInputLocation({ inputLocation }); }, inputLocationFailure('Source input location requires supported named slot fields'));
        }
      },
    }),
    it({
      name: 'rejects every accessor field before reading any location value',
      fn: function locationAccessor() {
        const control = { reads: 0 };
        for (const key of ['field', 'metadataJSON']) {
          const inputLocation = { field: 'managerInput', metadataJSON: '{}' };
          Object.defineProperty(inputLocation, key, { get() { control.reads += 1; return 'unowned'; } });
          assert.throws(function copyAccessorField() { sourceInputLocation({ inputLocation }); }, inputLocationFailure('Source input location requires data fields'));
        }
        assert.equal(control.reads, 0);
      },
    }),
    ...inputLocationCases.map(function malformedSlot(location) {
      return it({
        name: `rejects missing and unexpected fields in the original ${String(location.field)} shape`,
        fn: function exactSlotShape() {
          for (const key of Object.keys(location)) {
            const inputLocation = Object.fromEntries(Object.entries(location).filter(function omitOriginalField([name]) { return name !== key; }));
            assert.throws(function missingField() { sourceInputLocation({ inputLocation }); }, { name: 'SourceInputLocationError' });
          }
          assert.throws(function unexpectedField() { sourceInputLocation({ inputLocation: { ...location, extra: true } }); }, { name: 'SourceInputLocationError' });
          for (const [key, value] of Object.entries(location)) {
            if ((key === 'field') || ((typeof value) !== 'string')) continue;
            assert.throws(function nontextCompanion() { sourceInputLocation({ inputLocation: { ...location, [key]: 2 } }); }, { name: 'SourceInputLocationError' });
          }
        },
      });
    }),
    ...[-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1, '0', 0n, null].map(function malformedOrdinal(ordinal, index) {
      return it({
        name: `rejects malformed ordinal fixture ${index} in every ordered slot`,
        fn: function originalOrdinalBound() {
          for (const location of inputLocationCases) {
            if (!Object.hasOwn(location, 'ordinal')) continue;
            assert.throws(function malformedPosition() { sourceInputLocation({ inputLocation: { ...location, ordinal } }); }, { name: 'SourceInputLocationError' });
          }
        },
      });
    }),
    it({
      name: 'rejects unsupported field names without interpreting native metadata',
      fn: function unsupportedSlot() {
        for (const field of ['unsupported', 1, undefined, null, Symbol('field')]) {
          assert.throws(function unknownPosition() { sourceInputLocation({ inputLocation: { field } }); }, inputLocationFailure('Source input location names an unsupported native field'));
        }
      },
    }),
    //endregion
  ],
});
