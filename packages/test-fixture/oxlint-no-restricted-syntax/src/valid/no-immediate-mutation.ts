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

export {};
