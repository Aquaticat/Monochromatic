// Fixture: non-empty brace-delimited bodies already keep content between brace lines.
// Expected: zero block-body-newline violations.

const condition = true;
const values = [1,];

function value(): number {
  return 1;
}

const arrow = (): number => {
  return value();
};

function doThing(): void {}

if (condition) {
  doThing();
}
else {
  doThing();
}

for (const item of values) {
  void item;
}

while (!condition) {
  doThing();
}

do {
  doThing();
} while (!condition);

try {
  doThing();
}
catch (error) {
  throw error;
}
finally {
  doThing();
}

switch (value()) {
  case 1:
    doThing();
    break;
  default:
    doThing();
}

class Example {
  static value = 0;

  static {
    Example.value = 1;
  }

  method(): number {
    return Example.value;
  }
}

namespace ExampleNamespace {
  export const namespaceValue = 1;
}

function emptyBlock(): void {}

function commentOnlyBlock(): void {
  /* keep comment-only body */
}

export {
  Example,
  arrow,
  commentOnlyBlock,
  emptyBlock,
  value,
};
export {
  ExampleNamespace,
};
