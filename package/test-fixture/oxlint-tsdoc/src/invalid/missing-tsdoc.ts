// Fixture: declarations missing TSDoc comments.
// Expected violations: tsdoc(require-tsdoc)

function undocumentedFunction(): void {}

const undocumentedArrow = (): void => {};

class UndocumentedClass {}

type UndocumentedType = { value: string; };

type UndocumentedInterface = {
  name: string;
};

enum UndocumentedEnum {
  A,
  B,
}

const UNDOCUMENTED_CONST = 42;

export {};
