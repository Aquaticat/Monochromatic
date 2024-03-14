import * as fs from 'node:fs';
import * as path from 'node:path';

export default (langPaths = ['', 'zh'], name = 'post') => ({
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
    langPath === ''
      ? `await Astro.glob('../pages/${name}/*.mdx')]`
      : `await Astro.glob('../pages/${langPath}/${name}/*.mdx')]`,
  ])}
]);
---
      `.trimStart(),
      );
    },
  },
});
