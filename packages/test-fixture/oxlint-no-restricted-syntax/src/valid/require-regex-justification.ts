// Fixture: necessary regex usage carries scoped disable comments with justification.
// Expected: zero no-restricted-syntax rule violations.

// oxlint-disable-next-line no-restricted-syntax/require-regex-justification -- fixed CLI token grammar over one argument; no nested quantifiers, so matching is linear.
const literalPattern = /token/;

// oxlint-disable-next-line no-restricted-syntax/require-regex-justification -- user config supplies the pattern intentionally; caller validates length before compiling.
const constructorPattern = new RegExp('token',);

// oxlint-disable-next-line no-restricted-syntax/require-regex-justification -- user config supplies the pattern intentionally; caller validates length before compiling.
const calledConstructorPattern = RegExp('token',);

// oxlint-disable-next-line no-restricted-syntax/require-regex-justification -- match API is under test; literal has no nested quantifiers and input is one fixture string.
const matched = 'token'.match(/token/,);

// oxlint-disable-next-line no-restricted-syntax/require-regex-justification -- matchAll API is under test; global literal has no nested quantifiers and input is one fixture string.
const matchedAll = 'token'.matchAll(/token/g,);

// oxlint-disable-next-line no-restricted-syntax/require-regex-justification -- replace API is under test; literal has no nested quantifiers and input is one fixture string.
const replaced = 'token'.replace(/token/, 'value',);

// oxlint-disable-next-line no-restricted-syntax/require-regex-justification -- replaceAll API is under test; global literal has no nested quantifiers and input is one fixture string.
const replacedAll = 'token'.replaceAll(/token/g, 'value',);

// oxlint-disable-next-line no-restricted-syntax/require-regex-justification -- search API is under test; literal has no nested quantifiers and input is one fixture string.
const searched = 'token'.search(/token/,);

// oxlint-disable-next-line no-restricted-syntax/require-regex-justification -- split API is under test; literal has no nested quantifiers and input is one fixture string.
const split = 'token'.split(/token/,);

export {
  calledConstructorPattern,
  constructorPattern,
  literalPattern,
  matched,
  matchedAll,
  replaced,
  replacedAll,
  searched,
  split,
};
