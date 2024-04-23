const lowercaseLetters = [...'abcdefghijklmnopqrstuvwxyz'];
const uppercaseLetters = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];

export const shortLangs = lowercaseLetters.flatMap((lowercaseLetter) =>
  lowercaseLetters.map((lowercaseLetter2) => `${lowercaseLetter}${lowercaseLetter2}`)
);

const langSubs = uppercaseLetters.flatMap((uppercaseLetter) =>
  uppercaseLetters.map((uppercaseLetter2) => `${uppercaseLetter}${uppercaseLetter2}`)
);

export const fullLangs = shortLangs.flatMap((shortLang) => langSubs.map((langSub) => `${shortLang}_${langSub}`));

export default shortLangs.concat(fullLangs);
