#!/usr/bin/env node
import { chmodSync, lstatSync, mkdirSync, readFileSync, readdirSync, statfsSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function fields(path) {
  const stat = lstatSync(path, { bigint: true });
  return { path, device: stat.dev.toString(), inode: stat.ino.toString(), mode: stat.mode.toString(), size: stat.size.toString(), ctimeNanoseconds: stat.ctimeNs.toString(), ctimeMilliseconds: (stat.ctimeNs / 1000000n).toString(), ctimeSubsecondNanoseconds: (stat.ctimeNs % 1000000000n).toString(), mtimeNanoseconds: stat.mtimeNs.toString() };
}

export function filesystem(path) {
  const stat = statfsSync(path, { bigint: true });
  return { path, type: stat.type.toString(), blockSize: stat.bsize.toString(), blockCount: stat.blocks.toString(), mountLines: readFileSync('/proc/self/mountinfo', 'utf8').split('\n').filter(line => line.includes(' ' + path + ' ')) };
}

export function replacementAndClockProbe(directory) {
  mkdirSync(directory, { recursive: true });
  const replacements = [];
  for (let attempt = 0; attempt < 64; attempt += 1) {
    const path = join(directory, 'replacement-' + attempt + '.lock');
    writeFileSync(path, '', { flag: 'wx', mode: 0o600 });
    const before = fields(path);
    unlinkSync(path);
    writeFileSync(path, "another process's lock", { flag: 'wx', mode: 0o600 });
    const after = fields(path);
    replacements.push({ before, after, sameDeviceAndInode: before.device === after.device && before.inode === after.inode });
  }
  const path = join(directory, 'clock.lock');
  writeFileSync(path, 'x', { flag: 'wx', mode: 0o600 });
  const clock = [];
  for (let attempt = 0; attempt < 50; attempt += 1) {
    chmodSync(path, attempt % 2 === 0 ? 0o600 : 0o640);
    clock.push(fields(path));
  }
  return { filesystem: filesystem(directory), replacements, reusedDeviceInodeCount: replacements.filter(item => item.sameDeviceAndInode).length, clock, observedNonzeroMillisecondFraction: clock.some(item => BigInt(item.ctimeSubsecondNanoseconds) / 1000000n !== 0n), interpretation: 'Source-derived filesystem observations only. The native lock identity compares file/device/inode; metadata evidence separately rounds ctime. These probes do not establish a provider defect or a source remedy.' };
}

export function residualFixtureFields(directory) {
  const rows = [];
  const pending = [{ path: directory, depth: 0 }];
  while (pending.length && rows.length < 2000) {
    const item = pending.pop();
    for (const entry of readdirSync(item.path, { withFileTypes: true })) {
      const path = join(item.path, entry.name);
      if (entry.isDirectory() && item.depth < 8) pending.push({ path, depth: item.depth + 1 });
      if (!entry.isDirectory()) rows.push(fields(path));
    }
  }
  return { entries: rows, boundedTo: 2000, traversalRemaining: pending.length };
}
