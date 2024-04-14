// src/index.ts
var lowercaseLetters = [..."abcdefghijklmnopqrstuvwxyz"];
var uppercaseLetters = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"];
var shortLangs = lowercaseLetters.flatMap(
  (lowercaseLetter) => lowercaseLetters.map((lowercaseLetter2) => `${lowercaseLetter}${lowercaseLetter2}`)
);
var langSubs = uppercaseLetters.flatMap(
  (uppercaseLetter) => uppercaseLetters.map((uppercaseLetter2) => `${uppercaseLetter}${uppercaseLetter2}`)
);
var fullLangs = shortLangs.flatMap((shortLang) => langSubs.map((langSub) => `${shortLang}_${langSub}`));
export {
  fullLangs,
  shortLangs
};
//# sourceMappingURL=index.js.map
