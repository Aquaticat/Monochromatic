/**
 * Tests for the pure path-manipulation helpers.
 *
 * These exercise both the Node-delegating and pure-JS fallback paths.
 * On Node and Bun, the exported functions delegate to `node:path/posix`;
 * the fallbacks are tested directly to keep the browser path honest.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  dirname,
  dirnameFallback,
  isAbsolute,
  join,
  joinFallback,
  normalize,
  resolve,
  resolveFallback,
  sep,
  trimLeadingSlash,
  trimTrailingSlash,
} from '@monochromatic-dev/module-fs-path';

await describe({
  name: 'path-ops',
  children: [
    it({
      name: 'sep is POSIX `/`',
      fn: async () => {
        expect(sep,).toBe('/',);
      },
    },),
    it({
      name: 'dirname returns the parent directory',
      fn: async () => {
        expect(dirname('/foo/bar/baz.css',),).toBe('/foo/bar',);
        expect(dirname('/foo',),).toBe('/',);
        expect(dirname('foo',),).toBe('.',);
      },
    },),
    it({
      name: 'isAbsolute reflects leading slash',
      fn: async () => {
        expect(isAbsolute('/foo/bar',),).toBe(true,);
        expect(isAbsolute('foo/bar',),).toBe(false,);
        expect(isAbsolute('',),).toBe(false,);
      },
    },),
    it({
      name: 'join concatenates and normalizes segments',
      fn: async () => {
        expect(join(['/foo', 'bar', 'baz',],),).toBe('/foo/bar/baz',);
        expect(join(['foo', '../bar',],),).toBe('bar',);
      },
    },),
    it({
      name: 'resolve produces an absolute path',
      fn: async () => {
        expect(resolve(['/foo', 'bar', 'baz',],),).toBe('/foo/bar/baz',);
        expect(resolve(['foo', '/bar', 'baz',],),).toBe('/bar/baz',);
      },
    },),
    it({
      name: 'dirnameFallback matches dirname for common cases',
      fn: async () => {
        expect(dirnameFallback('/foo/bar/baz.ts',),).toBe('/foo/bar',);
        expect(dirnameFallback('/foo/bar/',),).toBe('/foo',);
        expect(dirnameFallback('',),).toBe('.',);
        expect(dirnameFallback('/',),).toBe('/',);
      },
    },),
    it({
      name: 'joinFallback handles empty and relative segments',
      fn: async () => {
        expect(joinFallback(['foo', 'bar', 'baz',],),).toBe('foo/bar/baz',);
        expect(joinFallback(['/root', '../sibling',],),).toBe('/sibling',);
        expect(joinFallback([],),).toBe('.',);
      },
    },),
    it({
      name: 'resolveFallback yields an absolute path',
      fn: async () => {
        expect(resolveFallback(['/foo', 'bar', './baz',],),).toBe('/foo/bar/baz',);
        expect(resolveFallback(['/foo', '/bar',],),).toBe('/bar',);
      },
    },),
    it({
      name: 'normalize collapses redundant segments',
      fn: async () => {
        expect(normalize('/foo/bar//baz/./qux/../quux',),).toBe('/foo/bar/baz/quux',);
        expect(normalize('',),).toBe('.',);
      },
    },),
    it({
      name: 'trimTrailingSlash strips trailing `/` except on root',
      fn: async () => {
        expect(trimTrailingSlash('/foo/bar/',),).toBe('/foo/bar',);
        expect(trimTrailingSlash('/',),).toBe('/',);
        expect(trimTrailingSlash('foo',),).toBe('foo',);
      },
    },),
    it({
      name: 'trimLeadingSlash strips leading `/` except on root',
      fn: async () => {
        expect(trimLeadingSlash('/foo/bar',),).toBe('foo/bar',);
        expect(trimLeadingSlash('/',),).toBe('/',);
        expect(trimLeadingSlash('foo',),).toBe('foo',);
      },
    },),
  ],
},);
