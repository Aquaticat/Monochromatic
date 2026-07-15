// Fixture: class declaration with neither an allowlisted superclass nor an
// allowlisted name suffix should be banned. The factory-function equivalent
// is the expected replacement.
// Expected violation: no-restricted-syntax(no-class)

class BareCoordinator {
  go(): void {}
}

void BareCoordinator;

export {};
