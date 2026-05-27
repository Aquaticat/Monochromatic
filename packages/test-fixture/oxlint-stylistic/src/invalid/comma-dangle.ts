// Fixture: comma-delimited lists missing required trailing commas.
// Expected violations: stylistic(comma-dangle).

import { one as importedOne } from 'comma-dangle-named';
import data from 'comma-dangle-data' with { type: 'json' };

const one = importedOne;
const two = data;
const sourceValues = [one, two];
const sourceObject = { one };
const values = [one];
const pair = [one, two];
const value = { one: 1 };
const [first] = sourceValues;
const { one: picked } = sourceObject;

function identity(value: string): string {
  return value;
}

function generic<T>(value: T): T {
  return value;
}

const expression = function named(value: string): string {
  return value;
};

const arrow = (value: string): string => value;

class Thing {
  constructor(value: string) {
    value.toString();
  }
}

identity(one);
new Thing(one);

const dynamicOne = import(one);
const dynamicOptions = import(one, { with: { type: 'json' } });

enum Value {
  One
}

type StringPair = [string];
type Generic<T> = T;
type Fn = (value: string) => void;
type Method = {
  method(value: string): void;
};
type Callable = {
  (value: string): void;
};
type Constructible = {
  new(value: string): Thing;
};
type Ctor = new(value: string) => Thing;

declare function declared(value: string): void;

declare class DeclaredClass {
  method(value: string): void;
}

const commentValue = {
  one: 1 // keep comment
};

function restParams(...rest: string[]): void {
  rest.toString();
}

const [...restArray] = sourceValues;
const { ...restObject } = sourceObject;

export { one };
export { one as reexported } from 'comma-dangle-reexport' with { type: 'json' };
export * from 'comma-dangle-all' with { type: 'json' };

export type {
  Callable,
  Constructible,
  Ctor,
  Fn,
  Generic,
  Method,
  StringPair,
};
export {
  arrow,
  commentValue,
  declared,
  DeclaredClass,
  dynamicOne,
  dynamicOptions,
  expression,
  first,
  generic,
  identity,
  pair,
  picked,
  restArray,
  restObject,
  restParams,
  sourceObject,
  sourceValues,
  Thing,
  two,
  value,
  Value,
  values,
};
