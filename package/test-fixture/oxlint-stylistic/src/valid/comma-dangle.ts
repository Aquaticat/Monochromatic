// Fixture: comma-delimited lists already carry trailing commas where required.
// Expected: zero stylistic/comma-dangle violations.

import defaultValue from 'comma-dangle-default';
import * as namespaceValue from 'comma-dangle-namespace';
import { one as importedOne, } from 'comma-dangle-named';
import data from 'comma-dangle-data' with { type: 'json', };
import {} from 'comma-dangle-empty';

const one = importedOne;
const values = [one,];
const sourceValues = [one,];
const sourceObject = { one, };
const emptyArray: string[] = [];
const emptyObject = {};

const [first,] = sourceValues;
const [] = sourceValues;
const { one: picked, } = sourceObject;
const {} = sourceObject;
const [...restArray] = sourceValues;
const { ...restObject } = sourceObject;

function identity(value: string,): string {
  return value;
}

function emptyParams(): void {}

function restParams(...rest: string[]): void {
  rest.toString();
}

function generic<T,>(value: T,): T {
  return value;
}

const expression = function named(value: string,): string {
  return value;
};

const arrow = (value: string,): string => value;

class Thing {
  constructor(value: string,) {
    value.toString();
  }
}

identity(one,);
new Thing(one,);

const dynamicOne = import(one,);
const dynamicOptions = import(one, { with: { type: 'json', }, },);

enum Value {
  One,
}

enum EmptyValue {}

type StringPair = [string,];
type EmptyTuple = [];
type Generic<T,> = T;
type Fn = (value: string,) => void;
type Method = {
  method(value: string,): void;
};
type Callable = {
  (value: string,): void;
};
type Constructible = {
  new(value: string,): Thing;
};
type Ctor = new(value: string,) => Thing;

declare function declared(value: string,): void;

declare class DeclaredClass {
  method(value: string,): void;
}

export { one, };
export { one as reexported, } from 'comma-dangle-reexport' with { type: 'json', };
export * from 'comma-dangle-all' with { type: 'json', };
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
  data,
  defaultValue,
  declared,
  DeclaredClass,
  dynamicOne,
  dynamicOptions,
  emptyArray,
  emptyObject,
  emptyParams,
  EmptyValue,
  expression,
  first,
  generic,
  identity,
  namespaceValue,
  picked,
  restArray,
  restObject,
  restParams,
  Thing,
  Value,
  values,
};
