/**
 Phase 1 of the native wrapper's mutation campaign: plant known guard removals and require the named control to fail.

 A campaign whose harness cannot observe a missing guard proves nothing, so these controls run before cargo-mutants
 and any unnoticed removal stops the campaign.
 */
// The bin scripts sit outside the package tsconfig's include list, so type-aware lint checks them in an inferred
// program that loads no ambient Node types; this reference loads them, so `process` and `node:` imports stay typed
// in this file on its own instead of depending on a sibling module that carries the same reference.
/// <reference types="node" />
import {
  readFile,
  writeFile,
} from 'node:fs/promises';
import {
  join,
  resolve,
} from 'node:path';

import {
  createContainer,
  NativeVerificationError,
  runCommand,
} from './native-verification-process.mjs';

/** Source directory inside the tested image. */
const containerSource = '/work/package/git-policy/cli';

/**
 Guard removal paired with the test that must notice it.

 @typedef {{ name: string, file: string, from: string, to: string, failing: string }} PlantedControl
 */

/**
 Planted control plus what its container observed.

 @typedef {PlantedControl & { status: number | null, noticed: boolean }} PlantedControlResult
 */

/**
 Inputs every planted control shares.

 @typedef {{ base: string, limits: readonly string[], context: string, evidence: string }} PlantedControlSetting
 */

/**
 Guard removals with the control that must notice each one.
 `from` must occur exactly once in the current source, so a control cannot silently stop applying.

 @type {readonly PlantedControl[]}
 */
const plantedControls = [
  {
    name: 'self-exclusion by identity and content',
    file: 'src/native/real_git_candidate.rs',
    from: 'if same_file(candidate, own_executable) || identical_content(candidate, own_executable) {',
    to: 'if false {',
    failing: 'resolution::wrapper_never_selects_itself_or_a_copy_of_itself',
  },
  {
    name: 'forward-target marker check',
    file: 'src/native/entry.rs',
    from: '&& same_file(Path::new(&target), inputs.own_executable.as_path())',
    to: '&& false',
    failing: 'resolution::different_wrapper_build_stops_instead_of_looping',
  },
  {
    name: 'commit refusal frontier',
    file: 'src/native/refusal_frontier.rs',
    from: 'return Some(Unported::CommitTransaction);',
    to: 'return None;',
    failing: 'frontier::a_real_commit_is_refused',
  },
  {
    name: 'unknown top-level key rejection',
    file: 'src/native/config_parse.rs',
    from: 'return Err(unknown_top_level_key(key.as_str()));',
    to: 'continue;',
    failing: 'config_parse::tests::unknown_and_retired_top_level_keys_are_named',
  },
  {
    name: 'legacy configuration migration diagnostic',
    file: 'src/native/config_file.rs',
    from: 'return Err(migration_required(first.as_path(), source.as_path()));',
    to: 'let _ = first;',
    failing: 'config_file::tests::legacy_configuration_alone_requires_migration',
  },
  {
    name: 'git version minimum',
    file: 'src/native/git_version.rs',
    from: 'if version < MINIMUM_GIT_VERSION {',
    to: 'if false {',
    failing: 'git_version::tests::an_older_release_is_refused',
  },
  {
    name: 'PID file proof skips the holder scan',
    file: 'src/native/index_lock_evidence.rs',
    from: 'if let PidFile::Owner(pid, PidOwner::StartedBeforeLock(_)) = &pid_file {',
    to: 'if let PidFile::Owner(pid, PidOwner::Missing) = &pid_file {',
    failing: 'index_lock_evidence::tests::gathering_skips_the_scan_only_for_a_proven_live_owner',
  },
  {
    name: 'open descriptor precedence over the PID file',
    file: 'src/native/index_lock_evidence.rs',
    from: 'if let Some(scan) = &evidence.holders',
    to: 'if let Some(scan) = &None::<HolderEvidence>',
    failing: 'index_lock_evidence::tests::classification_prefers_a_descriptor_then_the_pid_file',
  },
  {
    name: 'coordinated Git does not inherit the landing lease',
    file: 'src/native/index_writer_forward.rs',
    from: 'child_overlay.push(coordination.lease.clone());',
    to: 'let _ = coordination.lease.clone();',
    failing: 'coordination::a_nested_git_add_inside_rebase_does_not_deadlock',
  },
  {
    name: 'a proven holder is polled without the poll cap',
    file: 'src/native/index_lock_wait.rs',
    from: 'effects.sleep(backoff_ms.min(cap));',
    to: 'effects.sleep(backoff_ms);',
    failing: 'index_lock_wait::tests::a_proven_pid_file_owner_is_waited_for_without_limit',
  },
  {
    name: 'evidence gathering is not counted toward the unproven budget',
    file: 'src/native/index_lock_wait.rs',
    from: 'state.unproven_ms += effects.now_ms() - iteration_started;',
    to: 'state.unproven_ms += 0.0;',
    failing: 'index_lock_wait::tests::gathering_evidence_counts_toward_the_budget',
  },
  {
    name: 'the Git version is not checked before an index writer locks',
    file: 'src/native/index_writer_coordination.rs',
    from: 'if let Err(reason) = version(input.context) {',
    to: 'if let Err(reason) = Ok::<crate::git_version::GitRelease, String>((2, 55, 0)) {',
    failing: 'index_writer_coordination::tests::an_older_git_refuses_an_index_writer_before_the_landing_lock',
  },
  {
    name: 'a replaced real index lock is released',
    file: 'src/native/real_index_lock.rs',
    from: '        self.assert_identity()?;\n        if let Err(error) = std::fs::remove_file(&self.lock_path) {',
    to: '        if let Err(error) = std::fs::remove_file(&self.lock_path) {',
    failing: 'real_index_lock::tests::a_replaced_lock_is_never_released',
  },
  {
    name: 'safe-integer bound on process start ticks',
    file: 'src/native/process_start.rs',
    from: 'if ticks > super::json_record::MAX_SAFE_INTEGER {',
    to: 'if ticks > i64::MAX {',
    failing: 'process_start::tests::a_start_tick_beyond_the_safe_integers_is_refused',
  },
  {
    name: 'manual-push confirmation refuses a remote ref changed after negotiation',
    file: 'src/native/manual_push_probe.rs',
    from: 'if authoritative.is_none() != advertised_absent {',
    to: 'if false {',
    failing: 'manual_push_probe::tests::confirmation_refuses_a_remote_ref_deleted_after_negotiation',
  },
  {
    name: 'single-flight joins a live push that covered the commit',
    file: 'src/native/auto_push_single_flight.rs',
    from: 'LastPushedRead::Absent => true,',
    to: 'LastPushedRead::Absent => false,',
    failing: 'auto_push_single_flight::tests::waits_for_a_live_pusher_and_reports_its_failed_push_when_it_covered_the_commit',
  },
  {
    name: 'post-commit gate blocks the backup on a blocking event',
    file: 'src/native/post_commit.rs',
    from: 'let blocked = pass_exit_code(events.as_slice(), end) != 0;',
    to: 'let blocked = false;',
    failing: 'post_commit::tests::a_blocked_landed_commit_ends_with_an_explicit_commit_landed_event',
  },
  {
    name: 'manual-push scope reads the final tree when no base is published',
    file: 'src/native/manual_push_range.rs',
    from: '    if published.is_empty() {',
    to: '    if published.is_empty() && false {',
    failing: 'manual_push_range::tests::an_unknown_base_scans_the_final_tree',
  },
];

/**
 Plant one guard removal in its own container and record whether the named control failed.

 @param {PlantedControlSetting & { control: PlantedControl, index: number }} request -
   shared inputs, the control, and its position, which names its planted source and log files
 @returns {Promise<PlantedControlResult>} control with its container's exit status and whether the named test failed
 */
async function runPlantedControl({
  base,
  limits,
  context,
  evidence,
  control,
  index,
}) {
  const original = await readFile(
    resolve(control.file),
    'utf8',
  );
  const occurrences = original.split(control.from)
    .length
    - 1;
  if (occurrences !== 1)
    throw new NativeVerificationError(
      `Planted control "${control.name}" matches ${String(occurrences)} times in ${control.file}; it must match exactly once.`,
    );
  const planted = join(
    context,
    `planted-${String(index)}.rs`,
  );
  await writeFile(
    planted,
    original.replace(
      control.from,
      control.to,
    ),
  );
  // Unit tests notice these removals first; `--no-fail-fast` keeps Cargo going so the named control also runs.
  await using container = await createContainer({
    args: [
      'create',
      ...limits,
      base,
      'cargo',
      'test',
      '--offline',
      '--locked',
      '--all-targets',
      '--no-fail-fast',
      '--',
      '--test-threads=2',
    ],
  });
  await runCommand({
    command: 'podman',
    args: [
      'cp',
      planted,
      `${container.id}:${containerSource}/${control.file}`,
    ],
    capture: true,
  });
  const run = await runCommand({
    command: 'podman',
    args: [
      'start',
      '--attach',
      container.id,
    ],
    capture: true,
    allowFailure: true,
  });
  const output = `${run.stdout}\n${run.stderr}`;
  const noticed = (run.status !== 0) && output.includes(`test ${control.failing} ... FAILED`);
  await writeFile(
    join(
      evidence,
      `planted-${String(index)}.log`,
    ),
    output,
  );
  console.log(`Planted control "${control.name}": ${noticed ? 'noticed' : 'NOT noticed'} by ${control.failing}`);
  const result = {
    ...control,
    status: run.status,
    noticed,
  };
  return result;
}

/**
 Planted-control results in table order. Each control starts only after the previous one returned and removed its
 container, so at most one bounded container runs at a time.

 @param {PlantedControlSetting} setting - inputs every planted control shares
 @returns {AsyncGenerator<PlantedControlResult>} one result per planted control
 */
async function* plantedControlResults(setting) {
  for (const [
    index,
    control,
  ] of plantedControls.entries()) {
    yield runPlantedControl({
      ...setting,
      control,
      index,
    });
  }
}

/**
 Plant each guard removal in its own container and require the named control to fail.
 The results file is written before any unnoticed removal throws, so a failing campaign keeps its evidence.

 @param {PlantedControlSetting} setting - tested image ID, container bounds, scratch and evidence directories
 */
export async function runPlantedControls(setting) {
  /** @type {PlantedControlResult[]} */
  const results = [];
  for await (const result of plantedControlResults(setting))
    results.push(result);
  await writeFile(
    join(
      setting.evidence,
      'planted-controls.json',
    ),
    `${JSON.stringify(
      results,
      null,
      2,
    )}\n`,
  );
  const unnoticed = results.filter(function isUnnoticed(result) {
    return !result.noticed;
  });
  if (unnoticed.length > 0)
    throw new NativeVerificationError(
      `Planted guard removals were not noticed: ${unnoticed.map(function controlName(result) {
        return result.name;
      })
        .join('; ')}. Mutation results cannot be trusted; inspect ${setting.evidence}.`,
    );
}
