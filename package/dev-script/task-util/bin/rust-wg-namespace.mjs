#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { openSync, closeSync, readFileSync, writeFileSync, mkdirSync, readdirSync, rmdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { strict as assert } from 'node:assert';

//region Probe and exercise privileged fixtures only after namespace isolation succeeds
const [project, evidence, cargo, config] = process.argv.slice(2);
assert.equal(process.getuid(), 0);
const records = [];
function command(name, executable, args, allowFailure = false) {
  const fd = openSync(join(evidence, name + '.log'), 'w', 0o600);
  let result;
  try { result = spawnSync(executable, args, { cwd: project, stdio: ['ignore', fd, fd] }); }
  finally { closeSync(fd); }
  records.push({ name, command: [executable, ...args], status: result.status, signal: result.signal, error: result.error?.message });
  writeFileSync(join(evidence, 'namespace-commands.json'), JSON.stringify(records, null, 2) + '\n');
  if (result.error) throw result.error;
  if (!allowFailure) assert.equal(result.status, 0, readFileSync(join(evidence, name + '.log'), 'utf8'));
  return result.status;
}
function cgroups() {
  const result = [];
  const pending = ['/sys/fs/cgroup'];
  while (pending.length) {
    const parent = pending.pop();
    assert(result.length < 4096, 'Unexpected cgroup inventory scope');
    for (const entry of readdirSync(parent, { withFileTypes: true })) if (entry.isDirectory()) {
      const path = join(parent, entry.name);
      result.push(path);
      pending.push(path);
    }
  }
  return result.sort();
}
writeFileSync(join(evidence, 'namespace-status.txt'), readFileSync('/proc/self/status'));
command('private-cgroup2-mount', 'mount', ['--types', 'cgroup2', 'none', '/sys/fs/cgroup']);
mkdirSync('/sys/fs/bpf', { recursive: true });
command('private-bpffs-mount', 'mount', ['--types', 'bpf', 'bpf', '/sys/fs/bpf']);
command('private-loopback-up', 'ip', ['link', 'set', 'dev', 'lo', 'up']);
writeFileSync(join(evidence, 'namespace-mountinfo.txt'), readFileSync('/proc/self/mountinfo'));
command('private-loopback-addresses', 'ip', ['address', 'show', 'dev', 'lo']);
const before = cgroups();
writeFileSync(join(evidence, 'cgroups-before.json'), JSON.stringify(before, null, 2) + '\n');
let status;
try {
  status = command('actual-privileged-nextest', cargo, ['nextest', '--config-file', config, 'run', '--offline', '--locked', '--run-ignored', 'only', '--no-fail-fast', '--success-output', 'final'], true);
} finally {
  const remaining = cgroups().filter(path => !before.includes(path));
  writeFileSync(join(evidence, 'cgroups-after-tests.json'), JSON.stringify(remaining, null, 2) + '\n');
  const binary = join(process.env.CARGO_TARGET_DIR, 'debug/wg-quicker-exempt');
  for (const path of remaining.filter(path => /\/wg-quicker-exempt-[^/]+$/u.test(path))) command('cleanup-detach-' + path.split('/').at(-1), binary, ['detach', path], true);
  for (const path of remaining.sort((left, right) => right.length - left.length)) {
    assert(path.startsWith('/sys/fs/cgroup/wg-quicker-exempt-') || path.startsWith('/sys/fs/cgroup/user.slice/user-3') || path === '/sys/fs/cgroup/user.slice', path);
    if (statSync(path, { throwIfNoEntry: false })) rmdirSync(path);
  }
  const leaked = cgroups().filter(path => !before.includes(path));
  writeFileSync(join(evidence, 'cgroups-after-cleanup.json'), JSON.stringify(leaked, null, 2) + '\n');
  assert.equal(leaked.length, 0);
  command('unmount-owned-bpffs', 'umount', ['/sys/fs/bpf']);
  command('unmount-owned-cgroup2', 'umount', ['/sys/fs/cgroup']);
}
assert.equal(status, 0, 'Existing privileged tests failed; retained JUnit and native output distinguish product assertions from prerequisites');
//endregion
