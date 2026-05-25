// Fixture: union types containing `undefined` should be banned.
// Expected violation: no-restricted-syntax(no-undefined-union)
// Seven distinct forms, each a separate TSUnionType with an undefined member.

// Form 1: T | undefined on a binding annotation.
const a: string | undefined = undefined;

// Form 2: undefined | T (undefined first).
const b: undefined | string = undefined;

// Form 3: optional property still widened with | undefined.
type WithOptional = {
  foo?: string | undefined;
};

// Form 4: function return type.
function find(): string | undefined {
  return undefined;
}

// Form 5: function parameter type.
function take(x: number | undefined,): void {
  void x;
}

// Form 6: nested inside Promise<...>.
const c: Promise<string | undefined> = Promise.resolve(undefined,);

// Form 7: nested inside Array<...>.
const d: Array<string | undefined> = [];

void a;
void b;
void find;
void take;
void c;
void d;

export type { WithOptional, };
