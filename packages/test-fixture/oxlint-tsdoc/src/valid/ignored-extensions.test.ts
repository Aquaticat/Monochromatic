// Fixture: .test.ts files should be ignored by tsdoc rules.
// Expected: zero tsdoc rule violations.

function undocumentedInTestFile(): void { /* Intentional no-op for TSDoc testing */ }

const alsoUndocumented = (): number => 42;

class NoDocNeeded {}

type UndocumentedType = { value: string };

export {}
