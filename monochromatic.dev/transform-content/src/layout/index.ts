import fs from 'fs';

import {
  parseHTML,
} from 'linkedom';

import path from 'path';

import closestPath from 'closest-path';

import documentString from '../helpers/document-string/index';

import potentialId from '../helpers/potential-id/index.ts';

import sanitize from '../helpers/sanitize/index';

import uniqueId from '../helpers/unique-id/index.ts';

import removeXVariables from './clean/removeXVariables';

import getVariables from './html/getVariables';

import setVariables from './html/setVariables.ts';

import wrapWith from './helpers/wrapWith.ts';

import insertHeaderStructureOnly from './header/insertHeaderStructureOnly.ts';

import insertFooter from './footer/insertFooter.ts';

import insertNavArticlesOrH2s from './nav/insertNavArticlesOrH2s';

import insertNavFooter from './nav/insertNavFooter';

import insertNavPages from './nav/insertNavPages';

import insertNavStructureOnly from './nav/insertNavStructureOnly.ts';

const ROOT_DIR = closestPath(path.resolve(), 'content');

const PATH_PREFIX = path.join(ROOT_DIR, 'dist', 'intermediate', 'layout');

const MAX_PATH = 250;

/*
writeDocumentFile

folder f: string
contentFileName c: string
writeWhichDocument d: Document
 */

// folderIndex i
let i = 1;

const wDF = (f: string, c: string, d: Document) => {
  if (!fs.existsSync(path.join(PATH_PREFIX, `${i}.  ${sanitize(f, MAX_PATH)}`))) {
    fs.mkdirSync(path.join(PATH_PREFIX, `${i}.  ${sanitize(f, MAX_PATH)}`));
    fs.writeFileSync(path.join(PATH_PREFIX, `${i}.  ${sanitize(f, MAX_PATH)}`, '.gitkeep'), '');
  }

  fs.writeFileSync(path.join(PATH_PREFIX, `${i}.  ${sanitize(f, MAX_PATH)}`, `${c}.html`), documentString(d));

  i++;
};

const layout = (file: string, contentFileName: string): string => {
  i = 1;
  const c = contentFileName;
  const { document } = parseHTML(file);

  const d = document;

  //region Side Effects

  wrapWith(d, 'wrapper-block', 'h1');
  wDF('wrapWith(d, \'wrapper-block\', \'h1\');', c, d);

  //region Wrap Headings

  /* FIXME: This is bad.
            This does not take into account of the situation in which the h2 is already wrapped into section.
            Consider using a more advanced wrapWith function to automatically insert id to section,
            instead of doing it in another step.
            Also, doing it in another step would cause user-added section to be incorrectly handled.
            Update: It's not working as well.
            It somehow always wraps it twice each time.
             */
  wrapWith(d, 'section', 'h2', '> wrapper-block:has(> h2)');
  wDF('wrapWith(d, \'section\', \'h2\', \'> wrapper-block:has(> h2)\');', c, d);

  // TODO: Try to make this block reusable instead of specifying it 4 more times for h3, h4, h5, and h6.
  [...d.body.querySelectorAll(':scope > wrapper-block > section:has(> h2)')].forEach((h2Section) => {
    const h2SectionH2 = h2Section.querySelector(':scope > h2')! as HTMLHeadingElement;

    h2Section.id = uniqueId(d, potentialId(h2SectionH2));
  });
  wDF(
    '[...d.body.querySelectorAll(\':scope > wrapper-block > section:has(> h2)\')].forEach((h2Section) => {\n'
      + '    const h2SectionH2 = h2Section.querySelector(\':scope > h2\')! as HTMLHeadingElement;\n'
      + '\n'
      + '    h2Section.id = uniqueId(d, potentialId(h2SectionH2));\n'
      + '  });',
    c,
    d,
  );

  wrapWith(d, 'section', 'h3', '> wrapper-block > section:has(> h2):has(> h3)');
  wDF('wrapWith(d, \'section\', \'h3\', \'> wrapper-block > section:has(> h2):has(> h3)\')', c, d);

  [...d.body.querySelectorAll(':scope > wrapper-block > section:has(> h2) > section:has(h3)')].forEach(
    (h3Section) => {
      const h3SectionH3 = h3Section.querySelector(':scope > h3')! as HTMLHeadingElement;

      h3Section.id = uniqueId(d, potentialId(h3SectionH3));
    },
  );
  wDF(
    '[...d.body.querySelectorAll(\':scope > wrapper-block > section:has(> h2) > section:has(h3)\')].forEach(\n'
      + '    (h3Section) => {\n'
      + '      const h3SectionH3 = h3Section.querySelector(\':scope > h3\')! as HTMLHeadingElement;\n'
      + '\n'
      + '      h3Section.id = uniqueId(d, potentialId(h3SectionH3));\n'
      + '    },\n'
      + '  );',
    c,
    d,
  );

  wrapWith(d, 'section', 'h4', '> wrapper-block > section:has(>h2) > section:has(> h3):has(> h4)');
  wDF('wrapWith(d, \'section\', \'h4\', \'> wrapper-block > section:has(>h2) > section:has(> h3):has(> h4)\')', c, d);

  [
    ...d.body.querySelectorAll(
      ':scope > wrapper-block > section:has(> h2) > section:has(h3) > section:has(> h4)',
    ),
  ].forEach((h4Section) => {
    const h4SectionH4 = h4Section.querySelector(':scope > h4')! as HTMLHeadingElement;

    h4Section.id = uniqueId(d, potentialId(h4SectionH4));
  });
  wDF(
    '[\n'
      + '    ...d.body.querySelectorAll(\n'
      + '      \':scope > wrapper-block > section:has(> h2) > section:has(h3) > section:has(> h4)\',\n'
      + '    ),\n'
      + '  ].forEach((h4Section) => {\n'
      + '    const h4SectionH4 = h4Section.querySelector(\':scope > h4\')! as HTMLHeadingElement;\n'
      + '\n'
      + '    h4Section.id = uniqueId(d, potentialId(h4SectionH4));\n'
      + '  });',
    c,
    d,
  );

  wrapWith(d, 'section', 'h4', '> wrapper-block > section:has(>h2) > section:has(> h3):has(> h4)');
  wDF('wrapWith(d, \'section\', \'h4\', \'> wrapper-block > section:has(>h2) > section:has(> h3):has(> h4)\');', c, d);

  wrapWith(
    d,
    'section',
    'h5',
    '> wrapper-block > section:has(>h2) > section:has(> h3) > section:has(> h4):has(> h5)',
  );
  wDF(
    'wrapWith(\n'
      + '    d,\n'
      + '    \'section\',\n'
      + '    \'h5\',\n'
      + '    \'> wrapper-block > section:has(>h2) > section:has(> h3) > section:has(> h4):has(> h5)\',\n'
      + '  );',
    c,
    d,
  );

  [
    ...d.body.querySelectorAll(
      ':scope > wrapper-block > section:has(> h2) > section:has(h3) > section:has(> h4) > section:has(> h5)',
    ),
  ].forEach((h5Section) => {
    const h5SectionH5 = h5Section.querySelector(':scope > h5')! as HTMLHeadingElement;

    h5Section.id = uniqueId(d, potentialId(h5SectionH5));
  });
  wDF(
    '[\n'
      + '    ...d.body.querySelectorAll(\n'
      + '      \':scope > wrapper-block > section:has(> h2) > section:has(h3) > section:has(> h4) > section:has(> h5)\',\n'
      + '    ),\n'
      + '  ].forEach((h5Section) => {\n'
      + '    const h5SectionH5 = h5Section.querySelector(\':scope > h5\')! as HTMLHeadingElement;\n'
      + '\n'
      + '    h5Section.id = uniqueId(d, potentialId(h5SectionH5));\n'
      + '  });',
    c,
    d,
  );

  wrapWith(
    d,
    'section',
    'h6',
    '> wrapper-block > section:has(>h2) > section:has(> h3) > section:has(> h4) > section:has(> h5):has(> h6)',
  );
  wDF(
    'wrapWith(\n'
      + '    d,\n'
      + '    \'section\',\n'
      + '    \'h6\',\n'
      + '    \'> wrapper-block > section:has(>h2) > section:has(> h3) > section:has(> h4) > section:has(> h5):has(> h6)\',\n'
      + '  );',
    c,
    d,
  );

  [
    ...d.body.querySelectorAll(
      ':scope > wrapper-block > section:has(> h2) > section:has(h3) > section:has(> h4) > section:has(> h5) > section:has(> h6)',
    ),
  ].forEach((h6Section) => {
    const h6SectionH6 = h6Section.querySelector(':scope > h6')! as HTMLHeadingElement;

    h6Section.id = uniqueId(d, potentialId(h6SectionH6));
  });
  wDF(
    '[\n'
      + '    ...d.body.querySelectorAll(\n'
      + '      \':scope > wrapper-block > section:has(> h2) > section:has(h3) > section:has(> h4) > section:has(> h5) > section:has(> h6)\',\n'
      + '    ),\n'
      + '  ].forEach((h6Section) => {\n'
      + '    const h6SectionH6 = h6Section.querySelector(\':scope > h6\')! as HTMLHeadingElement;\n'
      + '\n'
      + '    h6Section.id = uniqueId(d, potentialId(h6SectionH6));\n'
      + '  });',
    c,
    d,
  );

  //endregion

  wrapWith(d, 'article', 'wrapper-block');
  wDF('wrapWith(d, \'article\', \'wrapper-block\')', c, d);

  d.body.querySelectorAll(':scope > article').forEach((article) => {
    article.id = uniqueId(d, potentialId(article.querySelector(':scope > wrapper-block > h1')!));
  });
  wDF(
    'd.body.querySelectorAll(\':scope > article\').forEach((article) => {\n'
      + '    article.id = uniqueId(d, potentialId(article.querySelector(\':scope > wrapper-block > h1\')!));\n'
      + '  })',
    c,
    d,
  );

  d.body.querySelectorAll(':scope > article:has(> wrapper-block > section > h2)')
    .forEach((article) => {
      article.innerHTML = `
${article.innerHTML}

<aside>
<h1>
In this article:
</h1>

<ol>
<!-- TODO: Add section wrappers first! Because we are only selecting child elements in queryselector.
           Done adding section wrapper. Now working on this. -->
${
        [...article.querySelectorAll(':scope > wrapper-block > section:has(h2)')]
          .reduce((html2, h2Section) => `
${html2}
<li>
<a href="#${h2Section.id}">${h2Section.querySelector(':scope > h2')!.textContent}</a>

${
            h2Section.querySelector(':scope > section:has(h3)')
              ? `
<ol>
${
                [...h2Section.querySelectorAll(':scope > section:has(h3)')]
                  .reduce((html3, h3Section) => `
${html3}
<li>
<a href="#${h3Section.id}">${h3Section.querySelector(':scope > h3')!.textContent}</a>
</li>
`, '')
              }
</ol>
`
              : ''
          }
</li>
`, '')
      }
</ol>
</aside>
`;
    });
  wDF(
    'd.body.querySelectorAll(\':scope > article:has(> wrapper-block > section > h2)\')\n'
      + '    .forEach((article) => {\n'
      + '      article.innerHTML = `\n'
      + '${article.innerHTML}\n'
      + '\n'
      + '<aside>\n'
      + '<h1>\n'
      + 'In this article:\n'
      + '</h1>\n'
      + '\n'
      + '<ol>\n'
      + '<!-- TODO: Add section wrappers first! Because we are only selecting child elements in queryselector.\n'
      + '           Done adding section wrapper. Now working on this. -->\n'
      + '${\n'
      + '        [...article.querySelectorAll(\':scope > wrapper-block > section:has(h2)\')]\n'
      + '          .reduce((html2, h2Section) => `\n'
      + '${html2}\n'
      + '<li>\n'
      + '<a href="#${h2Section.id}">${h2Section.querySelector(\':scope > h2\')!.textContent}</a>\n'
      + '\n'
      + '${\n'
      + '            h2Section.querySelector(\':scope > section:has(h3)\')\n'
      + '              ? `\n'
      + '<ol>\n'
      + '${\n'
      + '                [...h2Section.querySelectorAll(\':scope > section:has(h3)\')]\n'
      + '                  .reduce((html3, h3Section) => `\n'
      + '${html3}\n'
      + '<li>\n'
      + '<a href="#${h3Section.id}">${h3Section.querySelector(\':scope > h3\')!.textContent}</a>\n'
      + '</li>\n'
      + '`, \'\')\n'
      + '              }\n'
      + '</ol>\n'
      + '`\n'
      + '              : \'\'\n'
      + '          }\n'
      + '</li>\n'
      + '`, \'\')\n'
      + '      }\n'
      + '</ol>\n'
      + '</aside>\n'
      + '`;\n'
      + '    });',
    c,
    d,
  );

  wrapWith(d, 'main');
  wDF('wrapWith(d, \'main\');', c, d);

  insertHeaderStructureOnly(d);
  wDF('insertHeaderStructureOnly(d);', c, d);

  insertFooter(d);
  wDF('insertFooter(d);', c, d);

  wrapWith(d, 'wrapper-block');
  wDF('wrapWith(d, \'wrapper-block\');', c, d);

  insertNavStructureOnly(d);
  wDF('insertNavStructureOnly(d);', c, d);

  insertNavPages(d);
  wDF('insertNavPages(d);', c, d);

  insertNavArticlesOrH2s(d);
  wDF('insertNavArticlesOrH2s(d);', c, d);

  insertNavFooter(d);
  wDF('insertNavFooter(d);', c, d);

  setVariables(getVariables(c), d);
  wDF('setVariables(getVariables(c), d);', c, d);

  removeXVariables(d);
  wDF('removeXVariables(d);', c, d);

  //endregion

  return documentString(d);
};

export default layout;
