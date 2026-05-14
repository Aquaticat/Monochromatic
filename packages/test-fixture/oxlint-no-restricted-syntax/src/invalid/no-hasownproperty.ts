// Fixture: `hasOwnProperty` call should be banned (use Object.hasOwn instead).
// Expected violation: no-restricted-syntax(no-hasownproperty)

function check(obj: Record<string, unknown>, key: string): boolean {
  return obj.hasOwnProperty(key);
}

void check;

export {};
