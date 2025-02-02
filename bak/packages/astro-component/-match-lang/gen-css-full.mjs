import { writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const lowercaseLetters = [...'abcdefghijklmnopqrstuvwxyz'];
const uppercaseLetters = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];

const langCodes = lowercaseLetters.flatMap((lowercaseLetter) =>
  lowercaseLetters.map((lowercaseLetter2) => `${lowercaseLetter}${lowercaseLetter2}`),
);
const langSubCodes = uppercaseLetters.flatMap((lowercaseLetter) =>
  uppercaseLetters.map((uppercaseLetter2) => `${lowercaseLetter}${uppercaseLetter2}`),
);

const fullLangCodes = langCodes.flatMap((langCode) => langSubCodes.map((langSubCode) => `${langCode}_${langSubCode}`));

const langCodesCss = langCodes
  .map((langCode) => `html[lang='${langCode}'] .-MatchLang [lang]:not([lang|='${langCode}']) { display: none; }`)
  .join('\n');

const fullLangCodesCss = fullLangCodes
  .map(
    (fullLangCode) =>
      `html[lang='${fullLangCode}'] .-MatchLang [lang]:not([lang='${fullLangCode}']) { display: none; }`,
  )
  .join('\n');

writeFileSync(
  join(resolve(), 'src', 'index.css'),
  `${langCodesCss}
${fullLangCodesCss}`,
);
