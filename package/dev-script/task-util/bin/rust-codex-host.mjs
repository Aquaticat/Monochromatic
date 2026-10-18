#!/usr/bin/env node
import { chmodSync, copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { strict as assert } from 'node:assert';
import { root, prefix, owned, evidence, environment, hash, run, rust, sourceAdmission, nextestConfig } from './rust-bounded-profile.mjs';

//region Exercise the existing installed-host fixture with a private home and deterministic local provider
assert.equal(process.env.RESEARCH_RUST_PROFILE, 'codex-host');
const finish = sourceAdmission(['package/codex-plugin/bash-limit']);
const manifest = JSON.parse(readFileSync(join(prefix, 'additional-tool-manifest.json')));
assert.equal(hash(readFileSync(manifest.tools.codex.path)), manifest.tools.codex.sha256);
environment.PATH = dirname(manifest.tools.codex.path) + ':' + environment.PATH;
const bridge = join(owned, 'bridge');
mkdirSync(bridge, { recursive: true, mode: 0o700 });
copyFileSync(join(root, 'package/dev-script/task-util/bin/rust-codex-protocol-tee.mjs'), join(bridge, 'codex'));
chmodSync(join(bridge, 'codex'), 0o700);
environment.RESEARCH_REAL_CODEX = manifest.tools.codex.path;
environment.RESEARCH_CODEX_PROTOCOL_DIRECTORY = join(evidence, 'protocol');
environment.PATH = bridge + ':' + environment.PATH;
environment.HOME = join(evidence, 'synthetic-home');
mkdirSync(join(environment.HOME, 'temp/agent'), { recursive: true, mode: 0o700 });
environment.CODEX_HOME = join(environment.HOME, '.codex');
delete environment.OPENAI_API_KEY;
delete environment.ANTHROPIC_API_KEY;
delete environment.CODEX_API_KEY;
delete environment.CODEX_BASH_LIMIT_HOST_FIXTURE;
try {
  // The official standalone Codex executable needs either an admitted system Bubblewrap or its bundled resource.
  run('owned-package-manager-help', 'apt-get', ['--help']);
  run('owned-package-index-refresh', 'sudo', ['--non-interactive', 'apt-get', 'update']);
  run('owned-bubblewrap-prerequisite-install', 'sudo', ['--non-interactive', 'apt-get', 'install', '--assume-yes', '--no-install-recommends', 'bubblewrap']);
  run('owned-bubblewrap-package-version', 'dpkg-query', ['--show', '--showformat=${binary:Package}\t${Version}\n', 'bubblewrap']);
  run('owned-bubblewrap-package-verification', 'dpkg', ['--verify', 'bubblewrap']);
  run('owned-bubblewrap-version', 'bwrap', ['--version']);
  run('owned-bubblewrap-help', 'bwrap', ['--help']);
  run('owned-bubblewrap-real-namespace-probe', 'bwrap', ['--unshare-user', '--unshare-pid', '--unshare-net', '--ro-bind', '/', '/', '--proc', '/proc', '--dev', '/dev', '--', '/usr/bin/true']);
  writeFileSync(join(evidence, 'system-bubblewrap.json'), JSON.stringify({ path:'/usr/bin/bwrap', sha256:hash(readFileSync('/usr/bin/bwrap')), installationBoundary:'This disposable CI sandbox only; no account settings or prepared image tag changed' }, null,2) + '\n');
  run('official-host-version', manifest.tools.codex.path, ['--version']);
  run('official-host-help', manifest.tools.codex.path, ['--no-daemon', 'app-server', '--help']);
  const project = join(root, 'package/codex-plugin/bash-limit');
  rust('locked-dependency-preparation', ['cargo', 'fetch', '--locked'], { cwd: project });
  const result = rust('existing-installed-host-fixture', ['cargo', 'nextest', '--config-file', nextestConfig('codex-host'), 'run', '--locked', '--offline', '--release', '--test', 'native_host', '--run-ignored', 'only', '--success-output', 'final'], { cwd: project, allowFailure: true });
  writeFileSync(join(evidence, 'installed-host-boundary.json'), JSON.stringify({ codex: manifest.tools.codex, owningTask: '//package/codex-plugin/bash-limit:test:host', localDeterministicProvider: 'tests/host_support/server.rs', expectedHookCompletions: 40, paidProviderCallsAuthorized: false, privateHome: environment.HOME, nextestStatus: result.status, durationEvidencePresent: result.output.includes('native host hook milliseconds:') }, null, 2) + '\n');
  assert.equal(result.status, 0, result.output.slice(-6000));
  assert(result.output.includes('native host hook milliseconds:'));
} finally { finish(); }
//endregion
