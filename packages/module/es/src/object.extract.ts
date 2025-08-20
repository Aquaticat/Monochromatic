import type { UnknownRecord, } from 'type-fest';
import type { Logged, } from './logged.basic';
import type { MaybeAsyncSchema, } from './schema.basic';
import { getDefaultLogger, } from './string.log.ts';

// objectExtractSync, objectExtract
// vaguely similar to object.pick, but processes each "layer" of picked and extracts everything.
// Examples:
// await objectExtract({obj: {}, extracted: ['a']) // {}
// await objectExtract({obj: {}, extracted: []}) // throw
// await objectExtract({obj: {a: 1}, extracted: ['a']}) // {a:1}
// await objectExtract({obj: {b: 1}, extracted: ['a']}) // {}
// await objectExtract({obj: {a: 1, b: 1}, extracted: ['b']}) // {b:1}
// await objectExtract({obj: {a1: 1, a2: 1}, extracted: ['b', {parse: (str: string): string => str.startsWith('a')}]}) // {a1: 1, a2: 1}
// await objectExtract({obj: {a1: 1, a2: 1, b1: 1}, extracted: [{parse: (str: string) => str.startsWith('a') ? `${str}1` : throws()}, {parse: (str: string) => str.endsWith('1') ? `${str}b`: throws()}]}) // {a11: 1, a21: 1, b1b: 1}


// Also see:
// Extract<Type, Union>
//
// Constructs a type by extracting from Type all union members that are assignable to Union.
// Example
//
// type T0 = Extract<"a" | "b" | "c", "a" | "f">;
//
// type T0 = "a"
// type T1 = Extract<string | number | (() => void), Function>;
//
// type T1 = () => void
//
// type Shape =
// | { kind: "circle"; radius: number }
// | { kind: "square"; x: number }
// | { kind: "triangle"; x: number; y: number };
//
// type T2 = Extract<Shape, { kind: "circle" }>
//
// type T2 = {
// kind: "circle";
// radius: number;
// }
