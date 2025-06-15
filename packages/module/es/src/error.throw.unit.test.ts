import {
  logtapeConfiguration,
  logtapeConfigure,
  notArrayOrThrow,
  notEmptyOrThrow,
  notFalseOrThrow,
  notFalsyOrThrow,
  notNullishOrThrow,
  notNullOrThrow,
  notObjOrThrow,
  notStringOrThrow,
  notTrueOrThrow,
  notTruthyOrThrow,
  notUndefinedOrThrow,
} from '@monochromatic-dev/module-es/.js';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration());

describe('notNullishOrThrow', () => {
  test('throws for null', () => {
    expect(() => notNullishOrThrow(null)).toThrow(TypeError);
  });

  test('throws for undefined', () => {
    expect(() => notNullishOrThrow(undefined)).toThrow(TypeError);
  });

  test('returns non-nullish values unchanged', () => {
    expect(notNullishOrThrow(0)).toBe(0);
    expect(notNullishOrThrow('')).toBe('');
    expect(notNullishOrThrow(false)).toBe(false);
    const obj = { a: 1 };
    expect(notNullishOrThrow(obj)).toBe(obj);
  });
});

describe('notUndefinedOrThrow', () => {
  test('throws for undefined', () => {
    expect(() => notUndefinedOrThrow(undefined)).toThrow(TypeError);
  });

  test('returns non-undefined values unchanged', () => {
    expect(notUndefinedOrThrow(null)).toBe(null);
    expect(notUndefinedOrThrow(0)).toBe(0);
    expect(notUndefinedOrThrow('')).toBe('');
    expect(notUndefinedOrThrow(false)).toBe(false);
  });
});

describe('notNullOrThrow', () => {
  test('throws for null', () => {
    expect(() => notNullOrThrow(null)).toThrow(TypeError);
  });

  test('returns non-null values unchanged', () => {
    expect(notNullOrThrow(undefined)).toBe(undefined);
    expect(notNullOrThrow(0)).toBe(0);
    expect(notNullOrThrow('')).toBe('');
    expect(notNullOrThrow(false)).toBe(false);
  });
});

describe('notFalsyOrThrow', () => {
  test('throws for falsy values', () => {
    expect(() => notFalsyOrThrow(false)).toThrow(TypeError);
    expect(() => notFalsyOrThrow(null)).toThrow(TypeError);
    expect(() => notFalsyOrThrow(0)).toThrow(TypeError);
    expect(() => notFalsyOrThrow(0n)).toThrow(TypeError);
    expect(() => notFalsyOrThrow('')).toThrow(TypeError);
  });

  test('returns truthy values unchanged', () => {
    expect(notFalsyOrThrow('hello')).toBe('hello');
    expect(notFalsyOrThrow(42)).toBe(42);
    expect(notFalsyOrThrow(true)).toBe(true);
    expect(notFalsyOrThrow([])).toEqual([]);
    expect(notFalsyOrThrow({})).toEqual({});
  });
});

describe('notFalseOrThrow', () => {
  test('throws for false', () => {
    expect(() => notFalseOrThrow(false)).toThrow(TypeError);
  });

  test('returns non-false values unchanged', () => {
    expect(notFalseOrThrow(null)).toBe(null);
    expect(notFalseOrThrow(undefined)).toBe(undefined);
    expect(notFalseOrThrow(0)).toBe(0);
    expect(notFalseOrThrow('')).toBe('');
    expect(notFalseOrThrow(true)).toBe(true);
  });
});

describe('notObjOrThrow', () => {
  test('throws for objects', () => {
    expect(() => notObjOrThrow({})).toThrow(TypeError);
    expect(() => notObjOrThrow([])).toThrow(TypeError);
    expect(() => notObjOrThrow(new Date())).toThrow(TypeError);
    expect(() => notObjOrThrow(new Map())).toThrow(TypeError);
    expect(() => notObjOrThrow(new Set())).toThrow(TypeError);
  });

  test('returns non-object values unchanged', () => {
    expect(notObjOrThrow(null)).toBe(null); // null isn't considered an object here
    expect(notObjOrThrow(undefined)).toBe(undefined);
    expect(notObjOrThrow(0)).toBe(0);
    expect(notObjOrThrow('')).toBe('');
    expect(notObjOrThrow(false)).toBe(false);
    expect(notObjOrThrow(true)).toBe(true);
    expect(notObjOrThrow(42)).toBe(42);
    expect(notObjOrThrow('hello')).toBe('hello');
  });
});

describe('notTrueOrThrow', () => {
  test('throws for true', () => {
    expect(() => notTrueOrThrow(true)).toThrow(TypeError);
  });

  test('returns non-true values unchanged', () => {
    expect(notTrueOrThrow(false)).toBe(false);
    expect(notTrueOrThrow(null)).toBe(null);
    expect(notTrueOrThrow(undefined)).toBe(undefined);
    expect(notTrueOrThrow(0)).toBe(0);
    expect(notTrueOrThrow('')).toBe('');
    expect(notTrueOrThrow(42)).toBe(42);
    expect(notTrueOrThrow('hello')).toBe('hello');
    expect(notTrueOrThrow({})).toEqual({});
  });
});

describe('notTruthyOrThrow', () => {
  test('throws for truthy values', () => {
    expect(() => notTruthyOrThrow(true)).toThrow(TypeError);
    expect(() => notTruthyOrThrow(1)).toThrow(TypeError);
    expect(() => notTruthyOrThrow(-1)).toThrow(TypeError);
    expect(() => notTruthyOrThrow('0')).toThrow(TypeError);
    expect(() => notTruthyOrThrow([])).toThrow(TypeError);
    expect(() => notTruthyOrThrow({})).toThrow(TypeError);
    expect(() =>
      notTruthyOrThrow(() => {
        // noop
      })
    )
      .toThrow(TypeError);
  });

  test('returns falsy values unchanged', () => {
    expect(notTruthyOrThrow(false)).toBe(false);
    expect(notTruthyOrThrow(null)).toBe(null);
    expect(notTruthyOrThrow(undefined)).toBe(undefined);
    expect(notTruthyOrThrow(0)).toBe(0);
    expect(notTruthyOrThrow(0n)).toBe(0n);
    expect(notTruthyOrThrow('')).toBe('');
  });
});

describe('notEmptyOrThrow', () => {
  test('throws for empty string', () => {
    expect(() => notEmptyOrThrow('')).toThrow(TypeError);
  });

  test('throws for empty array', () => {
    expect(() => notEmptyOrThrow([])).toThrow(TypeError);
  });

  test('throws for empty object', () => {
    expect(() => notEmptyOrThrow({})).toThrow(TypeError);
  });

  test('returns non-empty values unchanged', () => {
    expect(notEmptyOrThrow('hello')).toBe('hello');
    expect(notEmptyOrThrow([1, 2, 3])).toEqual([1, 2, 3]);
    expect(notEmptyOrThrow({ a: 1 })).toEqual({ a: 1 });
  });
});

describe('notArrayOrThrow', () => {
  test('throws for arrays', () => {
    expect(() => notArrayOrThrow([])).toThrow(TypeError);
    expect(() => notArrayOrThrow([1, 2, 3])).toThrow(TypeError);
  });

  test('returns non-array values unchanged', () => {
    expect(notArrayOrThrow(null)).toBe(null);
    expect(notArrayOrThrow(undefined)).toBe(undefined);
    expect(notArrayOrThrow(0)).toBe(0);
    expect(notArrayOrThrow('')).toBe('');
    expect(notArrayOrThrow(false)).toBe(false);
    expect(notArrayOrThrow(true)).toBe(true);
    expect(notArrayOrThrow({})).toEqual({});
  });
});

describe('notStringOrThrow', () => {
  test('throws for strings', () => {
    expect(() => notStringOrThrow('')).toThrow(TypeError);
    expect(() => notStringOrThrow('hello')).toThrow(TypeError);
  });

  test('returns non-string values unchanged', () => {
    expect(notStringOrThrow(null)).toBe(null);
    expect(notStringOrThrow(undefined)).toBe(undefined);
    expect(notStringOrThrow(0)).toBe(0);
    expect(notStringOrThrow(false)).toBe(false);
    expect(notStringOrThrow(true)).toBe(true);
    expect(notStringOrThrow({})).toEqual({});
    expect(notStringOrThrow([])).toEqual([]);
  });
});
