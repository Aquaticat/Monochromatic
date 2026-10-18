#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { strict as assert } from 'node:assert';
import { root, frozen, owned, evidence, environment, profile, hash, run, rust, sourceAdmission, nextestConfig } from './rust-bounded-profile.mjs';
import { prepareRuntime, runRuntime } from './rust-fuzz-runtime.mjs';

//region Admit actual declared targets and immutable seed files independently of runtime output
const groups = {
  'fuzz-small': ['package/rust-module/jsonc-edit.fuzz', 'package/rust-module/forbidden-regex.fuzz', 'package/cli/forbidden-strings.fuzz'],
  'fuzz-git': ['package/git-policy/cli.fuzz'],
  'fuzz-linter': ['package/linter/monochromatic-lint.fuzz'],
};
const selected = groups[profile];
assert(selected);
const paths = ['package/cli/forbidden-strings', 'package/cli/forbidden-strings.fuzz', 'package/git-policy/cli', 'package/git-policy/cli.fuzz', 'package/linter/monochromatic-lint', 'package/linter/monochromatic-lint.fuzz', 'package/rust-module/jsonc-edit', 'package/rust-module/jsonc-edit.fuzz', 'package/rust-module/forbidden-regex', 'package/rust-module/forbidden-regex.fuzz'];
const finish = sourceAdmission(paths);
const tracked = execFileSync('git', ['ls-tree', '--full-tree', '--name-only', '-r', frozen, '--', ...paths], { cwd: root, encoding: 'utf8' }).trim().split('\n');
const seedPaths = tracked.filter(path => /\/(?:seed|seeds|corpus)\//u.test(path));
writeFileSync(join(evidence, 'seed-admission.json'), JSON.stringify(seedPaths.map(path => ({ path, bytes: statSync(join(root, path)).size, sha256: hash(readFileSync(join(root, path))) })), null, 2) + '\n');
const outcomes = [];
let failed = false;
try {
  rust('cargo-fuzz-build-help', ['cargo', 'fuzz', 'build', '--help']);
  rust('compiler-version', ['rustc', '--version', '--verbose']);
  run('podman-run-help', 'sudo', ['--non-interactive', 'podman', 'run', '--help']);
  const control = join(owned, 'asan-control');
  const controlSource = join(root, 'package/dev-script/task-util/bin/rust-asan-control.rs');
  rust('asan-positive-control-build', ['rustc', '--edition=2024', '--target', 'x86_64-unknown-linux-gnu', '-Zsanitizer=address', '-Cunsafe-allow-abi-mismatch=sanitizer', '-O', '-g', controlSource, '-o', control]);
  const controlRuntime = prepareRuntime({ binaries: [{ name: 'asan-control', path: control }], corpora: {}, directory: join(owned, 'control-runtime'), image: 'localhost/rust-research-asan-control:' + profile, run });
  const observedControl = runRuntime({ name: 'asan-positive-control', image: controlRuntime.image, executable: 'asan-control', args: [], directory: join(evidence, 'runtime'), run, expectedAsanFailure: true });
  writeFileSync(join(evidence, 'asan-positive-control.json'), JSON.stringify({ source: { rustCommit: '5d8fec0669a64607db9ccbf663e7c23125bf4748', upstreamPath: 'tests/ui/sanitizer/address.rs', sha256: hash(readFileSync(controlSource)) }, observedControl }, null, 2) + '\n');
  //endregion

  //region Run each package independently so one product finding does not hide a later target
  for (const [index, path] of selected.entries()) {
    const key = path.replaceAll('/', '-');
    const project = join(root, path);
    const output = join(owned, 'build', key);
    environment.CARGO_TARGET_DIR = output;
    try {
      rust(key + '-locked-dependency-preparation', ['cargo', 'fetch', '--locked'], { cwd: project });
      environment.CARGO_NET_OFFLINE = 'true';
      const list = rust(key + '-actual-target-list', ['cargo', 'fuzz', 'list', '--fuzz-dir', '.'], { cwd: project }).output.trim().split('\n');
      const targetFiles = tracked.filter(file => file.startsWith(path + '/fuzz_targets/') && file.endsWith('.rs'));
      const declared = targetFiles.map(file => file.split('/').at(-1).slice(0, -3)).sort();
      assert.deepEqual([...list].sort(), declared);
      writeFileSync(join(evidence, key + '-target-sources.json'), JSON.stringify(targetFiles.map(file => ({ path: file, sha256: hash(readFileSync(join(root, file))), text: readFileSync(join(root, file), 'utf8') })), null, 2) + '\n');
      const controls = rust(key + '-generator-nextest', ['cargo', 'nextest', '--config-file', nextestConfig(key), 'run', '--locked', '--offline', '--lib', '--release', '--no-fail-fast'], { cwd: project, allowFailure: true });
      failed = controls.status !== 0 || failed;
      const built = rust(key + '-asan-gnu-build', ['cargo', 'fuzz', 'build', '--fuzz-dir', '.', '--sanitizer', 'address', '--target', 'x86_64-unknown-linux-gnu', '--target-dir', output], { cwd: project, allowFailure: true });
      if (built.status !== 0) { failed = true; outcomes.push({ path, boundary: 'instrumented-build', status: built.status }); continue; }
      const binaries = list.map(name => ({ name, path: join(output, 'x86_64-unknown-linux-gnu/release', name) }));
      const corpora = Object.fromEntries(list.map(target => [target, seedPaths.filter(seed => seed.startsWith(path + '/') && seed.split('/').at(-2) === target).map(seed => join(root, seed))]));
      const runtimeDirectory = join(owned, 'runtime-' + index);
      const dictionaryDirectory = join(project, 'dictionary');
      const dictionaries = tracked.filter(file => dirname(file) === path + '/dictionary');
      // Each target gets the owning dictionary, retained as data in its own mount-free image.
      for (const binary of binaries) {
        const named = dictionaries.find(file => file.endsWith('/' + binary.name + '.dict'));
        const generic = path.includes('git-policy') && ['global_arguments', 'config_loading'].includes(binary.name) ? join(dictionaryDirectory, 'arguments.dict') : dictionaries.length === 1 ? join(root, dictionaries[0]) : undefined;
        const dictionary = named ? join(root, named) : generic;
        assert(!path.includes('git-policy') || dictionary, binary.name + ' dictionary must match owner');
        const runtime = prepareRuntime({ binaries: [binary], corpora: { [binary.name]: corpora[binary.name] }, dictionary, directory: join(runtimeDirectory, binary.name), image: 'localhost/rust-research-fuzz-' + index + '-' + binary.name + ':' + profile, run: (name, command, args, options) => run(key + '-' + binary.name + '-' + name, command, args, options) });
        const result = runRuntime({ name: key + '-' + binary.name, image: runtime.image, executable: binary.name, args: ['/work/corpus/' + binary.name, '-max_total_time=30', '-max_len=4096', '-rss_limit_mb=1536', '-timeout=5', '-print_final_stats=1', '-artifact_prefix=/work/artifacts/', ...(dictionary ? ['-dict=/dictionary'] : [])], directory: join(evidence, 'runtime'), run });
        const outcome = { path, target: binary.name, binarySha256: hash(readFileSync(binary.path)), seedCount: corpora[binary.name].length, dictionary: dictionary ? { path: dictionary, sha256: hash(readFileSync(dictionary)) } : null, runtime, ...result };
        outcomes.push(outcome);
        failed = result.status !== 0 || !result.finished || failed;
        writeFileSync(join(evidence, 'fuzz-outcomes.json'), JSON.stringify({ outcomes, failed }, null, 2) + '\n');
      }
    } catch (error) {
      failed = true;
      outcomes.push({ path, error: error.stack });
      writeFileSync(join(evidence, 'fuzz-outcomes.json'), JSON.stringify({ outcomes, failed }, null, 2) + '\n');
      console.log(JSON.stringify({ path, error: error.message }));
    } finally { delete environment.CARGO_NET_OFFLINE; }
  }
  //endregion
} finally { finish(); }
assert(!failed, 'Retained fuzz/generator failures must remain visible.');
