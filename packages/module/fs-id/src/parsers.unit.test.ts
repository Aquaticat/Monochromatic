import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  createFsId,
  isFsId,
  normalizeIdentityPayload,
  parseDiskutilVolumeUuid,
  parseFindmntUuid,
  parseVolumeSerial,
  windowsDriveRoot,
} from '../dist/final/node/index.mjs';

/**
 * Run length proving parser uses bounded-stack iteration.
 *
 * @example
 * ```ts
 * 'A'.repeat(LONG_RUN);
 * ```
 */
const LONG_RUN = 50_000;

/**
 * Unsafe payload examples rejected by identity grammar.
 *
 * @example
 * ```ts
 * UNSAFE_PAYLOADS.includes('a:b');
 * ```
 */
const UNSAFE_PAYLOADS: readonly string[] = [
  '',
  '-',
  'a:b',
  'a/b',
  String.raw`a\b`,
  'a b',
  'é',
  'a'.repeat(513,),
];

/**
 * ASCII serial terminators and expected prefix.
 *
 * @example
 * ```ts
 * SERIAL_TERMINATORS[0];
 * ```
 */
const SERIAL_TERMINATORS: readonly string[] = [
  ' ',
  '\t',
  '\n',
  '\r',
  '\f',
  '\v',
];

await describe({
  name: '',
  children: [
    describe({
      name: normalizeIdentityPayload.name,
      children: [
        it({
          name: 'normalizes safe ASCII payload',
          fn: async () => {
            expect(normalizeIdentityPayload(' 1A2B-3C4D\n',),).toBe('1a2b-3c4d',);
          },
        },),
        ...UNSAFE_PAYLOADS.map(function unsafePayloadTest(payload,) {
          return it({
            name: `rejects unsafe payload ${JSON.stringify(payload.slice(0, 20,),)}`,
            fn: async () => {
              expect(() => normalizeIdentityPayload(payload,),).toThrow(TypeError,);
            },
          },);
        },),
      ],
    },),
    describe({
      name: createFsId.name,
      children: [
        it({
          name: 'qualifies normalized payload with source',
          fn: async () => {
            expect(createFsId({ source: 'fs-uuid', payload: 'ABCD', },),).toBe('fs-uuid_abcd',);
          },
        },),
        it({
          name: 'throws for unsafe payload',
          fn: async () => {
            expect(() => createFsId({ source: 'fs-uuid', payload: 'a:b', },),).toThrow(TypeError,);
          },
        },),
      ],
    },),
    describe({
      name: isFsId.name,
      children: [
        it({
          name: 'accepts every generated source prefix',
          fn: async () => {
            expect([
              'fs-uuid_abcd',
              'volume-uuid_abcd',
              'volume-serial_1a2b-3c4d',
              'f-fsid_abcd',
              'device-number_1',
            ].every(function valueIsFsId(value,): boolean {
              return isFsId(value,);
            },),).toBe(true,);
          },
        },),
        it({
          name: 'rejects unknown prefix and colon',
          fn: async () => {
            expect(isFsId('unknown_abcd',),).toBe(false,);
            expect(isFsId('fs-uuid_a:b',),).toBe(false,);
          },
        },),
      ],
    },),
    describe({
      name: parseFindmntUuid.name,
      children: [
        it({
          name: 'parses trimmed UUID',
          fn: async () => {
            expect(parseFindmntUuid(' ABCD-1234\n',),).toBe('abcd-1234',);
          },
        },),
        it({
          name: 'rejects absent UUID marker',
          fn: async () => {
            expect(() => parseFindmntUuid('-\n',),).toThrow(TypeError,);
          },
        },),
      ],
    },),
    describe({
      name: parseDiskutilVolumeUuid.name,
      children: [
        it({
          name: 'parses indented case-insensitive field',
          fn: async () => {
            expect(parseDiskutilVolumeUuid('Device: disk3\n   VOLUME UUID: ABCD-1234\n',),)
              .toBe('abcd-1234',);
          },
        },),
        it({
          name: 'rejects absent and unsafe fields',
          fn: async () => {
            expect(() => parseDiskutilVolumeUuid('Device: disk3\n',),).toThrow(TypeError,);
            expect(() => parseDiskutilVolumeUuid('Volume UUID: a:b\n',),).toThrow(TypeError,);
          },
        },),
      ],
    },),
    describe({
      name: parseVolumeSerial.name,
      children: [
        it({
          name: 'returns empty when label is absent or has no token',
          fn: async () => {
            expect(parseVolumeSerial('',),).toBe('',);
            expect(parseVolumeSerial('Volume has no label',),).toBe('',);
            expect(parseVolumeSerial('Serial Number is  \t',),).toBe('',);
          },
        },),
        it({
          name: 'matches case-insensitively and skips inline whitespace',
          fn: async () => {
            expect(parseVolumeSerial('SERIAL NUMBER IS \t 1A2B-3C4D\r\n',),).toBe('1A2B-3C4D',);
          },
        },),
        ...SERIAL_TERMINATORS.map(function serialTerminatorTest(terminator,) {
          return it({
            name: `stops at ${JSON.stringify(terminator,)}`,
            fn: async () => {
              expect(parseVolumeSerial(`Serial Number is AB${terminator}CD`,),).toBe('AB',);
            },
          },);
        },),
        it({
          name: 'handles long token and whitespace without recursion',
          fn: async () => {
            /**
             * Long serial payload.
             */
            const token = 'A'.repeat(LONG_RUN,);
            expect(parseVolumeSerial(`Serial Number is ${token}`,),).toBe(token,);
            expect(parseVolumeSerial(`Serial Number is${' '.repeat(LONG_RUN,)}XY`,),).toBe('XY',);
          },
        },),
      ],
    },),
    describe({
      name: windowsDriveRoot.name,
      children: [
        it({
          name: 'normalizes slash and letter case',
          fn: async () => {
            expect(windowsDriveRoot('c:/repo',),).toBe('C:\\',);
            expect(windowsDriveRoot(String.raw`D:\repo`,),).toBe('D:\\',);
          },
        },),
        it({
          name: 'rejects relative UNC and command-shaped roots',
          fn: async () => {
            expect(() => windowsDriveRoot('repo',),).toThrow();
            expect(() => windowsDriveRoot(String.raw`\\server\share`,),).toThrow();
            expect(() => windowsDriveRoot('C:&calc',),).toThrow();
          },
        },),
      ],
    },),
  ],
},);
