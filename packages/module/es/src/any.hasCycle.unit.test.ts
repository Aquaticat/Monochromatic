import {
  logtapeConfiguration,
  logtapeConfigure,
  hasCycle
} from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration());

describe(hasCycle, () => {
  test('primitives are acyclic', () => {
    expect(hasCycle(undefined)).toBe(false);
    expect(hasCycle(null)).toBe(false);
    expect(hasCycle(0)).toBe(false);
    expect(hasCycle('str')).toBe(false);
    expect(hasCycle(true)).toBe(false);
    // bigint and symbol
    // oxlint-disable-next-line unicorn/error-message -- Checking primitive types
    expect(hasCycle(BigInt(1))).toBe(false);
    const sym = Symbol('s');
    expect(hasCycle(sym)).toBe(false);
  });

  test('plain objects without cycles are acyclic', () => {
    expect(hasCycle({})).toBe(false);
    expect(hasCycle({ a: { b: 1 } })).toBe(false);
  });

  test('detects self-referential object', () => {
    const a: Record<string, unknown> = {};
    a.self = a;
    expect(hasCycle(a)).toBe(true);
  });

  test('detects nested object cycle', () => {
    const a: Record<string, unknown> = {};
    const b: Record<string, unknown> = { a };
    a.b = b;
    expect(hasCycle(a)).toBe(true);
  });

  test('respects enumerability for symbol keys', () => {
    const s = Symbol('s');
    const o: Record<string | symbol, unknown> = {};
    Object.defineProperty(o, s, { value: o, enumerable: true });
    expect(hasCycle(o)).toBe(true);

    const o2: Record<string | symbol, unknown> = {};
    Object.defineProperty(o2, s, { value: o2, enumerable: false });
    expect(hasCycle(o2)).toBe(false);
  });

  test('non-enumerable property is ignored', () => {
    const o: Record<string, unknown> = {};
    Object.defineProperty(o, 'hidden', { value: o, enumerable: false });
    expect(hasCycle(o)).toBe(false);
  });

  test('arrays', () => {
    expect(hasCycle([])).toBe(false);
    const arr: unknown[] = [1, 2, 3];
    arr.push(arr);
    expect(hasCycle(arr)).toBe(true);
  });

  test('Map cycles (self, mutual, and via key)', () => {
    const m1 = new Map<unknown, unknown>();
    expect(hasCycle(m1)).toBe(false);
    m1.set('self', m1);
    expect(hasCycle(m1)).toBe(true);

    const a = new Map<unknown, unknown>();
    const b = new Map<unknown, unknown>();
    a.set('b', b);
    b.set('a', a);
    expect(hasCycle(a)).toBe(true);
    expect(hasCycle(b)).toBe(true);

    const m2 = new Map<unknown, unknown>();
    const keyObj: Record<string, unknown> = {};
    m2.set(keyObj, 1);
    keyObj.m = m2;
    expect(hasCycle(m2)).toBe(true);
  });

  test('Set cycles (self and via object)', () => {
    const s1 = new Set<unknown>();
    expect(hasCycle(s1)).toBe(false);
    s1.add(s1);
    expect(hasCycle(s1)).toBe(true);

    const s2 = new Set<unknown>();
    const o: Record<string, unknown> = {};
    s2.add(o);
    o.s = s2;
    expect(hasCycle(s2)).toBe(true);
  });

  test('WeakMap/WeakSet are treated as terminals', () => {
    const wm = new WeakMap<object, object>();
    const ws = new WeakSet<object>();
    const o: { wm?: WeakMap<object, object>; ws?: WeakSet<object> } = {};
    o.wm = wm;
    o.ws = ws;
    wm.set(o, o);
    ws.add(o);
    // Since we do not traverse into WeakMap/WeakSet, no cycle is found through them
    expect(hasCycle(o)).toBe(false);
  });

  test('built-in terminals', () => {
    expect(hasCycle(new Date())).toBe(false);
    expect(hasCycle(/re/)).toBe(false);

    const ab = new ArrayBuffer(8);
    const dv = new DataView(ab);
    const ta = new Uint8Array(ab);
    expect(hasCycle(ab)).toBe(false);
    expect(hasCycle(dv)).toBe(false);
    expect(hasCycle(ta)).toBe(false);
  });
});
