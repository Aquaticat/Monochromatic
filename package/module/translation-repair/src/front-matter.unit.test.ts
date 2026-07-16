/**
 * Tests for front matter splitting.
 * Fixtures mirror corpus structure only; every value is cat-themed invention.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  FrontMatterParseError,
  splitFrontMatter,
} from './front-matter.ts';

/**
 * Well-formed corpus-shaped source with invented metadata and body.
 */
const CORPUS_SHAPED = '---\nname: 小猫-whiskers\ninfo:\n    alias: Whiskers, Mittens\n---\n\n## 简介\n\n猫猫晒太阳。\n';

await describe({
  name: splitFrontMatter.name,
  children: [
    it({
      name: 'returns whole input as body when no fence opens the document',
      fn: async () => {
        /** Split of source without front matter. */
        const split = splitFrontMatter({ text: '## 简介\n\n猫猫晒太阳。\n', },);
        expect(split.frontMatter,).toBe(undefined,);
        expect(split.body,).toBe('## 简介\n\n猫猫晒太阳。\n',);
        expect(split.bodyOffset,).toBe(0,);
      },
    },),

    it({
      name: 'splits well-formed front matter with exact raw slice and parsed data',
      fn: async () => {
        /** Split of corpus-shaped source. */
        const split = splitFrontMatter({ text: CORPUS_SHAPED, },);
        expect(split.frontMatter?.raw,).toBe(
          '---\nname: 小猫-whiskers\ninfo:\n    alias: Whiskers, Mittens\n---\n',
        );
        expect(split.frontMatter?.data,).toEqual({
          name: '小猫-whiskers',
          info: { alias: 'Whiskers, Mittens', },
        },);
        expect(split.bodyOffset,).toBe(split.frontMatter?.raw.length,);
        expect(split.body,).toBe('\n## 简介\n\n猫猫晒太阳。\n',);
        // Reassembly invariant: raw plus body reproduces source byte-for-byte.
        expect(`${split.frontMatter?.raw ?? ''}${split.body}`,).toBe(CORPUS_SHAPED,);
      },
    },),

    it({
      name: 'parses empty front matter as null data',
      fn: async () => {
        /** Split of source with empty fence pair. */
        const split = splitFrontMatter({ text: '---\n---\n喵。\n', },);
        expect(split.frontMatter?.data,).toBe(null,);
        expect(split.body,).toBe('喵。\n',);
      },
    },),

    it({
      name: 'treats unterminated fence as body text',
      fn: async () => {
        /** Split of source whose fence never closes. */
        const split = splitFrontMatter({ text: '---\nname: mittens\n\n没有关闭的栅栏\n', },);
        expect(split.frontMatter,).toBe(undefined,);
        expect(split.bodyOffset,).toBe(0,);
      },
    },),

    it({
      name: 'accepts fence closing at end of input',
      fn: async () => {
        /** Split of source that is front matter only. */
        const split = splitFrontMatter({ text: '---\nname: mittens\n---', },);
        expect(split.frontMatter?.data,).toEqual({ name: 'mittens', },);
        expect(split.body,).toBe('',);
      },
    },),

    it({
      name: 'throws FrontMatterParseError on invalid YAML between fences',
      fn: async () => {
        /** Value caught from split of source with malformed YAML. */
        let caught: unknown;
        try {
          splitFrontMatter({ text: '---\nname: [unclosed\n---\n喵。\n', },);
        }
        catch (error) {
          caught = error;
        }
        expect(caught instanceof FrontMatterParseError,).toBe(true,);
      },
    },),
  ],
},);
