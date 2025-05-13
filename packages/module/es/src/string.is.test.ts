import {
  isNegativeFloatString,
  isNegativeIntString,
  isPositiveFloatString,
  isPositiveIntString,
  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es/ts';

import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration());

describe('isPositiveIntString', () => {
  describe('digits', () => {
    test('empty', () => {
      expect(
        isPositiveIntString(''),
      )
        .toBe(false);
    });
    test('0', () => {
      expect(
        isPositiveIntString('0'),
      )
        .toBe(true);
    });
    test('1', () => {
      expect(
        isPositiveIntString('1'),
      )
        .toBe(true);
    });
    test('-0', () => {
      expect(
        isPositiveIntString('-0'),
      )
        .toBe(false);
    });
    test('-1', () => {
      expect(
        isPositiveIntString('-1'),
      )
        .toBe(false);
    });
  });
  describe('two digits', () => {
    test('01', () => {
      expect(
        isPositiveIntString('01'),
      )
        .toBe(false);
    });
    test('10', () => {
      expect(
        isPositiveIntString('10'),
      )
        .toBe(true);
    });
    test('11', () => {
      expect(
        isPositiveIntString('11'),
      )
        .toBe(true);
    });
    test('-01', () => {
      expect(
        isPositiveIntString('-01'),
      )
        .toBe(false);
    });
    test('-10', () => {
      expect(
        isPositiveIntString('-10'),
      )
        .toBe(false);
    });
    test('-11', () => {
      expect(
        isPositiveIntString('-11'),
      )
        .toBe(false);
    });
  });
});

describe('isNegativeIntString', () => {
  describe('digits', () => {
    test('empty', () => {
      expect(
        isNegativeIntString(''),
      )
        .toBe(false);
    });
    test('0', () => {
      expect(
        isNegativeIntString('0'),
      )
        .toBe(false);
    });
    test('1', () => {
      expect(
        isNegativeIntString('1'),
      )
        .toBe(false);
    });
    test('-0', () => {
      expect(
        isNegativeIntString('-0'),
      )
        .toBe(true);
    });
    test('-1', () => {
      expect(
        isNegativeIntString('-1'),
      )
        .toBe(true);
    });
  });
  describe('two digits', () => {
    test('01', () => {
      expect(
        isNegativeIntString('01'),
      )
        .toBe(false);
    });
    test('10', () => {
      expect(
        isNegativeIntString('10'),
      )
        .toBe(false);
    });
    test('11', () => {
      expect(
        isNegativeIntString('11'),
      )
        .toBe(false);
    });
    test('-01', () => {
      expect(
        isNegativeIntString('-01'),
      )
        .toBe(false);
    });
    test('-10', () => {
      expect(
        isNegativeIntString('-10'),
      )
        .toBe(true);
    });
    test('-11', () => {
      expect(
        isNegativeIntString('-11'),
      )
        .toBe(true);
    });
  });
});

describe('isPositiveFloatString', () => {
  describe('digits', () => {
    test('empty', () => {
      expect(
        isPositiveFloatString(''),
      )
        .toBe(false);
    });
    test('0', () => {
      expect(
        isPositiveFloatString('0'),
      )
        .toBe(false);
    });
    test('1', () => {
      expect(
        isPositiveFloatString('1'),
      )
        .toBe(false);
    });
    test('-0', () => {
      expect(
        isPositiveFloatString('-0'),
      )
        .toBe(false);
    });
    test('-1', () => {
      expect(
        isPositiveFloatString('-1'),
      )
        .toBe(false);
    });
  });
  describe('with dot', () => {
    test('0.', () => {
      expect(
        isPositiveFloatString('0.'),
      )
        .toBe(false);
    });
    test('0.0', () => {
      expect(
        isPositiveFloatString('0.0'),
      )
        .toBe(false);
    });
    test('1.1.1', () => {
      expect(
        isPositiveFloatString('1.1.1'),
      )
        .toBe(false);
    });
    test('0.1', () => {
      expect(
        isPositiveFloatString('0.1'),
      )
        .toBe(true);
    });
    test('0.00', () => {
      expect(
        isPositiveFloatString('0.00'),
      )
        .toBe(false);
    });
    test('00.0', () => {
      expect(
        isPositiveFloatString('00.0'),
      )
        .toBe(false);
    });
    test('0.10', () => {
      expect(
        isPositiveFloatString('0.10'),
      )
        .toBe(true);
    });
    test('01.10', () => {
      expect(
        isPositiveFloatString('01.10'),
      )
        .toBe(false);
    });
    test('10.10', () => {
      expect(
        isPositiveFloatString('10.10'),
      )
        .toBe(true);
    });
  });
  describe('two digits', () => {
    test('01', () => {
      expect(
        isPositiveFloatString('01'),
      )
        .toBe(false);
    });
    test('10', () => {
      expect(
        isPositiveFloatString('10'),
      )
        .toBe(false);
    });
    test('11', () => {
      expect(
        isPositiveFloatString('11'),
      )
        .toBe(false);
    });
    test('-01', () => {
      expect(
        isPositiveFloatString('-01'),
      )
        .toBe(false);
    });
    test('-10', () => {
      expect(
        isPositiveFloatString('-10'),
      )
        .toBe(false);
    });
    test('-11', () => {
      expect(
        isPositiveFloatString('-11'),
      )
        .toBe(false);
    });
  });
});
