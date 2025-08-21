import {
  logtapeConfiguration,
  logtapeConfigure,
  unknownHasCycle,
} from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration(),);

describe(unknownHasCycle, () => {
  test('primitives are acyclic', () => {
    expect(unknownHasCycle(undefined,),).toBe(false,);
    expect(unknownHasCycle(null,),).toBe(false,);
    expect(unknownHasCycle(0,),).toBe(false,);
    expect(unknownHasCycle('str',),).toBe(false,);
    expect(unknownHasCycle(true,),).toBe(false,);
    // bigint and symbol
    // oxlint-disable-next-line unicorn/error-message -- Checking primitive types
    expect(unknownHasCycle(BigInt(1,),),).toBe(false,);
    const sym = Symbol('s',);
    expect(unknownHasCycle(sym,),).toBe(false,);
  });

  test('plain objects without cycles are acyclic', () => {
    expect(unknownHasCycle({},),).toBe(false,);
    expect(unknownHasCycle({ a: { b: 1, }, },),).toBe(false,);
  });

  test('detects self-referential object', () => {
    const a: Record<string, unknown> = {};
    a.self = a;
    expect(unknownHasCycle(a,),).toBe(true,);
  });

  test('detects nested object cycle', () => {
    const a: Record<string, unknown> = {};
    const b: Record<string, unknown> = { a, };
    a.b = b;
    expect(unknownHasCycle(a,),).toBe(true,);
  });

  test('respects enumerability for symbol keys', () => {
    const s = Symbol('s',);
    const o: Record<string | symbol, unknown> = {};
    Object.defineProperty(o, s, { value: o, enumerable: true, },);
    expect(unknownHasCycle(o,),).toBe(true,);

    const o2: Record<string | symbol, unknown> = {};
    Object.defineProperty(o2, s, { value: o2, enumerable: false, },);
    expect(unknownHasCycle(o2,),).toBe(false,);
  });

  test('non-enumerable property is ignored', () => {
    const o: Record<string, unknown> = {};
    Object.defineProperty(o, 'hidden', { value: o, enumerable: false, },);
    expect(unknownHasCycle(o,),).toBe(false,);
  });

  test('arrays', () => {
    expect(unknownHasCycle([],),).toBe(false,);
    const arr: unknown[] = [1, 2, 3,];
    arr.push(arr,);
    expect(unknownHasCycle(arr,),).toBe(true,);
  });

  test('Map cycles (self, mutual, and via key)', () => {
    const m1 = new Map<unknown, unknown>();
    expect(unknownHasCycle(m1,),).toBe(false,);
    m1.set('self', m1,);
    expect(unknownHasCycle(m1,),).toBe(true,);

    const a = new Map<unknown, unknown>();
    const b = new Map<unknown, unknown>();
    a.set('b', b,);
    b.set('a', a,);
    expect(unknownHasCycle(a,),).toBe(true,);
    expect(unknownHasCycle(b,),).toBe(true,);

    const m2 = new Map<unknown, unknown>();
    const keyObj: Record<string, unknown> = {};
    m2.set(keyObj, 1,);
    keyObj.m = m2;
    expect(unknownHasCycle(m2,),).toBe(true,);
  });

  test('Set cycles (self and via object)', () => {
    const s1 = new Set<unknown>();
    expect(unknownHasCycle(s1,),).toBe(false,);
    s1.add(s1,);
    expect(unknownHasCycle(s1,),).toBe(true,);

    const s2 = new Set<unknown>();
    const o: Record<string, unknown> = {};
    s2.add(o,);
    o.s = s2;
    expect(unknownHasCycle(s2,),).toBe(true,);
  });

  test('WeakMap/WeakSet are treated as terminals', () => {
    const wm = new WeakMap<object, object>();
    const ws = new WeakSet<object>();
    const o: { wm?: WeakMap<object, object>; ws?: WeakSet<object>; } = {};
    o.wm = wm;
    o.ws = ws;
    wm.set(o, o,);
    ws.add(o,);
    // Since we do not traverse into WeakMap/WeakSet, no cycle is found through them
    expect(unknownHasCycle(o,),).toBe(false,);
  });

  test('built-in terminals', () => {
    expect(unknownHasCycle(new Date(),),).toBe(false,);
    expect(unknownHasCycle(/re/,),).toBe(false,);

    const ab = new ArrayBuffer(8,);
    const dv = new DataView(ab,);
    const ta = new Uint8Array(ab,);
    expect(unknownHasCycle(ab,),).toBe(false,);
    expect(unknownHasCycle(dv,),).toBe(false,);
    expect(unknownHasCycle(ta,),).toBe(false,);
  });
},);
