import * as fs from 'node:fs';
import * as path from 'node:path';

export default () => ({
  name: 'gen-match-lang-css',
  hooks: {
    'astro:config:done': ({ config }) => {
      fs.writeFileSync(
        path.join(path.resolve(), 'src', 'components', '-MatchLang.css'),
        config.i18n.locales
          .map(
            (locale) =>
              `
      html[lang|="${locale}"] .-MatchLang [lang]:not([lang|="${locale}"]) {
        display: none;
      }
      `,
          )
          .join('\n'),
      );
    },
  },
});
