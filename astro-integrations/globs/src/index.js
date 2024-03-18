import * as fs from 'node:fs';
import * as path from 'node:path';

export default (langPaths = ['', 'zh'], name = 'post', recursive = false) => ({
  name: 'globs',
  hooks: {
    'astro:config:setup': () => {
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
