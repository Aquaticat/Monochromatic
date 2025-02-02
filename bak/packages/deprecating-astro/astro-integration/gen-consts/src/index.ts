import { parse } from 'smol-toml';
import {
  readFileSync as fsReadFileSync,
  writeFileSync as fsWriteFileSync,
  readdirSync as fsReaddirSync,
} from 'node:fs';
import { join as pathJoin, resolve as pathResolve } from 'node:path';
import { pathToFileURL as urlPathToFileURL } from 'node:url';
import objectToExport from '@monochromatic-dev/module-object-to-export';
import themeConstsSchema, { typescriptType as themeConstsTypescriptType } from '@monochromatic-dev/schema-theme-consts';

import type { AstroIntegration } from 'astro';

const fs = { readFileSync: fsReadFileSync, writeFileSync: fsWriteFileSync, readdirSync: fsReaddirSync };
const path = { join: pathJoin, resolve: pathResolve };
const url = { pathToFileURL: urlPathToFileURL };

export default (file = 'consts.toml'): AstroIntegration => ({
  name: 'gen-consts',
  hooks: {
    'astro:config:setup': ({ updateConfig }) => {
      const consts = themeConstsSchema.parse(
        parse(fs.readFileSync(path.join(path.resolve(), file), { encoding: 'utf8' })),
      );
      const exportedObj = objectToExport(consts);
      fs.writeFileSync(
        path.join(path.resolve(), 'src', 'temp', file.split('.').toSpliced(-1, 1, 'ts').join('.')),
        `type constsType = ${themeConstsTypescriptType};

const consts: constsType = ${exportedObj} as constsType;

export default consts;`,
      );

      updateConfig({
        site: consts.site,
        base: `/${consts.base}`,
        outDir: consts.base
          ? url.pathToFileURL(path.join(path.resolve(), `dist/temp/${consts.base}`))
          : url.pathToFileURL(path.join(path.resolve(), 'dist/temp')),
        markdown: {
          shikiConfig: {
            themes: {
              light: consts.theming.shiki.light,
              dark: consts.theming.shiki.dark,
            },
          },
        },
        i18n: {
          locales: fs.readdirSync(path.join(path.resolve(), 'src', 'content', 'post')),
        },
      });
    },
  },
});
