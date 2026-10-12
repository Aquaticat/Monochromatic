import {
  mkdir,
  mkdtempDisposable,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  parseWrapperKind,
  verifyWrapperExecutable,
  WRAPPER_BINS,
  WrapperSelectionError,
} from './wrapper-selection-fixture.ts';

await describe({
  name: parseWrapperKind.name,
  children: [
    it({
      name: 'selects the incumbent for an empty value so runs without the variable keep their meaning',
      fn: async () => {
        expect(parseWrapperKind('',),).toBe('incumbent',);
      },
    },),
    it({
      name: 'selects the incumbent by name',
      fn: async () => {
        expect(parseWrapperKind('incumbent',),).toBe('incumbent',);
      },
    },),
    it({
      name: 'selects the native executable by name',
      fn: async () => {
        expect(parseWrapperKind('native',),).toBe('native',);
      },
    },),
    it({
      name: 'rejects other values instead of falling back to the incumbent',
      fn: async () => {
        expect(function wrongCase() {
          return parseWrapperKind('Native',);
        },).toThrow(WrapperSelectionError,);
        expect(function unknown() {
          return parseWrapperKind('shell',);
        },).toThrow(WrapperSelectionError,);
      },
    },),
    it({
      name: 'maps each kind to its own directory',
      fn: async () => {
        expect(WRAPPER_BINS.incumbent,).toBe('/opt/cli-git/node_modules/.bin',);
        expect(WRAPPER_BINS.native,).toBe('/opt/native/bin',);
      },
    },),
  ],
},);

await describe({
  name: verifyWrapperExecutable.name,
  children: [
    it({
      name: 'accepts an ELF git as native and a script git as incumbent, and rejects each as the other kind',
      fn: async () => {
        /**
         Disposable directory holding one fake `git` per kind.
         */
        await using root = await mkdtempDisposable(join(tmpdir(), 'wrapper-selection-',),);
        const elf = join(root.path, 'elf',);
        const script = join(root.path, 'script',);
        await Promise.all([elf, script,].map(async function prepare(directory,) {
          await mkdir(directory,);
        },),);
        await writeFile(join(elf, 'git',), Buffer.from('\u007FELF\u0000\u0000', 'latin1',),);
        await writeFile(join(script, 'git',), '#!/usr/bin/env node\n',);
        expect(await verifyWrapperExecutable({ kind: 'native', bin: elf, },),)
          .toBe(`wrapper=native ${join(elf, 'git',)} (ELF executable)`,);
        expect(await verifyWrapperExecutable({ kind: 'incumbent', bin: script, },),)
          .toBe(`wrapper=incumbent ${join(script, 'git',)} (Node script)`,);
        await expect(verifyWrapperExecutable({ kind: 'native', bin: script, },),)
          .rejects.toThrow(WrapperSelectionError,);
        await expect(verifyWrapperExecutable({ kind: 'incumbent', bin: elf, },),)
          .rejects.toThrow(WrapperSelectionError,);
        await expect(verifyWrapperExecutable({ kind: 'native', bin: join(root.path, 'absent',), },),)
          .rejects.toThrow(WrapperSelectionError,);
      },
    },),
  ],
},);
