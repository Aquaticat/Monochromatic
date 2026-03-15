import {
  describe,
  expect,
  test,
} from 'bun:test';

import {
  cosineSimilarity,
  dotProduct,
} from './similarity.ts';

describe('dotProduct', function dotProductSuite() {
  test('identical unit vectors yield 1', function identicalVectors() {
    const v = [1, 0, 0,];
    expect(dotProduct(v, v,),).toBe(1,);
  });

  test('orthogonal vectors yield 0', function orthogonalVectors() {
    expect(dotProduct([1, 0,], [0, 1,],),).toBe(0,);
  });

  test('opposite vectors yield -1', function oppositeVectors() {
    expect(dotProduct([1, 0,], [-1, 0,],),).toBe(-1,);
  });

  test('throws on length mismatch', function lengthMismatch() {
    expect(function callWithMismatch() {
      dotProduct([1, 2,], [1, 2, 3,],);
    },)
      .toThrow('Vector length mismatch',);
  });
});

describe('cosineSimilarity', function cosineSimilaritySuite() {
  test('parallel vectors yield 1 regardless of magnitude', function parallelVectors() {
    expect(cosineSimilarity([3, 0,], [7, 0,],),).toBeCloseTo(1, 10,);
  });

  test('orthogonal vectors yield 0', function orthogonalVectors() {
    expect(cosineSimilarity([1, 0,], [0, 1,],),).toBeCloseTo(0, 10,);
  });

  test('anti-parallel vectors yield -1', function antiParallelVectors() {
    expect(cosineSimilarity([2, 0,], [-5, 0,],),).toBeCloseTo(-1, 10,);
  });

  test('throws on zero vector', function zeroVector() {
    expect(function callWithZero() {
      cosineSimilarity([0, 0,], [1, 1,],);
    },)
      .toThrow('zero magnitude',);
  });

  test('throws on length mismatch', function lengthMismatch() {
    expect(function callWithMismatch() {
      cosineSimilarity([1,], [1, 2,],);
    },)
      .toThrow('Vector length mismatch',);
  });
});
