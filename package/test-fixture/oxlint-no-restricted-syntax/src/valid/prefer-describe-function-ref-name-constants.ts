// Fixture: describe({ name: '<string>' }) matching a NON-callable binding
// should NOT trigger prefer-describe-function-ref-name. `.name` on a Map
// instance is `undefined`; the string literal is the only sensible form.
// Expected: zero rule violations.

function describe({
  name,
}: {
  name: string;
},): void {
  void name;
}

const MANAGERS = new Map<string, string>();
const FEED_PAGE_SIZE = 25;
const SETTINGS = {
  theme: 'dark',
};

describe({
  name: 'MANAGERS',
},);

describe({
  name: 'FEED_PAGE_SIZE',
},);

describe({
  name: 'SETTINGS',
},);

void MANAGERS;
void FEED_PAGE_SIZE;
void SETTINGS;

export {};
