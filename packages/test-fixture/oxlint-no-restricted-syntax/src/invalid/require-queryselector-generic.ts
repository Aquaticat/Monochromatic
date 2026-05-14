// Fixture: querySelector without generic should be banned.
// Expected violation: no-restricted-syntax(require-queryselector-generic)

function pick(): Element | null {
  return document.querySelector('.target');
}

void pick;

export {};
