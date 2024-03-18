import { parse } from 'smol-toml';
import * as fs from 'node:fs';
import * as path from 'node:path';
import themeConstsSchema from '@monochromatic.dev/schema-theme-consts';
import objectToExport from '@monochromatic.dev/module-object-to-export';

export default (file = 'consts.toml') => ({
  name: 'gen-consts',
  hooks: {
    'astro:config:setup': () => {
      const consts = themeConstsSchema.parse(
        parse(fs.readFileSync(path.join(path.resolve(), file), { encoding: 'utf8' })),
      );
      fs.writeFileSync(
        path.join(path.resolve(), file.split('.').toSpliced(-1, 1, 'js').join('.')),
        `export default ${objectToExport(consts)}`,
      );
    },
  },
});
