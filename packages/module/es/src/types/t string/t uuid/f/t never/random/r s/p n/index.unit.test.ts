import {
  describe,
  expect,
  test,
} from 'bun:test';
import { $, } from './index.ts';

const $$ = '$';

describe($$, () => {
  const uuidV4Regex = /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;

  test('returns a valid UUID v4 format', () => {
    const uuid = $({},);
    expect(uuid,).toMatch(uuidV4Regex,);
  });

  test('generates different UUIDs on multiple calls', () => {
    const uuid1 = $({},);
    const uuid2 = $({},);
    expect(uuid1,).not.toBe(uuid2,);
  });

  test('accepts empty object parameter', () => {
    const uuid = $({},);
    expect(uuid,).toMatch(uuidV4Regex,);
  });

  test('generates unique UUIDs across multiple calls', () => {
    const uuids = new Set<string>();
    const callCount = 100;

    for (let callIndex = 0; callIndex < callCount; callIndex++)
      uuids.add($({},),);

    expect(uuids.size,).toBe(callCount,);
  });

  test('UUID version is always 4', () => {
    const uuids = Array.from({ length: 50, }, () => $({},),);

    uuids.forEach(uuid => {
      const versionChar = uuid.charAt(14,);
      expect(versionChar,).toBe('4',);
    },);
  });

  test('UUID variant is correct (8, 9, a, or b at position 19)', () => {
    const uuids = Array.from({ length: 50, }, () => $({},),);
    const validVariants = ['8', '9', 'a', 'b', 'A', 'B',];

    uuids.forEach(uuid => {
      const variantChar = uuid.charAt(19,);
      expect(validVariants,).toContain(variantChar.toLowerCase(),);
    },);
  });

  test('produces lowercase UUIDs', () => {
    const uuid = $({},);
    expect(uuid,).toBe(uuid.toLowerCase(),);
  });

  test('produces 36 character string (32 hex + 4 dashes)', () => {
    const uuid = $({},);
    expect(uuid,).toHaveLength(36,);
    expect(uuid.split('-',),).toHaveLength(5,);
  });
},);
