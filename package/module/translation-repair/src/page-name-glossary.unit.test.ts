/**
 Guards class seventy-one (mikaela_khara, 2026-09-19): the author's handle
 铨铨 reached the page as "Quan" in one line of dialogue while the archive
 renders the same handle as a stylised form in its link text and in every
 other line, because no sheet told the bench how this page renders that name.
 The source's `[铨](url)` and the archive's `[Rendered](url)` share an href,
 and the source's signature lines pair with the archive's, so the page's own
 renderings are readable at preparation and every sheet carries them.
 Cat-themed invention throughout; no corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { pageNameLines, } from '../dist/final/node/index.mjs';

await describe({
  name: 'a page names its people and linked titles as the archive renders them (class seventy-one, mikaela_khara)',
  children: [
    it({
      name: 'READS a same-href link whose Han text the archive renders, and a signature pair, into sheet lines',
      fn: async () => {
        const lines = pageNameLines({
          sourceText: '节选自[猫猫](https://example.invalid/maomao)猫日记\n\n——猫猫, 2024 年 12 月 17 日\n',
          targetText: 'Excerpt from [Maomao](https://example.invalid/maomao)’s cat diary\n\n——Maomao, December 17, 2024\n',
        },);
        expect(lines[0],).toContain('NAMES AND LINKED TEXT',);
        expect(lines,).toContain('- 猫猫 (link text, https://example.invalid/maomao): "Maomao"',);
        expect(lines.length,).toBe(2,);
      },
    },),
    it({
      name: 'READS a signature the archive renders under another spelling, once per distinct name',
      fn: async () => {
        const lines = pageNameLines({
          sourceText: '它睡了。\n\n——锦猫, 2025 年 2 月 10 日\n\n它醒了。\n\n——锦猫, 2025 年 3 月 1 日\n',
          targetText: 'It sleeps.\n\n——Jinmao, February 10, 2025\n\nIt wakes.\n\n——Jinmao, March 1, 2025\n',
        },);
        expect(lines,).toEqual([
          'NAMES AND LINKED TEXT THE ARCHIVE RENDERS ON THIS PAGE (render the same person or title the same way everywhere; a declared name inside a title takes its declared form):',
          '- 锦猫 (signature): "Jinmao"',
        ],);
      },
    },),
    it({
      name: 'READS a heading the archive renders otherwise, aligned by order when both documents carry the same '
        + 'count, as evidence the judges weigh (owner, 2026-09-21: the judges keep deciding headings; the literal '
        + 'reading winning is a world-knowledge gap to close another way)',
      fn: async () => {
        const lines = pageNameLines({
          sourceText: '## 左右\n\n猫在门口犹豫。\n\n## 回见\n\n猫走了。\n',
          targetText: '## Conflict\n\nThe cat hesitates at the door.\n\n## Farewell\n\nThe cat leaves.\n',
        },);
        expect(lines,).toContain('- 左右 (heading): "Conflict"',);
        expect(lines,).toContain('- 回见 (heading): "Farewell"',);
        expect(lines.length,).toBe(3,);
        expect(pageNameLines({
          sourceText: '## 左右\n\n猫在门口犹豫。\n\n## 回见\n\n猫走了。\n',
          targetText: '## Conflict\n\nThe cat hesitates at the door.\n',
        },),).toEqual([],);
      },
    },),
    it({
      name: 'SAYS a linked title that names the person takes the declared form inside it (class eighty-six, yingying3 2026-09-22: the archive\'s "Sakura" inside a blog title carried as the title\'s authority against the declared "Yingying")',
      fn: async () => {
        const lines = pageNameLines({
          sourceText: '[永别了，猫猫。](https://example.invalid/farewell)\n',
          targetText: '[Farewell, Kitty.](https://example.invalid/farewell)\n',
          declared: [{ source: '猫猫', rendering: 'Maomao', },],
        },);
        // The title line still carries the archive's rendering, and now says
        // which name inside it the declared form settles.
        expect(lines,).toContain(
          '- 永别了，猫猫。 (link text, https://example.invalid/farewell): "Farewell, Kitty."; names 猫猫, declared "Maomao": the declared form inside the title, the archive\'s words for the rest',
        );
        expect(lines[0],).toContain('a declared name inside a title takes its declared form',);
      },
    },),
    it({
      name: 'KEEPS a linked title\'s line bare where the archive already renders the declared name inside it, or the title names nobody declared',
      fn: async () => {
        const rendered = pageNameLines({
          sourceText: '[永别了，猫猫。](https://example.invalid/farewell)\n',
          targetText: '[Farewell, Maomao.](https://example.invalid/farewell)\n',
          declared: [{ source: '猫猫', rendering: 'Maomao', },],
        },);
        expect(rendered,).toContain('- 永别了，猫猫。 (link text, https://example.invalid/farewell): "Farewell, Maomao."',);
        const nobody = pageNameLines({
          sourceText: '[永别了，猫猫。](https://example.invalid/farewell)\n',
          targetText: '[Farewell, Kitty.](https://example.invalid/farewell)\n',
          declared: [{ source: '橘猫', rendering: 'Ginger', },],
        },);
        expect(nobody,).toContain('- 永别了，猫猫。 (link text, https://example.invalid/farewell): "Farewell, Kitty."',);
      },
    },),
    it({
      name: 'LEAVES OUT a link the archive keeps in the same words, a sentence-long link text, an href only one side '
        + 'carries, and signatures whose counts differ between the documents',
      fn: async () => {
        const lines = pageNameLines({
          sourceText: '[Maomao](https://example.invalid/same) and '
            + '[猫猫说：河水很冰，很冷吧，这世上若有来生，一定要守护你，直到梦醒](https://example.invalid/long) and '
            + '[白猫](https://example.invalid/source-only)\n\n——橘猫, 2024 年 1 月 1 日\n\n——黑猫, 2024 年 1 月 2 日\n',
          targetText: '[Maomao](https://example.invalid/same) and '
            + '[Maomao said the river was cold](https://example.invalid/long)\n\n——Ginger, January 1, 2024\n',
        },);
        expect(lines,).toEqual([],);
      },
    },),
  ],
},);
