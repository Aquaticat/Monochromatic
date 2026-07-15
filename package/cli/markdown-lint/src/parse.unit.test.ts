import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';

import { fixSource, } from './fix.ts';
import { runRules, } from './lint.ts';
import { noPipeTables, } from './rule/no-pipe-tables.ts';
import type { Diagnostic, } from './types.ts';

/**
 * Run only `no-pipe-tables` over a source, the one fixable rule wired so far,
 * used here as a probe for parse-level behavior (frontmatter and MDX-skip).
 *
 * @param source - Markdown or MDX source
 *
 * @param mdx - whether to parse as MDX
 *
 * @returns diagnostics from the rule
 */
function lint(
  source: string,
  mdx: boolean,
): readonly Diagnostic[] {
  return runRules({
    rules: [noPipeTables,],
    source,
    mdx,
  },);
}

/**
 * Source whose leading YAML frontmatter must be skipped, with a pipe table
 * after it. Without frontmatter handling the `---` would parse as a thematic
 * break plus paragraph and shift every position.
 */
const FRONTMATTER_THEN_TABLE = [
  '---',
  'title: Example',
  'tags: [a, b]',
  '---',
  '',
  '# Heading',
  '',
  '| A | B |',
  '| - | - |',
  '| 1 | 2 |',
  '',
].join('\n',);

/**
 * MDX source with an ESM import, a JSX element, and a top-level pipe table.
 */
const MDX_WITH_TABLE = [
  "import X from './x';",
  '',
  '<X />',
  '',
  '| A | B |',
  '| - | - |',
  '| 1 | 2 |',
  '',
].join('\n',);

/**
 * MDX source whose only pipe table sits inside a JSX element subtree, which the
 * MVP skips wholesale.
 */
const TABLE_INSIDE_JSX = [
  '<Note>',
  '',
  '| A | B |',
  '| - | - |',
  '| 1 | 2 |',
  '',
  '</Note>',
  '',
].join('\n',);

await describe({
  name: 'parse (frontmatter and MDX)',
  children: [
    it({
      name: 'skips leading YAML frontmatter and flags the table after it',
      fn: async function frontmatterSkipped() {
        /**
         * Diagnostics for the frontmatter-then-table source.
         */
        const diagnostics = lint(FRONTMATTER_THEN_TABLE, false,);
        expect(diagnostics.length,).toBe(1,);
        // The table starts on source line 8, proving the frontmatter did not
        // shift positions (a misparse would report a different line).
        expect(nonNullishOrThrow(diagnostics[0],).line,).toBe(8,);
      },
    },),
    it({
      name: 'lints a top-level table in MDX without misparsing import or JSX',
      fn: async function mdxTopLevelTable() {
        expect(lint(MDX_WITH_TABLE, true,).length,).toBe(1,);
        /**
         * Fixed MDX source.
         */
        const fixed = fixSource({
          rules: [noPipeTables,],
          source: MDX_WITH_TABLE,
          mdx: true,
        },);
        expect(fixed.diagnostics.length,).toBe(0,);
        expect(fixed.source.includes("import X from './x';",),).toBe(true,);
        expect(fixed.source.includes('<X />',),).toBe(true,);
        expect(fixed.source.includes('<table>',),).toBe(true,);
      },
    },),
    it({
      name: 'skips a table nested inside a JSX element subtree',
      fn: async function tableInsideJsxSkipped() {
        expect(lint(TABLE_INSIDE_JSX, true,).length,).toBe(0,);
      },
    },),
    it({
      name: 'does not treat MDX expressions or imports as lintable prose',
      fn: async function mdxConstructsClean() {
        expect(lint("import { a } from 'b';\n\nexport const c = 1;\n\n<Foo bar={1 + 2} />\n\n{x}\n", true,).length,)
          .toBe(0,);
      },
    },),
  ],
},);
