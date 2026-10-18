import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, copyFileSync, cpSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { strict as assert } from 'node:assert';

//region Bake only admitted firstparty executables, runtime libraries and owned corpus copies
export function prepareRuntime({ binaries, corpora, dictionary, directory, image, run }) {
  const rootfs = join(directory, 'rootfs');
  mkdirSync(join(rootfs, 'fuzz'), { recursive: true });
  mkdirSync(join(rootfs, 'work/corpus'), { recursive: true });
  mkdirSync(join(rootfs, 'work/artifacts'), { recursive: true });
  mkdirSync(join(rootfs, 'tmp'), { recursive: true });
  chmodSync(join(rootfs, 'tmp'), 0o1777);
  const libraries = new Set();
  for (const binary of binaries) {
    copyFileSync(binary.path, join(rootfs, 'fuzz', binary.name));
    chmodSync(join(rootfs, 'fuzz', binary.name), 0o755);
    const output = run('runtime-libraries-' + binary.name, 'ldd', [binary.path]).output;
    assert(!output.includes('not found'));
    for (const match of output.matchAll(/(?:=>\s*)?(\/[^\s()]+)/gu)) libraries.add(match[1]);
  }
  for (const path of libraries) {
    const destination = join(rootfs, path);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(path, destination);
  }
  for (const [target, files] of Object.entries(corpora)) {
    const corpus = join(rootfs, 'work/corpus', target);
    mkdirSync(corpus, { recursive: true });
    for (const [index, path] of files.entries()) copyFileSync(path, join(corpus, String(index).padStart(4, '0') + '-' + path.split('/').at(-1)));
  }
  if (dictionary) copyFileSync(dictionary, join(rootfs, 'dictionary'));
  const definition = 'FROM scratch\nCOPY --chown=1000:1000 rootfs/ /\nUSER1000:1000\nWORKDIR /work\n';
  writeFileSync(join(directory, 'Containerfile'), definition.replace('USER1000', 'USER1000'.replace('USER', 'USER ')));
  run('runtime-image-build', 'sudo', ['--non-interactive', 'podman', 'build', '--network=none', '--http-proxy=false', '--pull=never', '--memory=2g', '--cpu-period=100000', '--cpu-quota=200000', '--tag', image, directory]);
  return { image, rootfs, libraryFiles: [...libraries].map(path => ({ path, bytes: statSync(path).size, sha256: createHash('sha256').update(readFileSync(path)).digest('hex') })) };
}

export function runRuntime({ name, image, executable, args, directory, run, expectedAsanFailure = false, workingDirectory = '/work', maximumSeconds }) {
  const created = run(name + '-create', 'sudo', ['--non-interactive', 'podman', 'create', '--network=none', '--http-proxy=false', '--memory=2g', '--cpus=2', '--pids-limit=128', '--cap-drop=all', '--user=1000:1000', '--workdir=' + workingDirectory, ...(maximumSeconds ? ['--timeout=' + maximumSeconds] : []), '--entrypoint=/fuzz/' + executable, image, ...args]);
  const id = created.output.trim();
  assert(/^[a-f0-9]{64}$/u.test(id));
  let outcome;
  try {
    const started = run(name + '-run', 'sudo', ['--non-interactive', 'podman', 'start', '--attach', id], { allowFailure: true });
    const state = JSON.parse(run(name + '-state', 'sudo', ['--non-interactive', 'podman', 'inspect', '--format', '{{json .State}}', id]).output);
    const destination = join(directory, name);
    mkdirSync(destination, { recursive: true });
    run(name + '-retain-owned-corpus', 'sudo', ['--non-interactive', 'podman', 'cp', id + ':/work/.', destination]);
    const files = [];
    const pending = [destination];
    while (pending.length) {
      const parent = pending.pop();
      for (const entry of readdirSync(parent, { withFileTypes: true })) {
        const path = join(parent, entry.name);
        if (entry.isDirectory()) pending.push(path);
        else if (entry.isFile()) files.push({ path: path.slice(destination.length + 1), bytes: statSync(path).size, sha256: createHash('sha256').update(readFileSync(path)).digest('hex') });
        else throw new Error('Unexpected runtime corpus entry: ' + path);
      }
    }
    outcome = { id, image, executable, args, status: started.status, state, files, corpusCopiedTo: destination, noHostMounts: true, network: 'none', cpus: 2, memoryBytes: 2 * 1024 ** 3, pidsLimit: 128, workingDirectory, maximumSeconds };
    if (expectedAsanFailure) {
      assert.notEqual(started.status, 0);
      assert(started.output.includes('AddressSanitizer: stack-buffer-overflow'), started.output.slice(-3000));
      outcome.expectedAddressSanitizerFailureObserved = true;
    } else {
      outcome.executedUnits = Number(/stat::number_of_executed_units:\s*(\d+)/u.exec(started.output)?.[1] ?? 0);
      outcome.finished = started.output.includes('Done') && outcome.executedUnits > 0;
    }
    return outcome;
  } finally {
    run(name + '-remove-owned-container', 'sudo', ['--non-interactive', 'podman', 'rm', id], { allowFailure: true });
  }
}
//endregion
