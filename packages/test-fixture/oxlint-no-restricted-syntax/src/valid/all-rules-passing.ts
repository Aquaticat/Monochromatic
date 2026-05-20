// Fixture: code that does not trigger any no-restricted-syntax rule.
// Expected: zero rule violations.

function double(x: number,): number {
  return x * 2;
}

function combine({
  left,
  right,
}: {
  left: string;
  right: string;
},): string {
  return `${left}${right}`;
}

function sum(items: readonly number[],): number {
  return items.reduce(
    function add(acc, item,): number {
      return acc + item;
    },
    0,
  );
}

function classify(kind: 'a' | 'b',): number {
  if (kind === 'a')
    return 1;
  return 0;
}

function clean(value: string,): string {
  return value.trimStart();
}

function has({
  obj,
  key,
}: {
  obj: Record<string, unknown>;
  key: string;
},): boolean {
  return Object.hasOwn(obj, key,);
}

function pick(): HTMLInputElement | null {
  return document.querySelector<HTMLInputElement>('.target',);
}

// no-class allowlist: direct Error subclass passes via the `Error` suffix on the superclass name.
class DirectError extends Error {}

// no-class allowlist: transitive Error chain passes via the `Error` suffix on the own class name.
class TransitiveError extends DirectError {}

// no-class allowlist: web component passes via the `Element` suffix on the superclass name (HTMLElement).
class WebComponent extends HTMLElement {}

// no-class allowlist: custom-element chain passes via the `Element` suffix on the own class name.
class CustomElement extends WebComponent {}

void double;
void combine;
void sum;
void classify;
void clean;
void has;
void pick;
void DirectError;
void TransitiveError;
void WebComponent;
void CustomElement;

export {};
