/**
 Tests for the screenshot helpers: size parsing, the pixel difference, and loading a real PNG through ImageMagick.
 
 @module
 */

import {
  mkdtemp,
  rm,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import {
  describe,
  it,
} from '@monochromatic-dev/module-test/ts';

import { runCommand, } from './command.ts';
import {
  diffBox,
  type Image,
  loadImage,
  parseSize,
} from './image.ts';

/**
 Builds a solid image.
 
 @param width - width in pixels
 
 @param height - height in pixels
 
 @param fill - byte value of every channel
 
 @returns the image
 */
function solid(width: number, height: number, fill: number,): Image {
  return { width, height, data: new Uint8Array(width * height * 3,).fill(fill,), };
}

/**
 Copies an image with one pixel changed.
 
 @param image - source
 
 @param x - column
 
 @param y - row
 
 @returns the changed copy
 */
function withPixel(image: Image, x: number, y: number,): Image {
  const data = new Uint8Array(image.data,);
  data[(((y * image.width) + x) * 3) + 1] = 200;
  return { ...image, data, };
}

await describe({
  name: parseSize.name,
  children: [
    it({
      name: 'reads WIDTHxHEIGHT with surrounding white space',
      fn: async ({ expect, }) => {
        expect(parseSize('1000x800',),).toEqual({ width: 1_000, height: 800, },);
        expect(parseSize(' 3x4\n',),).toEqual({ width: 3, height: 4, },);
      },
    },),
    it({
      name: 'rejects text that is not two integers joined by x',
      fn: async ({ expect, }) => {
        for (const text of ['', '10', 'x5', '5x', 'axb', '1.5x2',])
          expect(() => parseSize(text,),).toThrow('is not WIDTHxHEIGHT',);
      },
    },),
  ],
},);

await describe({
  name: diffBox.name,
  children: [
    it({
      name: 'counts no difference between equal images and gives no box',
      fn: async ({ expect, }) => {
        expect(diffBox({ a: solid(4, 3, 9,), b: solid(4, 3, 9,), },),).toEqual({ count: 0, },);
      },
    },),
    it({
      name: 'counts one changed pixel with a one-pixel box',
      fn: async ({ expect, }) => {
        const a = solid(4, 3, 9,);
        expect(diffBox({ a, b: withPixel(a, 2, 1,), },),).toEqual({ count: 1, box: { x: 2, y: 1, width: 1, height: 1, }, },);
      },
    },),
    it({
      name: 'bounds several changed pixels',
      fn: async ({ expect, }) => {
        const a = solid(6, 5, 0,);
        const b = withPixel(withPixel(a, 1, 1,), 4, 3,);
        expect(diffBox({ a, b, },),).toEqual({ count: 2, box: { x: 1, y: 1, width: 4, height: 3, }, },);
      },
    },),
    it({
      name: 'compares only the area both images share',
      fn: async ({ expect, }) => {
        const result = diffBox({ a: solid(4, 4, 1,), b: solid(2, 2, 2,), },);
        expect(result.count,).toBe(4,);
        expect(result.box,).toEqual({ x: 0, y: 0, width: 2, height: 2, },);
      },
    },),
    it({
      name: 'sees a change in each of the three channels',
      fn: async ({ expect, }) => {
        const a = solid(2, 1, 0,);
        for (const channel of [0, 1, 2,]) {
          const data = new Uint8Array(a.data,);
          data[channel] = 1;
          expect(diffBox({ a, b: { ...a, data, }, },).count,).toBe(1,);
        }
      },
    },),
  ],
},);

await describe({
  name: loadImage.name,
  children: [
    it({
      name: 'decodes a PNG made by ImageMagick into its size and RGB bytes, and removes its scratch file',
      fn: async ({ expect, }) => {
        const dir = await mkdtemp(join(tmpdir(), 'e2e-image-',),);
        const png = join(dir, 'red.png',);
        const made = await runCommand({ command: 'magick', args: ['-size', '4x3', 'xc:#FF0000', png,], },);
        expect(made.status,).toBe(0,);
        const image = await loadImage(png,);
        expect(image.width,).toBe(4,);
        expect(image.height,).toBe(3,);
        expect(image.data.length,).toBe(4 * 3 * 3,);
        expect([...image.data.subarray(0, 3,),],).toEqual([255, 0, 0,],);
        const listing = await runCommand({ command: 'ls', args: [dir,], },);
        expect(listing.stdout,).toBe('red.png',);
        await rm(dir, { recursive: true, force: true, },);
      },
      timeout: 30_000,
    },),
    it({
      name: 'rejects a file that is not an image',
      fn: async ({ expect, }) => {
        let caught: unknown;
        try {
          await loadImage(join(tmpdir(), 'e2e-no-such-image.png',),);
        }
        catch (error: unknown) {
          caught = error;
        }
        expect((caught as Error).message,).toContain('magick identify failed',);
      },
      timeout: 30_000,
    },),
  ],
},);
