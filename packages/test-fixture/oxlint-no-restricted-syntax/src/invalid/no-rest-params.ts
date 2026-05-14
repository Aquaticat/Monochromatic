// Fixture: rest parameter should be banned (accept an array parameter instead).
// Expected violation: no-restricted-syntax(no-rest-params)

function log(...messages: string[]): void {
  void messages;
}

void log;

export {};
