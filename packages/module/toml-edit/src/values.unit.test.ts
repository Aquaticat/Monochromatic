/**
 * Tests for the JS-to-TOML value coercion path used by `tomlSet`.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { TomlTypeError, } from './errors.ts';
import { parseTomlEdit, } from './parse-toml-edit.ts';
import { tomlSet, } from './toml-set.ts';
import { tomlStringify, } from './toml-stringify.ts';
import {
  tomlLocalDate,
  tomlLocalDateTime,
  tomlLocalTime,
} from './wrappers.ts';

await describe({
  name: 'JS-to-TOML value coercion',
  children: [
    it({
      name: 'tomlLocalDate produces a local-date assignment',
      fn: async () => {
        const e1 = tomlSet({
          edit: parseTomlEdit({ source: '', },),
          path: ['d',],
          value: tomlLocalDate('2026-05-14',),
        },);
        expect(tomlStringify({ edit: e1, },),).toContain('d = 2026-05-14',);
      },
    },),

    it({
      name: 'tomlLocalDateTime produces a local-date-time assignment',
      fn: async () => {
        const e1 = tomlSet({
          edit: parseTomlEdit({ source: '', },),
          path: ['t',],
          value: tomlLocalDateTime('2026-05-14T10:00:00',),
        },);
        expect(tomlStringify({ edit: e1, },),).toContain('t = 2026-05-14T10:00:00',);
      },
    },),

    it({
      name: 'tomlLocalTime produces a local-time assignment',
      fn: async () => {
        const e1 = tomlSet({
          edit: parseTomlEdit({ source: '', },),
          path: ['t',],
          value: tomlLocalTime('10:00:00',),
        },);
        expect(tomlStringify({ edit: e1, },),).toContain('t = 10:00:00',);
      },
    },),

    it({
      name: 'boolean coerces to true/false',
      fn: async () => {
        const e1 = tomlSet({
          edit: parseTomlEdit({ source: '', },),
          path: ['enabled',],
          value: true,
        },);
        expect(tomlStringify({ edit: e1, },),).toContain('enabled = true',);
      },
    },),

    it({
      name: 'array of primitives renders inline',
      fn: async () => {
        const e1 = tomlSet({
          edit: parseTomlEdit({ source: '', },),
          path: ['xs',],
          value: [1, 2, 3,],
        },);
        const out = tomlStringify({ edit: e1, },);
        expect(out,).toContain('xs = [ 1, 2, 3, ]',);
      },
    },),

    it({
      name: 'null and undefined throw TomlTypeError',
      fn: async () => {
        const edit = parseTomlEdit({ source: '', },);
        expect(function setNull() {
          tomlSet({ edit, path: ['x',], value: null, },);
        },)
          .toThrow(TomlTypeError,);
        expect(function setUndefined() {
          tomlSet({ edit, path: ['x',], value: undefined, },);
        },)
          .toThrow(TomlTypeError,);
      },
    },),
  ],
},);
