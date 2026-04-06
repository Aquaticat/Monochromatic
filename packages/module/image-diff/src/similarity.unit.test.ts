import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';

import {
  cosineSimilarity,
  dotProduct,
} from './similarity.ts';

await describe({
  name: '',
  children: [
    describe({
      name: dotProduct.name,
      children: [
        it({
          name: 'identical unit vectors yield 1',
          fn: async () => {
            const v = [1, 0, 0,];
            expect(dotProduct(v, v,),).toBe(1,);
          },
        },),
        it({
          name: 'orthogonal vectors yield 0',
          fn: async () => {
            expect(dotProduct([1, 0,], [0, 1,],),).toBe(0,);
          },
        },),
        it({
          name: 'opposite vectors yield -1',
          fn: async () => {
            expect(dotProduct([1, 0,], [-1, 0,],),).toBe(-1,);
          },
        },),
        it({
          name: 'throws on length mismatch',
          fn: async () => {
            expect(function callWithMismatch() {
              dotProduct([1, 2,], [1, 2, 3,],);
            },)
              .toThrow('Vector length mismatch',);
          },
        },),
      ],
    },),
    describe({
      name: cosineSimilarity.name,
      children: [
        it({
          name: 'parallel vectors yield 1 regardless of magnitude',
          fn: async () => {
            expect(cosineSimilarity([3, 0,], [7, 0,],),).toBeCloseTo(1, 10,);
          },
        },),
        it({
          name: 'orthogonal vectors yield 0',
          fn: async () => {
            expect(cosineSimilarity([1, 0,], [0, 1,],),).toBeCloseTo(0, 10,);
          },
        },),
        it({
          name: 'anti-parallel vectors yield -1',
          fn: async () => {
            expect(cosineSimilarity([2, 0,], [-5, 0,],),).toBeCloseTo(-1, 10,);
          },
        },),
        it({
          name: 'throws on zero vector',
          fn: async () => {
            expect(function callWithZero() {
              cosineSimilarity([0, 0,], [1, 1,],);
            },)
              .toThrow('zero magnitude',);
          },
        },),
        it({
          name: 'throws on length mismatch',
          fn: async () => {
            expect(function callWithMismatch() {
              cosineSimilarity([1,], [1, 2,],);
            },)
              .toThrow('Vector length mismatch',);
          },
        },),
      ],
    },),
  ],
},);
