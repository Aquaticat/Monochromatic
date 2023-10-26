import fs from 'fs';

import path from 'path';

import shell from 'shelljs';

import closestPath from 'closest-path';

import render from './render/index.ts';

import layout from './layout/index.ts';

import jsBeautify from 'js-beautify';

const { html: beautifyHtml } = jsBeautify;

const ROOT_DIR = closestPath(path.resolve(), 'content');

const INTERMEDIATE_DIR = path.join(ROOT_DIR, 'dist', 'intermediate');

const CONTENT_FILE_NAMES_WITH_EXTENSIONS = fs.readdirSync(path.join(ROOT_DIR, 'content'))
  .filter((contentFileNameWithExtension) =>
    contentFileNameWithExtension.split('.')
        .at(-1)
      !== 'toml' && contentFileNameWithExtension.split('.').at(1)
  );

console.log(CONTENT_FILE_NAMES_WITH_EXTENSIONS);

// Except the first step render where content is first taken to INTERMEDIATE_DIR.
const transformStep = (
  inDirSegment: string,
  outDirSegment: string,
  transformFunction: (file: string, contentFileName: string) => string,
): void => {
  CONTENT_FILE_NAMES_WITH_EXTENSIONS.forEach((contentFileNameWithExtension): void => {
    const contentFileNamesWithExtensionSplits = contentFileNameWithExtension
      .split('.');

    const contentFileName = contentFileNamesWithExtensionSplits.slice(0, -1)
      .join('.');

    // const contentFileExtension = contentFileNamesWithExtensionSplits.at(-1)!;

    fs.writeFileSync(
      path.join(INTERMEDIATE_DIR, outDirSegment, `${contentFileName}.html`),
      transformFunction(
        fs.readFileSync(path.join(INTERMEDIATE_DIR, inDirSegment, `${contentFileName}.html`), { encoding: 'utf8' }),
        contentFileName,
      ),
    );
  });
};

const transformContent = (): void => {
  //region transformStep render
  CONTENT_FILE_NAMES_WITH_EXTENSIONS.forEach((contentFileNameWithExtension) => {
    const contentFileNamesWithExtensionSplits = contentFileNameWithExtension
      .split('.');

    const contentFileName = contentFileNamesWithExtensionSplits.slice(0, -1)
      .join('.');
    const contentFileExtension = contentFileNamesWithExtensionSplits.at(-1)!;

    fs.writeFileSync(
      path.join(INTERMEDIATE_DIR, 'render', `${contentFileName}.html`),
      render(
        fs.readFileSync(path.join(ROOT_DIR, 'content', contentFileNameWithExtension), { encoding: 'utf8' }),
        contentFileExtension,
      ),
    );
  });
  //endregion

  //region transformStep layout
  fs.readdirSync(path.join(INTERMEDIATE_DIR, 'layout')).filter((dir) => dir.match(/^\d+\. {2}.+$/)).forEach(
    (dirStartingWithI) => {
      fs.rmSync(path.join(INTERMEDIATE_DIR, 'layout', dirStartingWithI), { recursive: true, force: true });
    },
  );

  transformStep('render', 'layout', layout);
  //endregion

  // region transformStep beautify and minify
  CONTENT_FILE_NAMES_WITH_EXTENSIONS.forEach((contentFileNameWithExtension): void => {
    const contentFileNamesWithExtensionSplits = contentFileNameWithExtension
      .split('.');

    const contentFileName = contentFileNamesWithExtensionSplits.slice(0, -1)
      .join('.');

    // const contentFileExtension = contentFileNamesWithExtensionSplits.at(-1)!;

    fs.writeFileSync(
      path.join(INTERMEDIATE_DIR, 'beautifiedHtml', `${contentFileName}.html`),
      beautifyHtml(
        fs.readFileSync(path.join(INTERMEDIATE_DIR, 'layout', `${contentFileName}.html`), {
          encoding: 'utf8',
        }),
        {
          indent_size: 2,
          end_with_newline: true,
          preserve_newlines: false,
          wrap_attributes: 'force-expand-multiline',
          extra_liners: [
            'head',
            'body',
            '/html',
            'li',
            'p',
            'ol',
            'ul',
            'article',
            'section',
          ],
          templating: ['none'],
        },
      ),
    );

    shell.exec(
      `pnpm exec html-minifier-terser --case-sensitive --collapse-whitespace --conservative-collapse --decode-entities --keep-closing-slash --preserve-line-breaks -o ${
        path.join(INTERMEDIATE_DIR, 'minifiedHtml', `${contentFileName}.html`)
      } ${path.join(INTERMEDIATE_DIR, 'beautifiedHtml', `${contentFileName}.html`)}`,
    );
  });
  //endregion
};

export default transformContent;
