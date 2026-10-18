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
    name: "post-commit disabled event runs nothing",
    file: "src/native/post_commit_hook.rs",
    from: "    if request.plan.disabled_events.iter().any(|name| {",
    to: "    if false && request.plan.disabled_events.iter().any(|name| {",
    failing: "post_commit_hook::tests::disabled_post_commit_runs_nothing",
  },
  {
    name: "post-commit runs under the hook lock",
    file: "src/native/post_commit_hook.rs",
    from: "    let lock: Option<OwnerLock> = if request.plan.skip_hook_lock {",
    to: "    let lock: Option<OwnerLock> = if true {",
    failing: "post_commit_hook::tests::hook_runs_under_the_lock_with_the_native_environment",
  },
  {
    name: "a failed copy stops post-landing before disposal",
    file: "src/native/post_landing.rs",
    from: "    .map_err(PostLandingError::Install)?;",
    to: "    .map_err(PostLandingError::Install).ok().unwrap_or_default();",
    failing: "post_landing::tests::an_install_failure_keeps_the_shadow_and_the_directory",
  },
  {
    name: "a failed shadow removal stops disposal",
    file: "src/native/landed_disposal.rs",
    from: "    remove_shadow_repository(paths.shadow)?;",
    to: "    let _ = remove_shadow_repository(paths.shadow);",
    failing: "landed_disposal::tests::a_failed_shadow_removal_keeps_the_directory_and_the_records",
  },
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
    name: 'dry-run commit classification',
    file: 'src/native/wrapped_command.rs',
    from: 'if region.dry_run {',
    to: 'if false {',
    failing: 'commit::a_dry_run_commits_nothing',
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
    failing: 'index_lock_wait::tests::a_proven_pid_file_owner_is_waited_for_beyond_the_unproven_budget',
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
    name: 'hook entry recognized outside a transaction',
    file: 'src/native/hook_dispatch.rs',
    from: '    if transaction.parent()?.file_name()? != TRANSACTION_ROOT_NAME {',
    to: '    if false {',
    failing: 'hook_dispatch::tests::every_other_start_name_is_not_a_dispatch',
  },
  {
    name: 'disabled events still start Git',
    file: 'src/native/hook_dispatch.rs',
    from: '    if plan.disabled_events.iter().any(|name| { return name == target.event; }) {',
    to: '    if false {',
    failing: 'hook_dispatch::tests::a_disabled_event_succeeds_without_starting_git',
  },
  {
    name: 'hook lock skip flag ignored',
    file: 'src/native/hook_dispatch.rs',
    from: '    let lock: Option<OwnerLock> = if plan.skip_hook_lock {',
    to: '    let lock: Option<OwnerLock> = if false {',
    failing: 'hook::two_dispatches_overlap_with_concurrent_commits',
  },
  {
    name: 'hook status not propagated',
    file: 'src/native/hook_dispatch.rs',
    from: '    return finished.code().unwrap_or(1);',
    to: '    return finished.code().unwrap_or(1).min(1);',
    failing: 'hook::a_failing_hook_propagates_its_status',
  },
  {
    name: 'stale config parameters kept',
    file: 'src/native/hook_dispatch.rs',
    from: '        let overridden: bool = name == CONFIG_PARAMETERS_VARIABLE',
    to: '        let overridden: bool = name == WORK_TREE_VARIABLE',
    failing: 'hook_dispatch::tests::the_dispatched_environment_carries_the_plan',
  },
  {
    name: 'concurrent commits do not skip the hook lock',
    file: 'src/native/hook_dispatch_plan.rs',
    from: 'skip_hook_lock: inputs.concurrent_commits || inputs.inherited_lease_valid,',
    to: 'skip_hook_lock: inputs.inherited_lease_valid,',
    failing: 'hook_dispatch_plan::tests::plans_read_real_git_configuration',
  },
  {
    name: 'repeated dash c pairing skipped',
    file: 'src/native/hook_dispatch_plan.rs',
    from: '        if token != \"-c\" {',
    to: '        if false {',
    failing: 'hook_dispatch_plan::tests::global_overrides_pair_each_dash_c_with_its_next_token',
  },
  {
    name: 'existing hooks directory reused',
    file: 'src/native/hook_dispatch_entries.rs',
    from: '    create_private_directory(hooks_directory).map_err(|error| {',
    to: '    std::fs::create_dir_all(hooks_directory).map_err(|error| {',
    failing: 'hook_dispatch_entries::tests::an_existing_hooks_directory_is_refused',
  },

  {
    name: 'strict reverse check line match guard',
    file: 'src/native/replay_reverse_apply.rs',
    from: 'if !incomplete_last || match_end {',
    to: 'if true {',
    failing: 'replay_reverse_apply::tests::an_incomplete_preimage_line_matches_past_whitespace_when_not_anchored',
  },
  {
    name: 'patch hunk count for removals',
    file: 'src/native/replay_patch.rs',
    from: 'if marker != b\'+\' {',
    to: 'if true {',
    failing: 'replay_patch::tests::a_removal_after_an_addition_still_counts_the_old_side',
  },
  {
    name: 'capture order unread-path guard',
    file: 'src/native/replay_capture_order.rs',
    from: 'if !captured.paths.contains(path) {',
    to: 'if false {',
    failing: 'replay_capture_order::tests::an_unread_path_is_unordered',
  },
  {
    name: 'reservation earned at the configured count',
    file: 'src/native/replay_reservation.rs',
    from: 'lost_races >= reserve_after',
    to: 'lost_races > reserve_after',
    failing: 'replay_reservation::tests::the_reservation_is_earned_at_the_configured_count',
  },
  {
    name: 'replayed header names listed once',
    file: 'src/native/replay_object.rs',
    from: ' && !names.contains(&header.name) {',
    to: ' {',
    failing: 'replay_object::tests::dropped_headers_are_the_custom_names_in_order',
  },
  {
    name: 'subsumption text verdict per path',
    file: 'src/native/replay_subsumption.rs',
    from: 'text.contains(&entry.path)',
    to: 'false',
    failing: 'replay_subsumption::tests::the_scenario_settles_each_path_by_its_rule',
  },
  {
    name: "an empty capture identity is refused",
    file: "src/native/capture_order.rs",
    from: "if recorded.is_empty() {",
    to: "if false {",
    failing: "capture_order::tests::an_empty_identity_is_rejected",
  },
  {
    name: "a failed preparation removes its shadow",
    file: "src/native/commit_preparation.rs",
    from: "    if exit_code != 0 {\n        remove_failed_shadow(request.shadow);",
    to: "    if false {\n        remove_failed_shadow(request.shadow);",
    failing: "commit_preparation::tests::a_failing_commit_msg_hook_propagates_the_exit_code_and_removes_the_shadow",
  },
  {
    name: "the all flag is removed from the commit region",
    file: "src/native/commit_args.rs",
    from: "if token == \"--all\" {",
    to: "if false {",
    failing: "commit_args::tests::without_all_flag_removes_only_the_all_letter",
  },
  {
    name: "index commits without staging skip the staging step",
    file: "src/native/commit_index.rs",
    from: "if !selection.stage_into_index {",
    to: "if false {",
    failing: "commit_index::tests::index_without_staging_matches_the_real_index",
  },
  {
    name: "a branch base is written to the shadow branch",
    file: "src/native/shadow_refs.rs",
    from: "if let Base::Commit(oid) = base {",
    to: "if let Base::Commit(oid) = &Base::Unborn {",
    failing: "shadow_refs::tests::files_shadow_snapshots_refs_and_points_head_at_the_branch",
  },
  {
    name: "a linked worktree keeps its info directory private",
    file: "src/native/shadow_links.rs",
    from: "if !mixed_info {",
    to: "if false {",
    failing: "shadow_links::tests::shared_entries_link_and_private_entries_stay_absent",
  },
  {
    name: "the sequencer is copied into the shadow",
    file: "src/native/conclusion_copy.rs",
    from: "if path_present(sequencer.as_path())",
    to: "if false && path_present(sequencer.as_path())",
    failing: "conclusion_copy::tests::sequencer_is_copied_recursively",
  },
  {
    name: "the repository extensions are copied into the shadow config",
    file: "src/native/shadow_config.rs",
    from: "if !format.extensions.is_empty() {",
    to: "if false {",
    failing: "shadow_config::tests::config_copies_extensions_before_the_include",
  },
  {
    name: "amend wins over the conclusion markers",
    file: "src/native/capture_invocation.rs",
    from: "if amend {",
    to: "if false {",
    failing: "capture_invocation::tests::conclusion_markers_decide_the_kind",
  },
  {
    name: "a failed interactive selection is reported",
    file: "src/native/commit_index.rs",
    from: "    if !status.success() {",
    to: "    if false {",
    failing: "commit_index::tests::interactive_selection_reports_a_failed_git_add",
  },
  {
    name: "a missing shared info directory is tolerated",
    file: "src/native/shadow_links.rs",
    from: "        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}",
    to: "        Err(error) if false => {}",
    failing: "shadow_links::tests::linked_worktree_without_a_shared_info_directory_still_links",
  },
  {
    name: 'signal relay sender check',
    file: 'src/native/signal_relay.rs',
    from: 'if !is_process_sender(code) {',
    to: 'if false {',
    failing: 'signal_relay::tests::handler_marks_a_signal_only_for_a_process_sender',
  },
  {
    name: 'signal relay in the handler',
    file: 'src/native/signal_relay.rs',
    from: 'PENDING[slot].store(signal, std::sync::atomic::Ordering::SeqCst);',
    to: 'let _ = signal;',
    failing: 'signal_relay::tests::process_signal_is_relayed_and_the_child_outcome_is_reported',
  },
  {
    name: 'automatic maintenance detach retry',
    file: 'src/native/maintenance_run.rs',
    from: 'if result_code != USAGE_EXIT_CODE {',
    to: 'if true {',
    failing: 'maintenance_run::tests::rejected_detach_retries_without_the_flag',
  },
  {
    name: 'gc.auto positive threshold',
    file: 'src/native/maintenance_decision.rs',
    from: 'Some(value) => javascript_number(value.as_str()) > 0.0,',
    to: 'Some(value) => javascript_number(value.as_str()) != 0.0,',
    failing: 'maintenance_decision::tests::non_positive_gc_auto_disables',
  },
  {
    name: 'gc.autodetach fallback',
    file: 'src/native/maintenance_decision.rs',
    from: '.or_else(|| return config.get("gc.autodetach"));',
    to: '.or_else(|| return None);',
    failing: 'maintenance_decision::tests::gc_autodetach_false_runs_in_the_foreground',
  },
  {
    name: 'hk listing field pairing',
    file: 'src/native/maintenance_hk_config.rs',
    from: 'if fields.len() % 2 != 0 {',
    to: 'if false {',
    failing: 'maintenance_hk_config::tests::scope_without_key_is_malformed',
  },
  {
    name: 'hk exact prefix',
    file: 'src/native/maintenance_hk_config.rs',
    from: 'key.starts_with(HK_HOOK_PREFIX)',
    to: 'key.starts_with("hook.")',
    failing: 'maintenance_hk_config::tests::prefix_match_is_exact',
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
  {
    name: 'worktree copy dead-owner settlement retirement',
    file: 'src/native/worktree_copy_lock.rs',
    from: 'if owner_alive(&holder)? {',
    to: 'if true {',
    failing: 'worktree_copy_lock::tests::dead_owner_lock_is_retired_and_taken',
  },
  {
    name: 'worktree copy preflight refuses differing destination entries',
    file: 'src/native/worktree_copy_install.rs',
    from: 'if !entry_matches(stage_root, destination_root, entry)? {',
    to: 'if false {',
    failing: 'worktree_copy_install::tests::preflight_refuses_differing_entries_without_overwriting',
  },
  {
    name: 'worktree copy rollback content proof',
    file: 'src/native/worktree_copy_rollback.rs',
    from: '            !entry_matches(stage_root, destination_root, entry)?',
    to: '            false',
    failing: 'worktree_copy_rollback::tests::edited_file_is_retained_by_path',
  },
  {
    name: 'worktree copy journal private-mode refusal',
    file: 'src/native/worktree_copy_journal.rs',
    from: '|| (metadata.mode() & NON_PRIVATE_MODE_BITS) != 0',
    to: '|| false',
    failing: 'worktree_copy_journal::tests::unsafe_journal_mode_fails_closed_and_is_kept',
  },
  {
    name: 'worktree copy install log unfinished-append truncation',
    file: 'src/native/worktree_copy_install_log.rs',
    from: 'if complete_length < total_length {',
    to: 'if false {',
    failing: 'worktree_copy_install_log::tests::unfinished_trailing_append_is_truncated',
  },
  {
    name: 'worktree copy settlement exit status',
    file: 'src/native/worktree_copy.rs',
    from: '(true, true) => return 2,',
    to: '(true, true) => return 0,',
    failing: 'worktree_copy::tests::exit_status_follows_the_settlement_table',
  },
  {
    name: 'worktree copy installation batches',
    file: 'src/native/worktree_copy_install.rs',
    from: 'entries.chunks(INSTALL_BATCH_ENTRIES)',
    to: 'entries.chunks(entries.len().max(1))',
    failing: 'worktree_copy_install::tests::records_grow_by_batch_not_by_entry',
  },
  {
    name: 'landing branch-switch check',
    file: 'src/native/landing_attempt.rs',
    from: 'if symbolic_head != capture.layout.symbolic_head {',
    to: 'if false {',
    failing: 'landing::a_branch_switch_lands_nothing_and_renders_the_finding',
  },
  {
    name: 'landing head-moved check',
    file: 'src/native/landing_attempt.rs',
    from: 'if !same_target(&current, &expected_old) {',
    to: 'if false {',
    failing: 'landing::a_moved_target_reports_the_winner_and_is_replayable',
  },
  {
    name: 'landing releases the index lock when it lands nothing',
    file: 'src/native/landing_attempt.rs',
    from: 'if held.for_recovery {',
    to: 'if true {',
    failing: 'landing::a_failed_migration_releases_the_lock',
  },
  {
    name: 'landing hands the directory back after a lost compare-and-swap',
    file: 'src/native/landing_attempt.rs',
    from: 'workspace.preserved = false;',
    to: 'workspace.preserved = true;',
    failing: 'landing_crash::a_target_moved_during_the_landing_loses_the_compare_and_swap',
  },
  {
    name: 'landing journals the index lock before announcing it',
    file: 'src/native/real_index_lock.rs',
    from: 'write_lock_record(transaction_directory, attempt, identity)?;',
    to: 'let _ = write_lock_record;',
    failing: 'real_index_lock::tests::a_landing_lock_journals_its_identity_and_announces_the_process',
  },
  {
    name: 'post-commit stage ignores the invocation PATH for the Markdown linter',
    file: 'src/native/post_commit.rs',
    from: '    checks.markdown.linter = Box::new(executable_linter(request.environment));',
    to: '    checks.markdown.linter = Box::new(executable_linter(&[]));',
    failing: 'post_commit::tests::the_linter_is_found_on_the_invocations_path',
  },
  {
    name: 'post-commit stage ignores the forbidden-strings rules variable',
    file: 'src/native/post_commit.rs',
    from: '    checks.scanner_settings.rules_variable = environment_value(request.environment, RULES_VARIABLE);',
    to: '    checks.scanner_settings.rules_variable = None;',
    failing: 'post_commit::tests::the_rules_variable_reaches_the_post_commit_scanner',
  },
  {
    name: 'post-commit stage ignores the configured forbidden-strings options',
    file: 'src/native/post_commit.rs',
    from: '    checks.scanner_settings.options = request.config.forbidden_strings.clone();',
    to: '    checks.scanner_settings.options = PolicyConfig::defaults().forbidden_strings;',
    failing: 'post_commit::tests::the_configured_rules_file_reaches_the_post_commit_scanner',
  },
  {
    name: 'post-commit stage ignores the configured Markdown options',
    file: 'src/native/post_commit.rs',
    from: '    checks.markdown.options = request.config.markdown_autofix.clone();',
    to: '    checks.markdown.options = PolicyConfig::defaults().markdown_autofix;',
    failing: 'post_commit::tests::the_markdown_options_reach_the_post_commit_policy',
  },
  {
    name: 'auto-push Git children drop the invocation environment',
    file: 'src/native/commit_command.rs',
    from: 'environment: environment_with_overlay(command.environment, command.context.overlay.as_slice()),',
    to: 'environment: environment_with_overlay(&command.environment[..0], command.context.overlay.as_slice()),',
    failing: 'push_environment::an_auto_push_after_a_landed_commit_runs_git_with_the_invocation_environment',
  },
  {
    name: 'manual-push probe Git children drop the invocation environment',
    file: 'src/native/wrapped_command.rs',
    from: 'environment: environment_with_overlay(environment, context.overlay.as_slice()),',
    to: 'environment: environment_with_overlay(&environment[..0], context.overlay.as_slice()),',
    failing: 'push_environment::a_manual_push_probes_and_pushes_with_the_invocation_environment',
  },
  {
    name: 'an event path keeps the exact bytes of a name that is not UTF-8',
    file: 'src/native/event_path.rs',
    from: 'exact: Some(bytes.to_vec()),',
    to: 'exact: None,',
    failing: 'event_path::tests::a_name_that_is_not_utf8_keeps_its_bytes',
  },
  {
    name: 'a replay conflict lists the bytes of every path once one is not UTF-8',
    file: 'src/native/policy_events.rs',
    from: '        if path.exact().is_some() {',
    to: '        if false {',
    failing: 'policy_events::tests::a_replay_conflict_over_a_name_that_is_not_utf8_adds_paths_bytes',
  },
  {
    name: 'a journal list records the bytes of every path once one is not UTF-8',
    file: 'src/native/transaction_journal_encode.rs',
    from: 'if event_paths.iter().any(|path| { return path.exact().is_some(); }) {',
    to: 'if false {',
    failing: 'transaction_journal_encode::tests::names_that_are_not_utf8_are_written_with_their_exact_bytes',
  },
  {
    name: 'landing guards a name that is not UTF-8 by its exact bytes',
    file: 'src/native/landing_index.rs',
    from: '    return os_from_path_bytes(pathspec.as_slice());',
    to: '    return OsString::from(String::from_utf8_lossy(pathspec.as_slice()).into_owned());',
    failing: 'landing_index::tests::explicit_path_mode_resets_a_committed_name_that_is_not_utf8',
  },
  {
    name: 'the candidate pathspec of a name that is not UTF-8 keeps its exact bytes',
    file: 'src/native/commit_transaction.rs',
    from: '                return os_from_path_bytes(pathspec.as_slice());',
    to: '                return OsString::from(String::from_utf8_lossy(pathspec.as_slice()).into_owned());',
    failing: 'commit_transaction::tests::the_candidate_request_keeps_the_bytes_of_a_name_that_is_not_utf8',
  },
  {
    name: 'a correction of a name that is not UTF-8 is staged under its exact bytes',
    file: 'src/native/private_index_stage.rs',
    from: '    request.arguments.push(os_from_path_bytes(path));',
    to: '    request.arguments.push(std::ffi::OsString::from(String::from_utf8_lossy(path).into_owned()));',
    failing: 'event_path_commit::a_commit_correction_of_a_name_that_is_not_utf8_reports_the_exact_bytes',
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
      'nextest',
      'run',
      '--offline',
      '--locked',
      '--all-targets',
      '--no-fail-fast',
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
  // nextest prints `FAIL [ 0.012s] <binary id> <test name>`; the name is the last token of the line.
  const noticed = (run.status !== 0) && output.split('\n').some(function failedLine(line) {
    return /^\s*FAIL \[/u.test(line) && line.trimEnd().endsWith(` ${control.failing}`);
  });
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
