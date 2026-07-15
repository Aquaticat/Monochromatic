// Fixture: immediate mutations that should move into initializers.
// Expected: no-restricted-syntax/no-immediate-mutation reports every statement after each initializer.

const pushedValues = [
  1,
  2,
];
pushedValues.push(3,);

const prependedValues = [
  2,
  3,
];
prependedValues.unshift(1,);

const objectWithAssignedProperty = {
  first: 1,
};
objectWithAssignedProperty.second = 2;

const objectWithAssignedSource = {
  first: 1,
};
Object.assign(
  objectWithAssignedSource,
  {
    second: 2,
  },
);

const setFromArray = new Set([
  1,
  2,
],);
setFromArray.add(3,);

const mapFromArray = new Map([
  [
    'first',
    1,
  ],
],);
mapFromArray.set(
  'second',
  2,
);

export {};
