import { parse } from 'smol-toml';
import { readFileSync as fsReadFileSync, writeFileSync as fsWriteFileSync } from 'node:fs';
import { join as pathJoin, resolve as pathResolve } from 'node:path';
import objectToExport from '@monochromatic.dev/module-object-to-export';
import themeConstsSchema, { typescriptType as themeConstsTypescriptType } from '@monochromatic.dev/schema-theme-consts';

import type { AstroIntegration } from 'astro';

const fs = { readFileSync: fsReadFileSync, writeFileSync: fsWriteFileSync };
const path = { join: pathJoin, resolve: pathResolve };

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
        // @ts-expect-error Type 'string' is not assignable to type 'DeepPartial<URL>'.ts(2322) schema.d.ts(399, 5): The expected type comes from property 'outDir' which is declared here on type 'DeepPartial<AstroConfig>'
        outDir: consts.base ? `./dist/temp/${consts.base}` : './dist/temp/',
        markdown: {
          shikiConfig: {
            themes: {
              light: consts.theming.shiki.light,
              dark: consts.theming.shiki.dark,
            },
          },
        },
        i18n: {
          defaultLocale: consts.langs.defaultLang,
          locales: [...consts.langs.langs],
        },
      });
    },
  },
});
