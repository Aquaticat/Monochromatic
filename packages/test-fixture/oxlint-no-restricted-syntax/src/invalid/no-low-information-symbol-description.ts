// Fixture: static Symbol descriptions must carry enough debugging information.
// Expected violation: no-restricted-syntax(no-low-information-symbol-description)

const lowInformationSymbol = Symbol('meow',);

export { lowInformationSymbol, };
