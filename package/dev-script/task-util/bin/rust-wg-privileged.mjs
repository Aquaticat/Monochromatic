#!/usr/bin/env node
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { strict as assert } from 'node:assert';
import { root, owned, evidence, environment, run, rust, sourceAdmission, nextestConfig } from './rust-bounded-profile.mjs';

//region Admit the existing root-only test boundary inside owned namespaces of this single CI sandbox
assert.equal(process.env.RESEARCH_RUST_PROFILE, 'wg-privileged');
const finish = sourceAdmission(['package/cli/wg-quicker-exempt']);
environment.HOME = join(owned, 'home');
mkdirSync(environment.HOME, { recursive: true, mode: 0o700 });
delete environment.CARGO_BUILD_JOBS;
try {
  run('kernel', 'uname', ['--all']);
  run('namespace-help', 'unshare', ['--help']);
  run('mount-help', 'mount', ['--help']);
  run('network-help', 'ip', ['--help']);
  const project = join(root, 'package/cli/wg-quicker-exempt');
  rust('locked-dependency-preparation', ['cargo', 'fetch', '--locked'], { cwd: project });
  rust('owning-debug-cli-build', ['cargo', 'build', '--offline', '--locked'], { cwd: project });
  rust('privileged-nextest-build-only', ['cargo', 'nextest', 'run', '--offline', '--locked', '--no-run'], { cwd: project });
  const cargo = run('installed-cargo-path', 'mise', ['which', 'cargo']).stdout.trim();
  const nextest = run('installed-nextest-path', 'mise', ['which', 'cargo-nextest']).stdout.trim();
  const node = run('installed-node-path', 'mise', ['which', 'node']).stdout.trim();
  environment.PATH = [dirname(cargo), dirname(nextest), environment.PATH].join(':');
  const config = nextestConfig('wg-privileged');
  const variables = Object.entries(environment).filter(([key]) => ['PATH', 'HOME', 'TMPDIR', 'CARGO_HOME', 'CARGO_TARGET_DIR', 'CARGO_BUILD_JOBS', 'CARGO_INCREMENTAL', 'CARGO_PROFILE_DEV_DEBUG', 'RUSTUP_HOME'].includes(key)).map(([key, value]) => key + '=' + value);
  const result = run('owned-root-network-mount-cgroup-pid-namespaces', 'sudo', ['--non-interactive', 'unshare', '--mount', '--net', '--cgroup', '--pid', '--fork', '--kill-child', '--mount-proc', '--propagation', 'private', '--', '/usr/bin/env', ...variables, node, join(root, 'package/dev-script/task-util/bin/rust-wg-namespace.mjs'), project, evidence, cargo, config], { allowFailure: true });
  writeFileSync(join(evidence, 'privileged-boundary.json'), JSON.stringify({ owningTask: '//package/cli/wg-quicker-exempt:test:functional', adapter: 'Nextest selects the same ignored tests with default concurrency', admission: 'Private mount, network, cgroup and PID namespaces; new bpffs and cgroup2 mounts; loopback only; no user namespace', status: result.status }, null, 2) + '\n');
  assert.equal(result.status, 0, result.output.slice(-6000));
} finally { finish(); }
//endregion
