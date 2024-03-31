import { parse } from 'smol-toml';
import * as fs from 'node:fs';
import * as path from 'node:path';
import themeConstsSchema from '../../../schemas/theme-consts/src';
import objectToExport from '@monochromatic.dev/module-object-to-export';

export default (file = 'consts.toml') => ({
  name: 'gen-consts',
  hooks: {
    'astro:config:setup': ({ updateConfig }) => {
      const consts = themeConstsSchema.parse(
        parse(fs.readFileSync(path.join(path.resolve(), file), { encoding: 'utf8' })),
      );
      const exportedObj = objectToExport(consts);
      fs.writeFileSync(
        path.join(path.resolve(), file.split('.').toSpliced(-1, 1, 'js').join('.')),
        `export default ${exportedObj}`,
      );

      updateConfig({
        site: consts.site,
        base: `/${consts.base}`,
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
