import {
  logtapeConfiguration,
  logtapeConfigure,
  objectExtract,
  objectExtractSync,
} from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration());

describe('objectExtractSync', () => {
  test('extracts specific keys from object', () => {
    const obj = { a: 1, b: 2, c: 3 };
    const result = objectExtractSync({ obj, extracted: ['a', 'c'] });
    expect(result).toEqual({ a: 1, c: 3 });
  });

  test('returns empty object when no keys match', () => {
    const obj = { a: 1, b: 2 };
    const result = objectExtractSync({ obj, extracted: ['c', 'd'] });
    expect(result).toEqual({});
  });

  test('returns empty object when object is empty', () => {
    const obj = {};
    const result = objectExtractSync({ obj, extracted: ['a'] });
    expect(result).toEqual({});
  });

  test('throws when extracted array is empty', () => {
    const obj = { a: 1 };
    expect(() => objectExtractSync({ obj, extracted: [] })).toThrow(TypeError);
  });

  test('extracts with schema that filters keys', () => {
    const obj = { a1: 1, a2: 2, b1: 3, b2: 4 };
    const startsWithA = {
      parse: (key: string): string => {
        if (key.startsWith('a')) return key;
        throw new Error('Not starting with a');
      },
    };
    const result = objectExtractSync({ obj, extracted: startsWithA });
    expect(result).toEqual({ a1: 1, a2: 2 });
  });

  test('transforms keys with schema', () => {
    const obj = { a1: 1, a2: 2, b1: 3 };
    const addSuffix = {
      parse: (key: string): string => {
        if (key.startsWith('a')) return `${key}_new`;
        throw new Error('Not starting with a');
      },
    };
    const result = objectExtractSync({ obj, extracted: addSuffix });
    expect(result).toEqual({ a1_new: 1, a2_new: 2 });
  });

  test('processes multiple extraction layers', () => {
    const obj = { a1: 1, a2: 2, b1: 3, b2: 4, c1: 5 };
    const startsWithA = {
      parse: (key: string): string => {
        if (key.startsWith('a')) return key;
        throw new Error('Not starting with a');
      },
    };
    const startsWithB = {
      parse: (key: string): string => {
        if (key.startsWith('b')) return key;
        throw new Error('Not starting with b');
      },
    };
    const result = objectExtractSync({ obj, extracted: [startsWithA, startsWithB] });
    expect(result).toEqual({ a1: 1, a2: 2, b1: 3, b2: 4 });
  });

  test('mixes direct keys and schemas', () => {
    const obj = { a1: 1, a2: 2, b1: 3, specific: 4 };
    const startsWithA = {
      parse: (key: string): string => {
        if (key.startsWith('a')) return key;
        throw new Error('Not starting with a');
      },
    };
    const result = objectExtractSync({ obj, extracted: ['specific', startsWithA] });
    expect(result).toEqual({ specific: 4, a1: 1, a2: 2 });
  });

  test('processes keys only once', () => {
    const obj = { a1: 1, a2: 2, a3: 3 };
    const firstSchema = {
      parse: (key: string): string => {
        if (key === 'a1' || key === 'a2') return `${key}_first`;
        throw new Error('Not a1 or a2');
      },
    };
    const secondSchema = {
      parse: (key: string): string => {
        if (key.startsWith('a')) return `${key}_second`;
        throw new Error('Not starting with a');
      },
    };
    const result = objectExtractSync({ obj, extracted: [firstSchema, secondSchema] });
    // a1 and a2 are processed by first schema, a3 by second
    expect(result).toEqual({ a1_first: 1, a2_first: 2, a3_second: 3 });
  });

  test('handles complex key transformations', () => {
    const obj = { firstName: 'John', lastName: 'Doe', age: 30 };
    const toSnakeCase = {
      parse: (key: string): string => {
        if (key.includes('Name')) {
          return key.replace(/([A-Z])/g, '_$1').toLowerCase().substring(1);
        }
        throw new Error('Not a name field');
      },
    };
    const result = objectExtractSync({ obj, extracted: [toSnakeCase, 'age'] });
    expect(result).toEqual({ first_name: 'John', last_name: 'Doe', age: 30 });
  });

  test('handles numeric keys', () => {
    const obj = { 1: 'one', 2: 'two', 3: 'three' };
    const result = objectExtractSync({ obj, extracted: [1, 3] });
    expect(result).toEqual({ '1': 'one', '3': 'three' });
  });

  test('preserves value types', () => {
    const obj = {
      str: 'string',
      num: 42,
      bool: true,
      arr: [1, 2, 3],
      obj: { nested: true },
      nil: null,
      undef: undefined,
    };
    const result = objectExtractSync({ obj, extracted: Object.keys(obj) });
    expect(result).toEqual(obj);
  });
});

describe('objectExtract (async)', () => {
  test('extracts specific keys from object', async () => {
    const obj = { a: 1, b: 2, c: 3 };
    const result = await objectExtract({ obj, extracted: ['a', 'c'] });
    expect(result).toEqual({ a: 1, c: 3 });
  });

  test('returns empty object when no keys match', async () => {
    const obj = { a: 1, b: 2 };
    const result = await objectExtract({ obj, extracted: ['c', 'd'] });
    expect(result).toEqual({});
  });

  test('throws when extracted array is empty', async () => {
    const obj = { a: 1 };
    await expect(objectExtract({ obj, extracted: [] })).rejects.toThrow(TypeError);
  });

  test('works with async schema', async () => {
    const obj = { a1: 1, a2: 2, b1: 3 };
    const asyncSchema = {
      parseAsync: async (key: string): Promise<string> => {
        // Simulate async operation
        await new Promise(resolve => setTimeout(resolve, 1));
        if (key.startsWith('a')) return `${key}_async`;
        throw new Error('Not starting with a');
      },
    };
    const result = await objectExtract({ obj, extracted: asyncSchema });
    expect(result).toEqual({ a1_async: 1, a2_async: 2 });
  });

  test('works with sync schema in async context', async () => {
    const obj = { a1: 1, a2: 2, b1: 3 };
    const syncSchema = {
      parse: (key: string): string => {
        if (key.startsWith('b')) return `${key}_sync`;
        throw new Error('Not starting with b');
      },
    };
    const result = await objectExtract({ obj, extracted: syncSchema });
    expect(result).toEqual({ b1_sync: 3 });
  });

  test('handles async iterable of extractors', async () => {
    const obj = { a: 1, b: 2, c: 3 };
    async function* asyncExtractors() {
      yield 'a';
      yield {
        parse: (key: string): string => {
          if (key === 'b') return 'b_transformed';
          throw new Error('Not b');
        },
      };
    }
    const result = await objectExtract({ obj, extracted: asyncExtractors() });
    expect(result).toEqual({ a: 1, b_transformed: 2 });
  });

  test('processes multiple async schemas', async () => {
    const obj = { user1: 'Alice', user2: 'Bob', admin1: 'Charlie' };
    const userSchema = {
      parseAsync: async (key: string): Promise<string> => {
        await new Promise(resolve => setTimeout(resolve, 1));
        if (key.startsWith('user')) return key.replace('user', 'member');
        throw new Error('Not a user');
      },
    };
    const adminSchema = {
      parseAsync: async (key: string): Promise<string> => {
        await new Promise(resolve => setTimeout(resolve, 1));
        if (key.startsWith('admin')) return key.replace('admin', 'superuser');
        throw new Error('Not an admin');
      },
    };
    const result = await objectExtract({ obj, extracted: [userSchema, adminSchema] });
    expect(result).toEqual({
      member1: 'Alice',
      member2: 'Bob',
      superuser1: 'Charlie',
    });
  });

  test('handles validation with async schemas', async () => {
    const obj = { email1: 'user@example.com', email2: 'invalid', phone: '123-456-7890' };
    const emailValidator = {
      parseAsync: async (key: string): Promise<string> => {
        if (key.startsWith('email')) {
          // In real scenario, might validate the value too
          return key;
        }
        throw new Error('Not an email field');
      },
    };
    const result = await objectExtract({ obj, extracted: emailValidator });
    expect(result).toEqual({ email1: 'user@example.com', email2: 'invalid' });
  });

  test('preserves execution order with mixed sync/async schemas', async () => {
    const obj = { a: 1, b: 2, c: 3, d: 4 };
    const processedKeys: string[] = [];
    
    const schema1 = {
      parse: (key: string): string => {
        processedKeys.push(`sync1:${key}`);
        if (key === 'a' || key === 'b') return key;
        throw new Error('Not a or b');
      },
    };
    
    const schema2 = {
      parseAsync: async (key: string): Promise<string> => {
        processedKeys.push(`async2:${key}`);
        if (key === 'c' || key === 'd') return key;
        throw new Error('Not c or d');
      },
    };
    
    const result = await objectExtract({ obj, extracted: [schema1, schema2] });
    expect(result).toEqual({ a: 1, b: 2, c: 3, d: 4 });
    
    // Check that schemas processed in order and each key only once
    const expectedSync1 = ['sync1:a', 'sync1:b', 'sync1:c', 'sync1:d'];
    const expectedAsync2 = ['async2:c', 'async2:d'];
    
    // First schema processes all keys
    expect(processedKeys.slice(0, 4).sort()).toEqual(expectedSync1.sort());
    // Second schema only processes unmatched keys
    expect(processedKeys.slice(4).sort()).toEqual(expectedAsync2.sort());
  });

  test('handles empty result gracefully', async () => {
    const obj = { a: 1, b: 2 };
    const neverMatches = {
      parseAsync: async (): Promise<string> => {
        throw new Error('Never matches');
      },
    };
    const result = await objectExtract({ obj, extracted: neverMatches });
    expect(result).toEqual({});
  });
});