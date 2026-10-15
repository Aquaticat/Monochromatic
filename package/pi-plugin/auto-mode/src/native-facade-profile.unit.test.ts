/** Built original dependency profile validates configuration before any observation. @module */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { createFacadeFixture } from './native-facade-fixture.ts';

/** Each invalid option independently reaches an original bootstrap rejection branch. */
const invalidOptions = [
  { now: null }, { now: false }, { deadlineAt: Number.NaN }, { deadlineAt: Number.POSITIVE_INFINITY },
  { rootDirectory: false }, { rootDirectory: 'relative' }, { files: {} }, { trace: false },
] as const;

/** Every declared-file rejection is tested against an otherwise valid original profile. */
const invalidFiles = [
  { relativePath: null }, { requiredMode: -1 }, { requiredMode: 512 }, { requiredMode: 1.5 },
  { requiredMode: Number.NaN }, { maxBytes: 0 }, { maxBytes: 65_537 }, { maxBytes: 1.5 },
  { maxBytes: Number.NaN }, { read: false }, { read: null },
] as const;

//region Bootstrap checks must remain inert and preserve the original accepted file bounds.
await describe({ name: '', children: [
  ...invalidOptions.map(function configurationCase(change, ordinal) {
    return it({ name: `rejects invalid original facade configuration ${String(ordinal)} before callbacks`, fn: async function invalidConfiguration() {
      /** One original bootstrap value is replaced without changing other capabilities. */
      const f = createFacadeFixture();
      for (const [key, value] of Object.entries(change)) f.options[key] = value;
      assert.throws(function invalid() { 
        f.construct(); 
      }, {
        name: ('now' in change) || ('deadlineAt' in change) ? 'DependencyDeadlineError' : 'DependencyConfigurationError',
      });
      assert.deepEqual(f.events, []);
    } });
  }),
  ...invalidFiles.map(function profileCase(change, ordinal) {
    return it({ name: `rejects invalid original declared file ${String(ordinal)} before callbacks`, fn: async function invalidFile() {
      /** The invalid field is isolated from otherwise valid declared file values. */
      const f = createFacadeFixture();
      f.options.files = [{ relativePath: 'policy', requiredMode: 0o600, ...change }];
      assert.throws(function invalid() { 
        f.construct(); 
      }, { name: 'DependencyConfigurationError' });
      assert.deepEqual(f.events, []);
    } });
  }),
  ...[{}, { maxBytes: null }, { maxBytes: 1 }, { maxBytes: 65_536 }, { requiredMode: 0 }, { requiredMode: 511 }].map(function acceptedProfile(change, ordinal) {
    return it({ name: `preserves accepted original declaration ${String(ordinal)}`, fn: async function accepted() {
      /** Construction validates the profile without attempting file I/O. */
      const f = createFacadeFixture();
      f.options.files = [{ relativePath: 'policy', requiredMode: 0o600, ...change }];
      assert.equal(Object.isFrozen(f.construct()), true);
      assert.deepEqual(f.events, []);
    } });
  }),
] });
//endregion
