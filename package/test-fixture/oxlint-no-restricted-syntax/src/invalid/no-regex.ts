// Fixture: regex usage must use scoped disables with justification.
// Expected violation: no-restricted-syntax(no-regex)

const literalPattern = /token/;
const constructorPattern = new RegExp('token',);
const calledConstructorPattern = RegExp('token',);
const matched = 'token'.match(/token/,);
const matchedAll = 'token'.matchAll(/token/g,);
const replaced = 'token'.replace(/token/, 'value',);
const replacedAll = 'token'.replaceAll(/token/g, 'value',);
const searched = 'token'.search(/token/,);
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
