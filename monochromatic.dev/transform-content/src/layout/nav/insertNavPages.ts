import fs from 'fs';

import {
  parseHTML,
} from 'linkedom';

import path from 'path';

import closestPath from 'closest-path';

const ROOT_DIR = closestPath(path.resolve(), 'content');

const insertNavPages = (document: Document): void => {
  const navDetailsWrapperBlock = document.body.querySelector(':scope > nav > details > wrapper-block')!;

  navDetailsWrapperBlock.innerHTML = `
${navDetailsWrapperBlock.innerHTML}

<section id="nav__pages">
  <ul>
    ${
    (fs.readdirSync(path.join(ROOT_DIR, 'dist', 'intermediate', 'render'))
      .filter((renderedFileNameWithExtension) =>
        renderedFileNameWithExtension.split('.')
          .at(-1)
          === 'html'
      )
      .map((renderedFileNameWithExtension) =>
        renderedFileNameWithExtension
          .slice(0, -'.html'.length)
      )
      .map((renderedFileName) => `
  <li>
  <a href="/${renderedFileName}">${
        parseHTML(
          fs.readFileSync(path.join(ROOT_DIR, 'dist', 'intermediate', 'render', `${renderedFileName}.html`), {
            encoding: 'utf8',
          }),
        ).document.body.querySelector(':scope h1')?.textContent ?? renderedFileName.replaceAll('_', ' ')
      }</a>
  </li>
`))
      .join('')
  }
  </ul>
  </section>
  `;
};

export default insertNavPages;
