// Fixture: union types containing `undefined` or `null` should be banned.
// Expected violation: no-restricted-syntax(no-nullish-union)
// Ten distinct forms, each a separate TSUnionType with a nullish member
// (seven `undefined` variants, three `null` variants).

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

// Form 8: T | null on a binding annotation (pivoting undefined to null is the
// same nullish escape).
const e: string | null = null;

// Form 9: null | T (null first).
const f: null | string = null;

// Form 10: null nested inside Promise<...> (mirrors fs-path's pivot to
// Promise<string | null>).
const g: Promise<string | null> = Promise.resolve(null,);

void a;
void b;
void find;
void take;
void c;
void d;
void e;
void f;
void g;

export type { WithOptional, };
