// Fixture: .test.ts files should be ignored by tsdoc rules.
// Expected: zero tsdoc rule violations.

function undocumentedInTestFile(): void {}

const alsoUndocumented = (): number => 42;

class NoDocNeeded {}

type UndocumentedType = { value: string; };
