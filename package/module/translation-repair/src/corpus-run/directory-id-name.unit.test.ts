/**
 * Tests for the three ways a directory id may stand as a page's visible name
 * although the source names the person otherwise.
 *
 * WHY. On 2026-09-07 the Huasheng page was refused for naming 椛笙 by its
 * pinyin, which is the directory id. The owner's answer was the pinyin check
 * and the alias exemption, read on both front matters, since there has to be
 * an English rendering of the name in the front matter. Each clause has a case
 * that passes and the refusal has a case that stays.
 *
 * Fixtures are cat-themed invention where the rule allows; the pinyin cases
 * need real characters, and use common ones.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  directoryIdNameStands,
  splitFrontMatter,
} from '../../dist/final/node/index.mjs';

/**
 * Parses a front matter fixture, throwing where it does not parse so a broken
 * fixture fails its case rather than passing an undefined through.
 *
 * @param text - page text starting with front matter
 *
 * @returns Parsed block
 *
 * @example
 * ```ts
 * const block = blockOf({ text: '---\nname: 林童\n---\n', },);
 * ```
 */
function blockOf({ text, }: { readonly text: string; },) {
  /**
   * Parsed front matter, if the fixture carries one.
   */
  const block = splitFrontMatter({ text, },).frontMatter;
  if (block === undefined)
    throw new Error('fixture did not parse',);
  return block;
}

/**
 * Page whose visible name is the id and whose alias is in the source script
 * only, so nothing but the id itself can let it stand.
 */
const ID_ONLY_PAGE = '---\nname: lintong\ninfo:\n  alias: 林童\n---\n\nBody.\n';

await describe({
  name: directoryIdNameStands.name,
  children: [
    it({
      name: 'STANDS where the id is the pinyin of the source name, letters compared without case or '
        + 'tone (Huasheng, 2026-09-07)',
      fn: async () => {
        expect(directoryIdNameStands({
          entryId: 'lintong',
          source: blockOf({ text: '---\nname: 林童\ninfo:\n  alias: 林童\n---\n', },),
          page: blockOf({ text: ID_ONLY_PAGE, },),
          archives: [],
        },),).toBe(true,);
        expect(directoryIdNameStands({
          entryId: 'LinTong',
          source: blockOf({ text: '---\nname: 林童\ninfo:\n  alias: 林童\n---\n', },),
          page: blockOf({ text: ID_ONLY_PAGE, },),
          archives: [],
        },),).toBe(true,);
      },
    },),

    it({
      name: 'STANDS on a heteronym the common reading would miss, since every reading of every '
        + 'character is allowed',
      fn: async () => {
        // 单 reads dan, shan and chan; the common reading is dan.
        expect(directoryIdNameStands({
          entryId: 'shanpian',
          source: blockOf({ text: '---\nname: 单片\ninfo:\n  alias: 单片\n---\n', },),
          page: blockOf({ text: '---\nname: shanpian\ninfo:\n  alias: 单片\n---\n', },),
          archives: [],
        },),).toBe(true,);
      },
    },),

    it({
      name: 'STANDS where the source itself carries the id among its aliases, so the handle is the '
        + 'person\'s own',
      fn: async () => {
        expect(directoryIdNameStands({
          entryId: 'MioCat',
          source: blockOf({ text: '---\nname: 澪猫\ninfo:\n  alias: 澪猫, MioCat\n---\n', },),
          page: blockOf({ text: '---\nname: MioCat\ninfo:\n  alias: 澪猫\n---\n', },),
          archives: [],
        },),).toBe(true,);
      },
    },),

    it({
      name: 'STANDS where the page or the archive carries a Latin-script alias other than the id, '
        + 'the English rendering the front matter has to have',
      fn: async () => {
        expect(directoryIdNameStands({
          entryId: 'Whiskers',
          source: blockOf({ text: '---\nname: 猫猫\ninfo:\n  alias: 猫咪\n---\n', },),
          page: blockOf({ text: '---\nname: Whiskers\ninfo:\n  alias: 猫咪, Maomao\n---\n', },),
          archives: [],
        },),).toBe(true,);
        expect(directoryIdNameStands({
          entryId: 'Whiskers',
          source: blockOf({ text: '---\nname: 猫猫\ninfo:\n  alias: 猫咪\n---\n', },),
          page: blockOf({ text: '---\nname: Whiskers\ninfo:\n  alias: 猫咪\n---\n', },),
          archives: [blockOf({ text: '---\nname: Whiskers\ninfo:\n  alias: Little Whiskers (cat)\n---\n', },),],
        },),).toBe(true,);
      },
    },),

    it({
      name: 'FALLS where the id spells nothing of the name, the source does not own it, and no '
        + 'alias on either side is a Latin rendering other than the id itself',
      fn: async () => {
        expect(directoryIdNameStands({
          entryId: 'Whiskers',
          source: blockOf({ text: '---\nname: 猫猫\ninfo:\n  alias: 猫咪\n---\n', },),
          page: blockOf({ text: '---\nname: Whiskers\ninfo:\n  alias: 猫咪, whiskers\n---\n', },),
          archives: [blockOf({ text: '---\nname: Whiskers\ninfo:\n  alias: WHISKERS\n---\n', },),],
        },),).toBe(false,);
      },
    },),

    it({
      name: 'FALLS on a partial reading, since the letters must spell the whole name and nothing '
        + 'more',
      fn: async () => {
        expect(directoryIdNameStands({
          entryId: 'lin',
          source: blockOf({ text: '---\nname: 林童\ninfo:\n  alias: 林童\n---\n', },),
          page: blockOf({ text: '---\nname: lin\ninfo:\n  alias: 林童\n---\n', },),
          archives: [],
        },),).toBe(false,);
        expect(directoryIdNameStands({
          entryId: 'lintongcat',
          source: blockOf({ text: '---\nname: 林童\ninfo:\n  alias: 林童\n---\n', },),
          page: blockOf({ text: '---\nname: lintongcat\ninfo:\n  alias: 林童\n---\n', },),
          archives: [],
        },),).toBe(false,);
      },
    },),
  ],
},);
