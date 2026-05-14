// Fixture: function parameters on the same line.
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

export { add, greet, multiply };
