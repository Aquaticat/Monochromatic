import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  ForbiddenStringsPluginError,
  parseCacheWarning,
} from '../dist/final/node/index.mjs';

/**
 * Exact valid warning records accepted by protocol.
 */
const VALID_WARNINGS = [
  '{"type":"forbidden-strings/cache-warning","schemaVersion":1,"reason":"missing","recovery":"compile-from-text"}',
  '{"type":"forbidden-strings/cache-warning","schemaVersion":1,"reason":"cache-root-unavailable","recovery":"compile-from-text"}',
  '{"type":"forbidden-strings/cache-warning","schemaVersion":1,"reason":"unreadable","recovery":"compile-from-text"}',
  '{"type":"forbidden-strings/cache-warning","schemaVersion":1,"reason":"source-mismatch","recovery":"compile-from-text"}',
  '{"type":"forbidden-strings/cache-warning","schemaVersion":1,"reason":"incompatible","recovery":"compile-from-text"}',
  '{"type":"forbidden-strings/cache-warning","schemaVersion":1,"reason":"invalid","recovery":"compile-from-text"}',
  '{"type":"forbidden-strings/cache-warning","schemaVersion":1,"reason":"write-failed","recovery":"continue-with-compiled-rules"}',
] as const;

await describe({
  name: parseCacheWarning.name,
  children: [
    ...VALID_WARNINGS.map(function warningCase(warning,) {
      return it({
        name: `accepts ${JSON.parse(warning,).reason as string}`,
        fn: async function acceptsWarning() {
          expect(parseCacheWarning(warning,),).toBe(true,);
        },
      },);
    },),
    it({
      name: 'returns false for plain finding',
      fn: async function plainFinding() {
        expect(parseCacheWarning('/tmp/candidate:2 rule=qqq-name',),).toBe(false,);
      },
    },),
    ...[
      '{',
      '{}',
      '[]',
      '{"type":"other","schemaVersion":1,"reason":"missing","recovery":"compile-from-text"}',
      '{"type":"forbidden-strings/cache-warning","schemaVersion":2,"reason":"missing","recovery":"compile-from-text"}',
      '{"type":"forbidden-strings/cache-warning","schemaVersion":1,"reason":"unknown","recovery":"compile-from-text"}',
      '{"type":"forbidden-strings/cache-warning","schemaVersion":1,"reason":"missing","recovery":"continue-with-compiled-rules"}',
      '{"type":"forbidden-strings/cache-warning","schemaVersion":1,"reason":"write-failed","recovery":"compile-from-text"}',
      '{"type":"forbidden-strings/cache-warning","schemaVersion":1,"reason":"missing","recovery":"compile-from-text","extra":true}',
    ].map(function invalidCase(line,) {
      return it({
        name: `rejects ${line}`,
        fn: async function rejectsInvalid() {
          let caught: unknown;
          try {
            parseCacheWarning(line,);
          }
          catch (error: unknown) {
            caught = error;
          }
          expect(caught,).toBeInstanceOf(ForbiddenStringsPluginError,);
        },
      },);
    },),
  ],
},);
