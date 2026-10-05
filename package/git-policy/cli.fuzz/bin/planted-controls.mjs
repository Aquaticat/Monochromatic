#!/usr/bin/env node
/**
 * Positive controls for the fuzz invariants.
 * Plants one defect at a time in a disposable copy of the subject and requires the generator controls,
 * which call the same invariant functions as the fuzz targets, to fail.
 * The worktree is only read; every edit and build happens under the operating system's temporary directory.
 */
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/** Preserve the failed verification boundary rather than masking it with a cleanup error. */
class PlantedControlError extends Error {}

/** Repository-relative inputs the helper library needs to build. */
const inputs = [
  'package/git-policy/cli/Cargo.toml',
  'package/git-policy/cli/Cargo.lock',
  'package/git-policy/cli/README.md',
  'package/git-policy/cli/src/native',
  'package/git-policy/cli.fuzz/Cargo.toml',
  'package/git-policy/cli.fuzz/Cargo.lock',
  'package/git-policy/cli.fuzz/src',
  'package/git-policy/cli.fuzz/fuzz_targets',
  'package/rust-module/jsonc-edit/Cargo.toml',
  'package/rust-module/jsonc-edit/Cargo.lock',
  'package/rust-module/jsonc-edit/src',
  'package/rust-module/jsonc-edit/fixtures',
  // The subject links the scanner; `build.rs` and `data` hold the embedded baseline its library compiles in.
  'package/cli/forbidden-strings/Cargo.toml',
  'package/cli/forbidden-strings/Cargo.lock',
  'package/cli/forbidden-strings/build.rs',
  'package/cli/forbidden-strings/src',
  'package/cli/forbidden-strings/data',
  'package/rust-module/forbidden-regex/Cargo.toml',
  'package/rust-module/forbidden-regex/Cargo.lock',
  'package/rust-module/forbidden-regex/src',
];

/**
 * Defects with observable behavior, one per invariant family.
 * Each `from` must occur exactly once so a control cannot silently stop applying.
 * Removing a flag from a mutation list alone changes nothing, because unlisted flags already
 * require configuration; the first plant therefore also lists the flag as presentation.
 */
const plants = [
  {
    name: 'branch -d is treated as a presentation letter',
    file: 'package/git-policy/cli/src/native/config_loading.rs',
    edits: [
      { from: 'b"cCdDfmMut"', to: 'b"cCDfmMut"' },
      { from: 'b"vqrai"', to: 'b"vqraid"' },
    ],
  },
  {
    name: 'a bare git skips configuration',
    file: 'package/git-policy/cli/src/native/config_loading.rs',
    edits: [{
      from: 'if layout.outcome == GlobalOutcome::NoCommand {\n        return ConfigLoading::Required;',
      to: 'if layout.outcome == GlobalOutcome::NoCommand {\n        return ConfigLoading::Skip;',
    }],
  },
  {
    name: 'a separated global value is not consumed',
    file: 'package/git-policy/cli/src/native/global_arguments.rs',
    edits: [{ from: 'index += 2;', to: 'index += 1;' }],
  },
  {
    name: 'warn is read as error',
    file: 'package/git-policy/cli/src/native/policy_registry.rs',
    edits: [{
      from: 'if name == "warn" {\n        return Some(Severity::Warn);',
      to: 'if name == "warn" {\n        return Some(Severity::Error);',
    }],
  },
  {
    name: 'the landing section is rejected as unknown',
    file: 'package/git-policy/cli/src/native/config_parse.rs',
    edits: [{
      from: 'key == "hooks" || key == "indexLock" || key == "landing"',
      to: 'key == "hooks" || key == "indexLock"',
    }],
  },
  {
    name: 'object content past its declared size is accepted',
    file: 'package/git-policy/cli/src/native/candidate_batch.rs',
    edits: [{ from: "if terminator[0] != b'\\n' {", to: 'if false {' }],
  },
  {
    name: 'an object reply for another object is accepted',
    file: 'package/git-policy/cli/src/native/candidate_batch.rs',
    edits: [{
      from: 'if requested.is_some() && requested.as_ref() != Some(&object) {',
      to: 'if false {',
    }],
  },
];

/** Run the generator controls in the disposable sidecar; report status and the failing control names. */
function controls({ root }) {
  const run = spawnSync('cargo', ['test', '--lib', '--offline', '--locked', '--', '--test-threads=2'], {
    cwd: join(root, 'package/git-policy/cli.fuzz'),
    encoding: 'utf8',
    env: { ...process.env, CARGO_TARGET_DIR: join(root, 'target') },
    maxBuffer: 16 * 1024 * 1024,
  });
  if (run.error)
    throw new PlantedControlError('cargo could not start.', { cause: run.error });
  const output = `${run.stdout}\n${run.stderr}`;
  return {
    status: run.status,
    failed: [...output.matchAll(/^test (\S+) \.\.\. FAILED$/gmu)].map(match => match[1]),
    passed: [...output.matchAll(/^test (\S+) \.\.\. ok$/gmu)].length,
    output,
  };
}

/** Apply one plant's edits to its file text, refusing an edit that does not match exactly once. */
function planted({ plant, original }) {
  let text = original;
  for (const edit of plant.edits) {
    const occurrences = text.split(edit.from).length - 1;
    if (occurrences !== 1)
      throw new PlantedControlError(`Planted control "${plant.name}" matches ${occurrences} times in ${plant.file}; it must match exactly once.`);
    text = text.replace(edit.from, edit.to);
  }
  return text;
}

/** Copy the inputs, prove the unplanted controls pass, then require every plant to fail a control. */
async function main() {
  const repository = resolve(import.meta.dirname, '../../../..');
  const root = await mkdtemp(join(tmpdir(), 'cli-git-fuzz-planted-'));
  const evidenceRoot = join(process.cwd(), 'target', 'verification');
  await mkdir(evidenceRoot, { recursive: true });
  const evidence = await mkdtemp(join(evidenceRoot, 'planted-'));
  try {
    for (const input of inputs)
      await cp(join(repository, input), join(root, input), { recursive: true });
    const baseline = controls({ root });
    if (baseline.status !== 0 || baseline.passed === 0) {
      await writeFile(join(evidence, 'baseline.log'), baseline.output);
      throw new PlantedControlError(`Unplanted generator controls did not pass; inspect ${evidence}.`);
    }
    console.log(`Unplanted controls: ${baseline.passed} passed`);
    const results = [];
    for (const plant of plants) {
      const path = join(root, plant.file);
      const original = await readFile(path, 'utf8');
      await writeFile(path, planted({ plant, original }));
      const run = controls({ root });
      await writeFile(path, original);
      // A compile error is not an observation: the plant must build and a named control must fail.
      const noticed = run.status !== 0 && run.failed.length > 0;
      results.push({ name: plant.name, file: plant.file, edits: plant.edits, status: run.status, failed: run.failed, noticed });
      await writeFile(join(evidence, `planted-${results.length - 1}.log`), run.output);
      console.log(`Planted defect "${plant.name}": ${noticed ? `noticed by ${run.failed.join(', ')}` : 'NOT noticed'}`);
    }
    await writeFile(join(evidence, 'results.json'), JSON.stringify({ baselinePassed: baseline.passed, results }, null, 2) + '\n');
    console.log(`Planted-control evidence: ${evidence}`);
    const unnoticed = results.filter(result => !result.noticed);
    if (unnoticed.length > 0)
      throw new PlantedControlError(`Planted defects were not noticed: ${unnoticed.map(result => result.name).join('; ')}.`);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

await main();
