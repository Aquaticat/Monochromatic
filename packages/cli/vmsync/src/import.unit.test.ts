import {
  describe,
  expect,
  test,
} from 'bun:test';

import { nameFromPath, } from './import.ts';

//region nameFromPath -- derives VM names from image file paths

describe('nameFromPath', () => {
  test('strips file extension', () => {
    expect(nameFromPath('/tmp/alpine.qcow2',),).toBe('alpine',);
  });

  test('strips only the last extension', () => {
    expect(nameFromPath('/tmp/disk.backup.qcow2',),).toBe('disk-backup',);
  });

  test('replaces dots with hyphens', () => {
    expect(nameFromPath('/tmp/alpine-3.21-cloud.qcow2',),).toBe('alpine-3-21-cloud',);
  });

  test('uses only the basename, not directory parts', () => {
    expect(nameFromPath('/home/user/images/fedora.raw',),).toBe('fedora',);
  });

  test('replaces spaces with hyphens', () => {
    expect(nameFromPath('/tmp/my disk.qcow2',),).toBe('my-disk',);
  });

  test('preserves hyphens and underscores', () => {
    expect(nameFromPath('/tmp/my-vm_01.qcow2',),).toBe('my-vm_01',);
  });

  test('handles vhdx extension', () => {
    expect(nameFromPath('/data/windows.vhdx',),).toBe('windows',);
  });

  test('handles raw extension', () => {
    expect(nameFromPath('/data/disk.raw',),).toBe('disk',);
  });

  test('replaces consecutive special chars with hyphens', () => {
    expect(nameFromPath('/tmp/a@b#c.qcow2',),).toBe('a-b-c',);
  });
});

//endregion nameFromPath
