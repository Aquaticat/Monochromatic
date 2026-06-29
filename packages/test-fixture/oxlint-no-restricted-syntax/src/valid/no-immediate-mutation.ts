// Fixture: mutation shapes intentionally outside no-immediate-mutation reports.
// Expected: zero no-restricted-syntax violations.

const existingValues = new Set([
  1,
  2,
],);
const clonedValues = new Set(existingValues,);
clonedValues.add(3,);

const existingEntries = new Map([
  [
    'first',
    1,
  ],
],);
const clonedEntries = new Map(existingEntries,);
clonedEntries.set(
  'second',
  2,
);

const selfReferencingSet = new Set([
  1,
],);
selfReferencingSet.add(selfReferencingSet.size,);

const selfReferencingMap = new Map([
  [
    'first',
    1,
  ],
],);
selfReferencingMap.set(
  'size',
  selfReferencingMap.size,
);

const laterValues = [
  1,
];
void laterValues;
laterValues.push(2,);

function seenWith(
  {
    seen,
    variable,
  }: {
    readonly seen: ReadonlySet<object>;
    readonly variable: object;
  },
): ReadonlySet<object> {
  const nextSeen = new Set(seen,);
  nextSeen.add(variable,);
  return nextSeen;
}

const Set = globalThis.Set;
const localShadowedSet = new Set();
localShadowedSet.add(1,);

const Map = globalThis.Map;
const localShadowedMap = new Map();
localShadowedMap.set(
  'shadowed',
  1,
);

void seenWith;

export {};
