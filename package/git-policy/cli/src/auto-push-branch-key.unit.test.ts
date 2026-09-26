/**
 Push coordination branch keys: reversible, flat, and case-insensitive-safe.

 @module
 */
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { internalTestExports, } from '../dist/final/node/index.mjs';

const {
  BranchKeyError,
  decodeBranchKey,
  encodeBranchKey,
} = internalTestExports;

/**
 Every character an encoded key may hold.
 */
const KEY_ALPHABET = new Set('abcdefghijklmnopqrstuvwxyz0123456789-_.%ABCDEF',);

/**
 Ref names covering slashes, case, reserved escape characters, dots, and non-ASCII text.
 */
const REF_NAMES: readonly string[] = [
  'refs/heads/main',
  'refs/heads/Main',
  'refs/heads/feat/ccc-push',
  'refs/heads/100%-done',
  'refs/heads/a.b_c-d',
  'refs/heads/über/zweig',
  'refs/heads/emoji-\u{1F600}',
];

await describe({
  name: encodeBranchKey.name,
  children: [
    it({
      name: 'round-trips every ref name through one flat file name drawn from lowercase letters, digits, punctuation, and uppercase hex escapes',
      fn: async function testRoundTrip(): Promise<void> {
        for (const refName of REF_NAMES) {
          /** Encoded key. */
          const key = encodeBranchKey(refName,);
          expect(key,).not.toContain('/',);
          expect(Array.from({ length: key.length, }, function characterAt(_unused, index,): string {
            return key.charAt(index,);
          },).every(function isKeyCharacter(character,): boolean {
            return KEY_ALPHABET.has(character,);
          },),).toBe(true,);
          expect(decodeBranchKey(key,),).toBe(refName,);
        }
      },
    },),
    it({
      name: 'escapes slashes, uppercase letters, and the escape character itself',
      fn: async function testEscapes(): Promise<void> {
        expect(encodeBranchKey('refs/heads/Main',),).toBe('refs%2Fheads%2F%4Dain',);
        expect(encodeBranchKey('refs/heads/100%',),).toBe('refs%2Fheads%2F100%25',);
      },
    },),
    it({
      name: 'maps ref names differing only in case to different keys',
      fn: async function testCaseDistinct(): Promise<void> {
        expect(encodeBranchKey('refs/heads/main',).toLowerCase(),)
          .not.toBe(encodeBranchKey('refs/heads/Main',).toLowerCase(),);
      },
    },),
  ],
},);

await describe({
  name: decodeBranchKey.name,
  children: [
    it({
      name: 'rejects keys encodeBranchKey never produces',
      fn: async function testRejects(): Promise<void> {
        for (const key of ['refs%2fheads', 'refs%2', 'refs%', 'refs%61', 'Refs', 'refs/heads', 'refs%FF',]) {
          expect(function decodeMalformed(): string {
            return decodeBranchKey(key,);
          },).toThrow(BranchKeyError,);
        }
      },
    },),
  ],
},);
