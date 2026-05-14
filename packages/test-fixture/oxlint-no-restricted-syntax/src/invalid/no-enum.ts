// Fixture: TypeScript enum should be banned (use union types instead).
// Expected violation: no-restricted-syntax(no-enum)

enum Color {
  Red,
  Green,
  Blue,
}

void Color.Red;

export {};
