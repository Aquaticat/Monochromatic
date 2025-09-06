type Types = 'bigint' | 'boolean' | 'function' | 'number' | 'object' | 'string'
  | 'undefined';

type BigintChild = { number: 0 | 'negative' | 'positive'; };

type BooleanChild = { true: boolean; };

type FunctionChild = { generator: boolean; async: boolean; };

type NumberChild = { number: 0 | 'negative' | 'positive'; float: boolean; };

type ObjectChild = {
  prototype: 'null' | 'array' | 'iterable' | 'date' | 'map' | 'set' | 'promise' | 'proxy'
    | 'record' | 'regexp';
};

type ObjectRegexpChild = { global: boolean; };

type StringChild = { empty: true | 'nonEmpty'; };

type StringNonEmptyChild = {
  char: false | 'uppercaseLetter' | 'lowerCaseLetter' | 'nonLetter';
};

type UndefinedChild = never;

export type $ = [];

// undefined ['undefined']
// 0n ['bigint', {number: 0}]
// true ['boolean', {true: true}]
// 0.1 ['number', {number: 'positive', float: true}]
// /a/g ['object', {prototype: 'regexp'}, {global: true}]
