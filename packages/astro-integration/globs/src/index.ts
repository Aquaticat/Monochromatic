import * as fs from 'node:fs';
import * as path from 'node:path';
import isLang from '@monochromatic.dev/module-is-lang';

import type { AstroIntegration } from 'astro';

export default (name = 'post', recursive = false): AstroIntegration => ({
  name: 'globs',
  hooks: {
    'astro:config:setup': () => {
      const langPaths = fs
        .readdirSync(path.join(path.resolve(), 'src', 'pages'))
        .filter((file) => isLang(file))
        .concat(['']);
      fs.writeFileSync(
        path.join(path.resolve(), 'src', 'components', '_globs.astro'),
        `
---
export const langsPosts = new Map([
  ${langPaths.map((langPath) => [
    `['${langPath}'`,
    `await Astro.glob('../pages/${langPath === '' ? '' : `${langPath}/`}${name}/${recursive ? '**/' : ''}*.mdx')]`,
  ])}
]);
---
      `.trimStart(),
      );
    },
  },
});
