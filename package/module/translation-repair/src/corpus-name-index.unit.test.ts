/**
 Guards class seventy-eight (shi_Yumiaoya, 2026-09-22): a person the source
 names by a Han handle reached the page as a transliteration of nothing
 ("Xiaoguantang" for a handle whose pinyin it is not) while the corpus
 itself declares that person's English name in their own entry's front
 matter, because the sheets' declared names come only from the page's own
 archive. Every entry's front matter is readable at the pin, so the names
 the corpus declares for the people this entry mentions join the identity
 context beside the page's own renderings.
 Cat-themed invention throughout; no corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  CorpusReadError,
  corpusNameLines,
  corpusNamesOf,
  readCorpusNames,
} from '../dist/final/node/index.mjs';

/**
 Three invented entries: one declaring a Han name with an alias and an
 English rendering with two handles, one declaring a Han name whose English
 side carries only an alias, and one with no Han form to index.
 */
const ENTRIES = [
  {
    id: 'gum',
    sourceText: '---\nname: 奇妙的猫糖\ninfo:\n  alias: 猫糖\n---\n\n猫糖是一只热爱生活的猫。\n',
    targetText: '---\nname: Magic Cat Candy\ninfo:\n  alias: Cat Candy, meow1219\n---\n\nCat Candy was a cat who loved life.\n',
  },
  {
    id: 'slice',
    sourceText: '---\nname: 单鱼\ninfo:\n  alias: 单鱼\n---\n\n单鱼很温柔。\n',
    targetText: '---\ninfo:\n  alias: Danyu\n---\n\nDanyu was gentle.\n',
  },
  {
    id: 'latin',
    sourceText: '---\nname: Whiskers\n---\n\n它睡了。\n',
    targetText: '---\nname: Whiskers\n---\n\nIt slept.\n',
  },
  {
    id: 'kitty-one',
    sourceText: '---\nname: 猫猫\n---\n\n猫猫来了。\n',
    targetText: '---\nname: Kitty One\n---\n\nKitty One came.\n',
  },
  {
    id: 'kitty-two',
    sourceText: '---\ninfo:\n  alias: 猫猫\n---\n\n猫猫走了。\n',
    targetText: '---\nname: Kitty Two\n---\n\nKitty Two left.\n',
  },
] as const;

/**
 Heading the block carries.
 */
const HEADING = 'NAMES OF OTHER PEOPLE IN THIS ARCHIVE whose declared handle this text carries, as their own '
  + 'entries render them (where the text means the person, render them as their entry does, never a '
  + 'transliteration; where the handle is an ordinary word here, it is a word and stays translated):';

await describe({
  name: 'the corpus names the people an entry mentions as their own entries render them (class seventy-eight, shi_Yumiaoya)',
  children: [
    it({
      name: 'INDEXES every Han name or alias an entry declares against the English forms its own translation '
        + 'declares, and DROPS a form two entries declare, since the corpus then cannot say which person a page means',
      fn: async () => {
        const names = corpusNamesOf({ entries: ENTRIES, },);
        expect(names,).toEqual([
          {
            source: '奇妙的猫糖',
            renderings: ['Magic Cat Candy', 'Cat Candy', 'meow1219',],
            entryId: 'gum',
          },
          {
            source: '猫糖',
            renderings: ['Magic Cat Candy', 'Cat Candy', 'meow1219',],
            entryId: 'gum',
          },
          {
            source: '单鱼',
            renderings: ['Danyu',],
            entryId: 'slice',
          },
        ],);
      },
    },),
    it({
      name: 'LINES the names a text carries, the longest form of one entry once, never the entry\'s own',
      fn: async () => {
        const names = corpusNamesOf({ entries: ENTRIES, },);
        const lines = corpusNameLines({
          text: '醒来之后，她听到了奇妙的猫糖和单鱼相继离世的噩耗。\n',
          names,
          ownId: 'slice',
        },);
        expect(lines,).toEqual([
          HEADING,
          '- 奇妙的猫糖 (entry gum): "Magic Cat Candy", "Cat Candy", "meow1219"',
        ],);
      },
    },),
    it({
      name: 'LINES the short alias when the text carries only it',
      fn: async () => {
        const names = corpusNamesOf({ entries: ENTRIES, },);
        const lines = corpusNameLines({
          text: '猫糖和单鱼都走了。\n',
          names,
          ownId: 'own',
        },);
        expect(lines[1],).toBe('- 猫糖 (entry gum): "Magic Cat Candy", "Cat Candy", "meow1219"',);
        expect(lines[2],).toBe('- 单鱼 (entry slice): "Danyu"',);
        expect(lines.length,).toBe(3,);
      },
    },),
    it({
      name: 'STAYS SILENT when the text names nobody the corpus declares, a shared form included',
      fn: async () => {
        const lines = corpusNameLines({
          text: '猫猫在门口犹豫。\n',
          names: corpusNamesOf({ entries: ENTRIES, },),
          ownId: 'own',
        },);
        expect(lines,).toEqual([],);
      },
    },),
    it({
      name: 'READS every entry at the pin through injected readers, stepping over a pair whose English page is absent',
      fn: async () => {
        /**
         Paths asked for, to prove both sides of every listed entry were read.
         */
        const asked: string[] = [];
        const names = await readCorpusNames({
          pin: { cloneDir: '/nonexistent', commitSha: 'deadbeef', },
          listPeople: async () => ['gum', 'missing',],
          readFile: async ({ relPath, },) => {
            asked.push(relPath,);
            if (relPath === 'people/gum/page.md')
              return ENTRIES[0].sourceText;
            if (relPath === 'people/gum/page.en.md')
              return ENTRIES[0].targetText;
            if (relPath === 'people/missing/page.md')
              return '---\nname: 影猫\n---\n';
            throw new CorpusReadError({
              detail: relPath,
              cause: { stderr: `fatal: path '${relPath}' does not exist in 'deadbeef'`, },
            },);
          },
        },);
        expect(names.map(function sourceOf(name,) {
          return name.source;
        },),).toEqual(['奇妙的猫糖', '猫糖',],);
        expect(asked,).toContain('people/missing/page.en.md',);
      },
    },),
  ],
},);
