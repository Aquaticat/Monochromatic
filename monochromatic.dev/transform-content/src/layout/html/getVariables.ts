import fs from 'fs';

import {
  parseHTML,
} from 'linkedom';

import path from 'path';

import closestPath from 'closest-path';

import * as TOML from '@ltd/j-toml';

import type Variables from './Variables';

const ROOT_DIR = closestPath(path.resolve(), 'content');

const PACKAGE_ROOT_DIR = closestPath();

const getVariables = (contentFileName: string): Variables => {
  const { document } = parseHTML(fs.readFileSync(
    path.join(ROOT_DIR, 'dist', 'intermediate', 'render', `${contentFileName}.html`),
    { encoding: 'utf8' },
  ));

  return {
    ...TOML.parse(
      fs.readFileSync(path.join(PACKAGE_ROOT_DIR, 'variables.toml'), { encoding: 'utf8' }),
    ) as unknown as Variables,

    ...fs.existsSync(path.join(ROOT_DIR, 'content', '.toml'))
      ? TOML.parse(fs.readFileSync(path.join(ROOT_DIR, 'content', '.toml'), { encoding: 'utf8' }))
      : {},

    ...[...document.body.querySelectorAll(':scope h1')].length === 1
      ? {
        title: document.body.querySelector(':scope h1')!
          .textContent!,
      }
      : {},

    ...fs.existsSync(path.join(ROOT_DIR, 'content', `${contentFileName}.toml`))
      ? TOML.parse(fs.readFileSync(path.join(ROOT_DIR, 'content', `${contentFileName}.toml`)))
      : {},

    ...parseHTML(
        fs.readFileSync(
          path.join(ROOT_DIR, 'dist', 'intermediate', 'render', `${contentFileName}.html`),
          { encoding: 'utf8' },
        ),
      ).document.body.querySelector(':scope x-variables')
      ? TOML.parse(
        parseHTML(
          fs.readFileSync(
            path.join(ROOT_DIR, 'dist', 'intermediate', 'render', `${contentFileName}.html`),
            { encoding: 'utf8' },
          ),
        ).document.body.querySelector(':scope x-variables')!.innerHTML,
      )
      : {},
  };
};

export default getVariables;
