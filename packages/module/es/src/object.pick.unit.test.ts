import {
  // Logging library used
  logtapeConfiguration,
  logtapeConfigure,
  objectPick,
  // Import functions to test
  objectPickSync,
} from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  expectTypeOf,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration(),);

const todoRecord: Record<string, unknown> = {
  title: 'Clean room',
  description: 'Clean the room thoroughly',
  completed: false,
};

describe(objectPickSync, () => {
  test('picks specific properties from object with array of keys', () => {
    const result = objectPickSync({
      object: todoRecord,
      keys: ['title', 'completed',],
    },);

    expect(result,).toEqual({
      title: 'Clean room',
      completed: false,
    },);
  });

  test('picks single property from object', () => {
    const result = objectPickSync({
      object: todoRecord,
      keys: ['title',],
    },);

    expect(result,).toEqual({
      title: 'Clean room',
    },);
  });

  test('throws error when key does not exist', () => {
    expect(() => {
      objectPickSync({
        object: todoRecord,
        keys: ['nonexistent',],
      },);
    },)
      .toThrow('Key "nonexistent" does not exist in object',);
  });

  test('works with Set of keys', () => {
    const result = objectPickSync({
      object: todoRecord,
      keys: new Set(['title', 'description',],),
    },);

    expect(result,).toEqual({
      title: 'Clean room',
      description: 'Clean the room thoroughly',
    },);
  });

  test('throws error for non-iterable, non-schema keys', () => {
    expect(() => {
      objectPickSync({
        object: todoRecord,
        keys: 'title' as any,
      },);
    },)
      .toThrow('keys must be a schema, iterable of keys, or a single key',);
  });
},);

describe(objectPick, () => {
  test('async picks specific properties from object with array of keys', async () => {
    const result = await objectPick({
      object: todoRecord,
      keys: ['title', 'completed',],
    },);

    expect(result,).toEqual({
      title: 'Clean room',
      completed: false,
    },);
  });

  test('async picks single property from object', async () => {
    const result = await objectPick({
      object: todoRecord,
      keys: ['description',],
    },);

    expect(result,).toEqual({
      description: 'Clean the room thoroughly',
    },);
  });

  test('async throws error for unpickable keys', async () => {
    await expect(objectPick({
      object: todoRecord,
      keys: ['nonexistent',] as any,
    },),)
      .rejects
      .toThrow('unpickable',);
  });
},);

describe('objectPick types', () => {
  test('objectPickSync return types', () => {
    type Todo = {
      title: string;
      description: string;
      completed: boolean;
    };

    const todo: Todo = {
      title: 'Clean room',
      description: 'Clean the room thoroughly',
      completed: false,
    };

    // Test picking multiple properties
    const result1 = objectPickSync({
      object: todo,
      keys: ['title', 'completed',],
    },);
    expectTypeOf(result1,).toEqualTypeOf<Pick<Todo, 'title' | 'completed'>>(
      result1,
    );

    // Test picking single property
    const result2 = objectPickSync({
      object: todo,
      keys: ['title'],
    },);
    expectTypeOf(result2,).toEqualTypeOf<Pick<Todo, 'title'>>();

    // Test picking with array
    const result3 = objectPickSync({
      object: todo,
      keys: ['title', 'description',],
    },);
    expectTypeOf(result3,).toEqualTypeOf<Pick<Todo, 'title' | 'description'>>();
  });

  test('objectPick return types', async () => {
    type Todo = {
      title: string;
      description: string;
      completed: boolean;
    };

    const todo: Todo = {
      title: 'Clean room',
      description: 'Clean the room thoroughly',
      completed: false,
    };

    // Test picking multiple properties
    const result1 = await objectPick({
      object: todo,
      keys: ['title', 'completed',],
    },);
    expectTypeOf(result1,).toEqualTypeOf<Pick<Todo, 'title' | 'completed'>>();

    // Test picking single property
    const result2 = await objectPick({
      object: todo,
      keys: ['description',],
    },);
    expectTypeOf(result2,).toEqualTypeOf<Pick<Todo, 'description'>>();
  });
});
