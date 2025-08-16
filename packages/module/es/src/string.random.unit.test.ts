import {
  logtapeConfiguration,
  logtapeConfigure,
  randomUUID,
} from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration());

describe('randomUUID', () => {
  test('should return a valid UUID v4 format', () => {
    const uuid = randomUUID();
    
    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    // where x is any hexadecimal digit and y is one of 8, 9, A, or B
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    expect(uuid).toMatch(uuidPattern);
  });

  test('should return different UUIDs on multiple calls', () => {
    const uuid1 = randomUUID();
    const uuid2 = randomUUID();
    const uuid3 = randomUUID();
    
    expect(uuid1).not.toBe(uuid2);
    expect(uuid2).not.toBe(uuid3);
    expect(uuid1).not.toBe(uuid3);
  });

  test('should return a string of correct length', () => {
    const uuid = randomUUID();
    
    // Standard UUID format is 36 characters (including hyphens)
    expect(uuid).toHaveLength(36);
  });

  test('should always have hyphens in correct positions', () => {
    const uuid = randomUUID();
    
    expect(uuid.charAt(8)).toBe('-');
    expect(uuid.charAt(13)).toBe('-');
    expect(uuid.charAt(18)).toBe('-');
    expect(uuid.charAt(23)).toBe('-');
  });

  test('should always have version 4 identifier', () => {
    const uuid = randomUUID();
    
    // Position 14 should always be '4' for UUID v4
    expect(uuid.charAt(14)).toBe('4');
  });

  test('should have correct variant bits', () => {
    const uuid = randomUUID();
    
    // Position 19 should be one of '8', '9', 'a', 'b' (or uppercase)
    const variantChar = uuid.charAt(19).toLowerCase();
    expect(['8', '9', 'a', 'b']).toContain(variantChar);
  });
});