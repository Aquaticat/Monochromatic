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
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration(),);

const todoRecord: Record<string, unknown> = {
  title: 'Clean room',
  description: 'Clean the room thoroughly',
  completed: false,
};

describe(objectPickSync, () => {
  test('picks specific properties from object', () => {
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
},);

describe(objectPick, () => {
  test('async picks specific properties from object', async () => {
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
},);
