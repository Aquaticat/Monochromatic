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

void double;
void combine;
void sum;
void classify;
void clean;
void has;
void pick;

export {};
