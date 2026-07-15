// Fixture: describe({ name: '<string>' }) where the string matches an in-scope
// binding should be banned. Function references survive renames; string
// literals silently drift.
// Expected violation: no-restricted-syntax(prefer-describe-function-ref-name)

function describe({
  name,
}: {
  name: string;
}): void {
  void name;
}

function myFunction(): number {
  return 1;
}

describe({
  name: 'myFunction',
});

void myFunction;

export {};
