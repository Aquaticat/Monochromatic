// Fixture: function parameters on the same line, plus TypeScript function-like signatures.
// Expected violations: stylistic(param-per-line)

function add(a: number, b: number): number {
  return a + b;
}

function greet(name: string, age: number, title: string): string {
  return `${title} ${name}, age ${String(age)}`;
}

const multiply = function mul(x: number, y: number): number {
  return x * y;
};

// TSFunctionType
type FnType = (a: string, b: number) => void;

// TSDeclareFunction
declare function ambient(a: string, b: number): void;

// TSMethodSignature
type WithMethod = { run(a: string, b: number): void; };

// TSCallSignatureDeclaration
type Callable = { (a: string, b: number): void; };

// TSConstructSignatureDeclaration
type Constructible = { new (a: string, b: number): void; };

// TSConstructorType
type CtorType = new (a: string, b: number) => void;

// TSEmptyBodyFunctionExpression (declare class method body-less signature)
declare class WithMember {
  m(a: string, b: number): void;
}

export { add, ambient, greet, multiply, WithMember, };
export type { Callable, Constructible, CtorType, FnType, WithMethod, };
