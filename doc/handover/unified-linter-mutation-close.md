# Unified-linter mutation close

## Purpose and how to respond

Mutation testing is a release acceptance gate for the native linter in `package/linter/monochromatic-lint`:
a surviving non-equivalent mutant needs a stronger test,
an equivalent or unreachable one needs evidence,
and a campaign that exits nonzero is not a passing gate.
This handover removes the timeouts that kept the Markdown and processor campaigns exiting 3,
runs the first campaign over the executable's own modules,
and reruns the Markdown and processor campaigns on the final snapshot.

Inspect `Timeouts removed` first,
because it changes production code and adds one error path.
Then read `Defects found` and `Remaining`.
Respond with a veto of a named change or disposition,
or with the next scope to mutate.

This document is in progress;
sections without results say so.

## Timeouts removed

Every timeout had one cause:
a loop whose only progress was a step that cargo-mutants can replace.
`+=` replaced by `*=` multiplies a zero counter by one,
and a constant replacement of `MarkdownSource::parent` makes a node its own ancestor,
so the loop never ends and the test binary runs into the 180 second per-mutant limit.
cargo-mutants 27.1.0 exits 3 for any timeout,
so no campaign containing such a loop can pass.
Each loop now walks a slice,
calls a standard search,
or runs over a fixed range,
so termination no longer depends on a statement a mutant can change.

### `markdown_definitions.rs`: definition line start

`removal_edit` walked backwards one byte at a time to find the line start
(`replace -= with /= in removal_edit` timed out in `mutation-p3QH2L` and `mutation-BX2JYq`).
It now takes `rfind(['\n', '\r'])` over the source before the definition,
the same shape as `continuation_prefix` in `markdown_prose_context.rs`.
`standalone_definitions_do_not_leave_line_fragments` already deletes an indented definition on a later line
in LF,
CRLF and bare CR,
so both mutants of the remaining `ending + 1` fail it:
the copied prefix would start at the line ending and the definition would no longer count as standalone.

### `markdown_punctuation.rs`: escaped heading punctuation

`suffix_start` counted the backslashes before a trailing period or colon with a hand-stepped index
(`replace -= with /= in suffix_start` timed out in both Markdown campaigns).
It now flips an `escaped` flag while walking the bytes before the punctuation in reverse,
the same shape as `cell_content` in `markdown_tables.rs`.
The new control `escape_runs_reaching_the_text_start_decide_the_suffix` covers runs of one,
two and three backslashes that reach the text's first byte,
two escaped characters in a row,
and a run after a letter.

### `MarkdownSource::parent`: bounded ancestor walks

Both constant replacements of `MarkdownSource::parent` timed out in every Markdown campaign,
because `has_ancestor` and `paragraph_for` climbed until `parent` returned `None`.
The main session chose,
open to veto,
to bound ancestor walks so that a cycle becomes a typed error,
rather than exclude the two mutants.

- `MarkdownSource::ancestors` is the only ancestor walk.
  It returns the ancestors nearest first,
  and runs over the fixed range `0..parents.len()`:
  a node at depth d needs d + 1 passes and d is at most one less than the node count,
  so a tree always finishes inside the range,
  and a walk that does not is a cycle.
  It then returns `MarkdownError` with the starting node's offset.
- `has_ancestor` returns `Result<bool, MarkdownError>`.
  `paragraph_for` and `delimiter_tail` in `markdown_prose_context.rs` now read one ancestor list
  that `semantic_line_breaks` takes once per text node,
  so they cannot fail separately.
- `markdown/semantic-line-breaks` and `markdown/no-emphasis-as-heading`,
  the two rules that walk ancestors,
  report the error as one `core/processing-failure` finding
  whose message starts with the rule code and `could not check this file:`,
  built by the new `ancestry_failure` in `markdown_finding.rs` through `run_failure::processing_failure`.
  That is the same pattern as `resolution_failure` in `rust_type_diagnostic.rs`.
  The public rule signatures are unchanged,
  so dispatch and the fuzz sidecar did not change.
- `markdown_tables.rs` reads one parent and walks nothing,
  so it still calls `parent` directly.

A corrupted arena cannot reach these walks:
`traversal` rejects a cyclic child graph before any parent index exists,
which `child_graph_rejects_duplicate_invalid_and_cyclic_ids` already tests.
The only place a cycle can appear is the derived parent index,
through a later change to `traversal` or a mutated accessor.
`a_parent_index_cycle_is_a_typed_error_and_a_processing_failure` in `markdown_traversal_tests.rs`
plants one there (the paragraph's parent becomes the emphasis inside it),
then requires the exact error message and offset from `ancestors` and `has_ancestor`,
and exactly one processing failure from each rule,
with its code,
severity,
message,
position and no fix.
`ancestor_walks_reach_the_root_from_the_deepest_possible_node` is the positive control for the bound:
in `*__a__*` every node lies on one path,
so the deepest text node needs exactly as many passes as the document has nodes.

### `processors_docs.rs`: doc-comment runs

`docs` grouped adjacent line comments with an inner `while` that advanced `index`
(`replace += with *= in docs` timed out in `mutation-exJwfB` and `processor-survivors-mutation-w00nRd`).
Grouping is now a separate step:
`units` walks the fixed range `1..=comments.len()`
and closes a unit wherever the named predicate `joins_run` says the next comment does not continue it.
`joins_run` keeps every condition of the old loop:
the same prefix,
a whitespace-only gap,
exactly one line ending,
and never a block comment.
The refusal for a line comment after code still applies to a run's first comment only;
later members follow a newline-only gap,
so the check could never fire for them.

No test had two adjacent block docs or a changed line prefix on the next line,
so `processors_keep_adjacent_blocks_and_changed_prefixes_in_separate_virtual_files`
compares the exact virtual names and texts for adjacent `/** */` blocks,
`//!` followed by `///`,
and `///` followed by `/** */`,
with a two-line `///` run as the positive control.

### `processors_lines.rs`: physical lines

`physical_lines` advanced a cursor by hand
(`replace += with *= in physical_lines` timed out in the same two processor campaigns).
It is now one `enumerate` pass:
a CR directly followed by LF is skipped,
and the LF that closes a CRLF pair finds its CR with `bytes[start..index].ends_with(b"\r")`,
which needs no index guard.
A bare CR always closes its own line,
so only a CRLF pair can leave a CR at the end of the current line.

### Loops pre-empted in the executable's modules

Three loops in files the executable added had the same shape.
`cargo mutants --list --no-config` on the source at `878f79d48` generates
`replace += with *= in relative_from` at `src/run_paths.rs:119:16`,
`replace += with *= in relative_link` at `src/markdown_lfs_target.rs:217:16`,
and `replace += with *= in sha256_hex` at `src/markdown_lfs_sha256.rs:175:16`.
Each multiplies a counter or offset that starts at zero,
so the loop condition never changes.
They were restructured before any campaign reached them,
so no campaign observed them as timeouts:
the two shared-prefix counts walk zipped component pairs and stop at the first difference,
and the hash splits its input with `as_chunks::<64>()`,
which returns the whole blocks and the remainder together
and removes the `bytes.len() / 64 * 64` arithmetic.
A first version used `chunks_exact(64)`,
which container Clippy denies (`clippy::chunks_exact_to_as_chunks`).

### Gate on the restructured source

Every run used `MONOCHROMATIC_LINT_IMAGE_TAG=mutation-close`,
mount-free and network-disabled containers,
2 GiB of memory,
2 CPUs and 128 processes.
Logs are in `package/linter/monochromatic-lint/target/verification/`.

- `gate-mutation-close-1.log`:
  378 library and 10 executable tests passed,
  then Clippy failed on `chunks_exact` in `markdown_lfs_sha256.rs`.
  The library suite took 183.94 seconds in that run.
- `gate-mutation-close-2.log`,
  after the `as_chunks` change:
  378 library tests passed in 107.20 seconds,
  10 executable tests passed,
  and Clippy with `-D warnings` finished with no finding.
  Test image `f357522ebe2b80d79a5858b5768305f54ba2241629b0d7587184243bcd7633c6`,
  source tree `a3b3491e423bddea5877825ccaacfe573af7248a`.

- `gate-mutation-close-3.log`,
  after the executable controls:
  379 library tests passed,
  and 11 of 12 `binary` tests passed;
  `debug_streams_workspace_progress_and_plain_runs_stay_silent` failed on a byte comparison
  described under `Dispositions of the first run`.
- `gate-mutation-close-4.log`,
  after that fix and the panic-hook refactor:
  380 library tests passed in 142.43 seconds,
  12 `binary` tests passed in 2.52 seconds,
  and Clippy finished with no finding.
  Test image `c184147f62f1ed1afa673cbe53b36cb7c8aeb8fd87e4f537763572551f7b03c8`,
  source tree `fa2efe52e284f9c368a81a08d2720d14579bd3a0`.
  The first Markdown campaign mutated this image.

The `binary` target took 0.30 to 0.65 seconds before the new controls and 1 to 2.5 seconds after them;
the workspace-progress control starts rust-analyzer's sysroot discovery and two `cargo metadata` runs.
Every executable-scope mutant pays that time.

The first two library-suite durations differ by 77 seconds on unchanged tests,
from load on the shared host.
The larger one is over the 180 second per-mutant limit,
so an unscoped campaign could record timeouts that are only a slow host.

`lint:rust` (the incumbent Rust linter) reports no code-line budget finding
and 84 `builtin(require-rustdoc)` findings,
one fewer than the 85 recorded before this work;
none is on an item added here.

## Executable campaign

### Scope

No campaign had mutated the executable's modules.
`mutation:executable`
(`bin/mutate-container.mjs --executable`)
mutates `src/run_*.rs`,
`src/main.rs`,
`src/rust_dispatch.rs` and `src/rust_rule_settings.rs`:
188 mutants at the first snapshot.
`mutation:list:executable` prints the scope without building.
The Markdown modules the executable added
(`markdown_lfs_*`,
`markdown_dispatch.rs` and `markdown_rule_settings.rs`)
are inside the Markdown scope's `src/markdown_*.rs` glob,
so they are dispositioned under `Markdown campaign` instead of being mutated twice.
`rust_dispatch.rs` and `rust_rule_settings.rs` predate the executable
but had never been mutated,
and they are the Rust half of the same dispatch and rule-settings layer.

### Test selection

`main.rs` and the real streams are reached only by the `binary` test target,
and its ten test names share no substring a positive filter could select.
The scope therefore runs every test
and passes libtest `--skip` for the suites that load real Cargo workspaces:
`rust_explicit_types`,
`rust_file_engine`,
`rust_inferred_constants`,
`rust_semantic_session` and `rust_workspace`.
Those suites also call `check_syntax_rules`,
which the orchestration,
processor and Rust-rule tests that stay in reach as well.
The unmutated baseline of the first campaign built in 84 seconds and tested in 1 second,
so the 180 second limit was left unchanged.
Its log shows the selection took effect:
369 library tests ran with 9 filtered out,
then the 10 `binary` tests.
The 9 are every test in `rust_explicit_types_tests.rs` (1),
`rust_file_engine_tests.rs` (2),
`rust_inferred_constants_tests.rs` (1),
`rust_semantic_session_tests.rs` (3) and `rust_workspace_tests.rs` (2).
Five of them load or prepare a Cargo workspace;
`no_semantic_selection_avoids_workspace_initialization` and the three semantic-session tests are quick,
and are skipped only because they share those modules' names.

### Dispositions of the first run

`mutation-hQ4LIa` mutated test image
`f357522ebe2b80d79a5858b5768305f54ba2241629b0d7587184243bcd7633c6`
(`campaign-executable-1.log`):
188 mutants,
129 caught,
6 missed,
53 unviable,
0 timeouts,
exit status 2,
25 minutes.
The 53 unviable mutants are mostly replacements with `Default::default()` for types without `Default`
and `||` in `if let` chains,
which do not compile.
Each missed mutant below names its disposition;
the rerun under `Final campaigns` is the proof for each killing test.

- `src/run_check.rs:126:13: delete field explicit_types from struct RustRuleSettings expression in HostChecker<'run>::check_rust_root`.
  Equivalent, and the redundant code is removed.
  `check_syntax_rules` reads only `max_lines`,
  `rustdoc` and `no_anonymous_functions`,
  so clearing `explicit_types` in a copy of the settings changed nothing.
  `check_rust_root` now passes the settings through.
- `src/run_finish.rs:49:5: replace debug_progress with ()`.
  Not equivalent:
  `--debug` loses the workspace progress lines.
  No test loaded a workspace with `--debug`.
  The new binary test `debug_streams_workspace_progress_and_plain_runs_stay_silent`
  points `rust/require-explicit-types` at an unparsable `Cargo.toml`:
  rust-analyzer reports `discovering sysroot` before Cargo rejects the manifest,
  so the run stays quick.
  It requires that line on standard error with `--debug`,
  an empty standard error without it,
  and one processing finding with status 2 in both runs.
  The first version also compared both runs' standard output byte for byte
  and failed in `gate-mutation-close-3.log`,
  because the message quotes Cargo's command line,
  which names a fresh temporary lockfile per run;
  the runs are now compared by location and code.
- `src/run_process.rs:70:8: delete ! in parse_and_run`.
  Not equivalent,
  but visible only when a panic happens:
  the silent hook would be installed for `--debug` runs only,
  and a contained panic would print the default message on standard error,
  which carries JSONL in `--stdin --fix` mode.
  No known input makes the executable panic,
  and the process-wide hook cannot be replaced inside a test binary without affecting every other test.
  The decision is now the named function `silences_panics`,
  and `only_debug_runs_keep_the_default_panic_hook` pins both answers.
  What remains untested is that `parse_and_run` calls `set_hook` when it returns true;
  cargo-mutants generates no mutant for that call.
- `src/run_process.rs:111:22: replace || with && in run_process`.
  Not equivalent:
  a failed write to one stream would no longer change the exit status.
  The new binary test `a_failing_output_stream_exits_two` sends standard output,
  then standard error under `--debug`,
  to `/dev/full`,
  and requires status 2 instead of the findings' status 1 each time.
- `src/run_workers.rs:37:37: replace * with +`
  (`WORKER_STACK_BYTES` becomes 8 bytes more than 1 MiB).
  Not equivalent:
  input that needs more than 1 MiB of stack overflows a worker and aborts the process.
  The other three mutants of the constant leave a few kilobytes or less,
  and ordinary test input already overflowed those workers:
  their logs end in `thread '<unknown>' has overflowed its stack`.
- `src/run_workers.rs:254:16: replace <= with > in process_plans`.
  Not equivalent for the same reason:
  with two or more files the plans run on the calling thread instead of on workers,
  and the calling thread of a test has 2 MiB of stack.
  Output order and content are otherwise unchanged.

Both stack mutants are killed by the new
`workers_parse_nesting_deeper_than_a_default_thread_stack_holds`,
which lints two files nested 1,200 parentheses deep at a limit of two.
Under either mutant the test binary aborts with a stack overflow,
so the per-mutant log shows the overflow line rather than a named failing test.
The depth comes from a calibration of the debug executable in the bounded container,
varying the main thread's stack with `ulimit -s`
(scratch harness, not committed;
134 is the abort status, 0 a completed run):

- 1,000 parentheses:
  2,048 KiB aborts,
  4,096 KiB completes.
- 1,200 parentheses:
  3,072 KiB aborts,
  4,096 KiB completes.
- 1,400 parentheses:
  4,096 KiB aborts,
  5,120 KiB completes.
- 1,600 parentheses:
  5,120 KiB aborts,
  6,144 KiB completes.
- 2,000 parentheses:
  4,096 KiB aborts,
  8,192 KiB completes.
- 4,000 parentheses:
  8,192 KiB aborts.

So 1,200 levels need between 3 and 4 MiB:
twice the margin below the 8 MiB worker stack,
and more than the 2 MiB a test thread or a 1 MiB mutant stack holds.
The margin is a property of this toolchain's unoptimized parser frames;
a release build needs less stack,
so the test can only become easier to pass there.
Markdown nesting did not recurse in the same calibration:
block quotes and lists 4,000 levels deep completed at a 256 KiB stack.

## Remaining

### Never-mutated files outside this brief

No campaign has mutated these production files,
and none of the three scopes here includes them
(counts from `cargo mutants --list --no-config` at the first executable snapshot):

- `src/file_discovery.rs`: 20 mutants.
- `src/fix_loop.rs`: 5 mutants.
- `src/path_inputs.rs`: 25 mutants.
- `src/rust_file_engine.rs`: 5 mutants.
- `src/rust_toolchain.rs`: 4 mutants.
- `src/rust_workspace.rs`: 14 mutants.
- `src/cli_options.rs` and `src/lib.rs`: none generated.

The first three are executable orchestration that predates the executable work
and run with the fast tests,
so they would fit the executable scope at little cost.
The last three are only reached by the Cargo-workspace suites the executable scope skips,
so they need a scope with those suites and a measured per-mutant limit.
`src/processors_consumer.rs` is a standalone consumer program outside the module tree.

### Whole-suite duration

The whole library suite took 183.94 seconds in one gate run and 107.20 seconds in the next,
on unchanged tests.
The unscoped `mutation` task would record some mutants as timeouts on a loaded host.
Every scope here filters the suite,
so none of them is affected.
