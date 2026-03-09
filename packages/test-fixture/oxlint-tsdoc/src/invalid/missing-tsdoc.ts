// Fixture: declarations missing TSDoc comments.
// Expected violations: tsdoc(require-tsdoc)

function undocumentedFunction(): void { /* Intentional no-op for TSDoc testing */ }

const undocumentedArrow = (): void => { /* Intentional no-op for TSDoc testing */ };

class UndocumentedClass {}

type UndocumentedType = { value: string };

type UndocumentedInterface = {
  name: string;
}

enum UndocumentedEnum {
  A,
  B,
}

const UNDOCUMENTED_CONST = 42;

export {};
