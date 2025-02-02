import { configure } from '@logtape/logtape';
import {
  arrayOf,
  type Assert,
  assert,
  type AssertEmptyArray,
  assertEmptyArray,
  logtapeConfiguration,
  suite,
  test,
} from '@monochromatic-dev/module-es/ts';

await configure(logtapeConfiguration());

suite('of', [
  test('empty', () => {
    const arrayOfEmpty = arrayOf();
    type _ = AssertEmptyArray<typeof arrayOfEmpty>;
    assertEmptyArray(arrayOf());
  }),

  test('1', () => {
    const arrayOf1 = arrayOf(1);
    type _ = Assert<[1], typeof arrayOf1>;
    assert([1], arrayOf(1));
  }),

  test('number, string', () => {
    const arrayOf1AndEmptyString = arrayOf(1, '');
    type _ = Assert<[1, ''], typeof arrayOf1AndEmptyString>;
    assert([1, ''], arrayOf(1, ''));
  }),
]);
