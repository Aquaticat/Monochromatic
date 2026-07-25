// What:     Integration tests that drive the compiled `rust-linter` binary as a
//           subprocess over the fixtures in `fixture/`. Files under `tests/` are
//           compiled by cargo into a separate test binary, not into the library.
// Why:      Exercise the real end-user path (argv in, exit code and stdout out),
//           not just internal functions.
//
// In TS you'd write (pseudocode):
// ```ts
// import { execFileSync } from "node:child_process";
// describe("rust-linter cli", () => { ... });
// ```

// What:     `use std::process::Command;` imports the standard-library type for
//           spawning a child process.
// Why:      We run the linter binary and read its result.
//
// In TS you'd write (pseudocode):
// ```ts
// import { execFileSync } from "node:child_process";
// ```
use std::process::Command;

// What:     `fn run_with_stderr(args: &[&str]) -> (i32, String, String)`.
//           Helper that runs the binary with the given arguments and returns the
//           `(exit_code, stdout, stderr)` triple. `&[&str]` is a borrowed slice of
//           borrowed string slices. `(i32, String, String)` is a tuple: a 32-bit
//           signed exit code plus owned stdout and stderr strings.
// Why:      Clap-specific tests need stderr, while ordinary lint tests mostly read
//           stdout diagnostics.
//
// In TS you'd write (pseudocode):
// ```ts
// function runWithStderr(args: string[]): { code: number; stdout: string; stderr: string } { /* ... */ }
// ```
fn run_with_stderr(args: &[&str]) -> (i32, String, String) {
    // What:     `let binary = env!("CARGO_BIN_EXE_rust-linter");`. `env!` is a
    //           macro that reads an environment variable AT COMPILE TIME. Cargo
    //           sets `CARGO_BIN_EXE_<bin-name>` to the path of the built binary
    //           for integration tests.
    // Why:      Locate the exact binary cargo just built, no hardcoded path.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const binary = process.env.RUST_LINTER_BIN!;
    // ```
    let binary = env!("CARGO_BIN_EXE_rust-linter");

    // What:     `let manifest_dir = env!("CARGO_MANIFEST_DIR");`. Compile-time path
    //           of the crate root (where `Cargo.toml` lives).
    // Why:      Run the binary with the crate root as the working directory so the
    //           relative `fixture/...` paths resolve.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const manifestDir = path.resolve(__dirname, "..");
    // ```
    let manifest_dir = env!("CARGO_MANIFEST_DIR");

    // What:     `let mut command = Command::new(binary);`. Build a child-process
    //           spec for the binary. `mut` because the next lines configure it.
    // Why:      Prepare to launch the linter.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // // build args for execFileSync below
    // ```
    let mut command = Command::new(binary);

    // What:     `command.current_dir(manifest_dir);`. Set the child's working
    //           directory.
    // Why:      So `fixture/sample.rs` is found relative to the crate root.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // options.cwd = manifestDir;
    // ```
    command.current_dir(manifest_dir);

    // What:     `command.args(args);`. Append all caller-supplied arguments.
    // Why:      Pass the flags and fixture path through.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const argv = args;
    // ```
    command.args(args);

    // What:     `let output = command.output().expect("failed to run rust-linter");`.
    //           `.output()` runs the child to completion and returns
    //           `Result<Output, io::Error>`; `.expect(msg)` unwraps the `Ok` or
    //           panics with `msg` (acceptable in a test: a spawn failure should
    //           fail loudly).
    // Why:      Capture the exit status, stdout, and stderr.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const output = spawnSync(binary, argv, options);
    // ```
    let output = command.output().expect("failed to run rust-linter");

    // What:     `let code = output.status.code().unwrap_or(-1);`. `.status.code()`
    //           returns `Option<i32>` (None if the process was killed by a signal);
    //           `.unwrap_or(-1)` substitutes `-1` in that rare case.
    // Why:      Get a plain integer exit code to assert on.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const code = output.status ?? -1;
    // ```
    let code = output.status.code().unwrap_or(-1);

    // What:     `let stdout = String::from_utf8_lossy(&output.stdout).into_owned();`.
    //           `output.stdout` is a `Vec<u8>` (raw bytes); `&output.stdout`
    //           borrows it. `String::from_utf8_lossy` decodes bytes to text,
    //           replacing any invalid UTF-8; `.into_owned()` yields an owned
    //           `String`.
    // Why:      Inspect printed lint diagnostics and clap help text as text.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const stdout = output.stdout.toString("utf8");
    // ```
    let stdout = String::from_utf8_lossy(&output.stdout).into_owned();

    // What:     `let stderr = String::from_utf8_lossy(&output.stderr).into_owned();`.
    //           Same lossy UTF-8 conversion as stdout, but for the child process's
    //           error stream.
    // Why:      Clap writes parse errors to stderr, so invalid-argument tests need
    //           this text.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const stderr = output.stderr.toString("utf8");
    // ```
    let stderr = String::from_utf8_lossy(&output.stderr).into_owned();

    // What:     `(code, stdout, stderr)`. Tail expression: return the triple as a
    //           tuple.
    // Why:      Hand every observable process result back to the test.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return { code, stdout, stderr };
    // ```
    return (code, stdout, stderr)
}

// What:     `fn run(args: &[&str]) -> (i32, String)`. Smaller wrapper around
//           `run_with_stderr` for tests that only care about stdout.
// Why:      Keep existing lint assertions compact while clap assertions can opt
//           into stderr.
//
// In TS you'd write (pseudocode):
// ```ts
// function run(args: string[]): { code: number; stdout: string } { /* ... */ }
// ```
fn run(args: &[&str]) -> (i32, String) {
    // What:     `let (code, stdout, _stderr) = run_with_stderr(args);`. Destructures
    //           the tuple and binds stderr to `_stderr`, where the leading
    //           underscore means intentionally unused.
    // Why:      Reuse one subprocess implementation without forcing every test to
    //           mention stderr.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const { code, stdout } = runWithStderr(args);
    // ```
    let (code, stdout, _stderr) = run_with_stderr(args);

    // What:     `(code, stdout)`. Tail expression: return only the values this
    //           helper promises.
    // Why:      Preserve the existing helper shape for lint-result tests.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return { code, stdout };
    // ```
    return (code, stdout)
}

// What:     `fn run_relocated(fixture_rel: &str, extra_args: &[&str]) -> (i32, String)`.
//           Copies a committed fixture to a throwaway path OUTSIDE every exempt
//           directory, then lints that copy through the binary. `&str` is a
//           borrowed string slice; `&[&str]` a borrowed slice of borrowed slices;
//           the returned tuple is `(exit_code, stdout)`.
// Why:      The fixtures live under `fixture/`, which both rules now exempt, so a
//           rule-firing test cannot lint them in place. Relocating the SAME bytes
//           to a non-exempt temp path proves the rule still fires, while the
//           committed fixture stays the single source of the sample content (the
//           copy is disposable, per the throwaway-fixture convention).
//
// In TS you'd write (pseudocode):
// ```ts
// function runRelocated(fixtureRel: string, extraArgs: string[]): { code: number; stdout: string } { /* ... */ }
// ```
fn run_relocated(fixture_rel: &str, extra_args: &[&str]) -> (i32, String) {
    // What:     `let manifest_dir = env!("CARGO_MANIFEST_DIR");`. `env!` is a macro
    //           that reads an environment variable AT COMPILE TIME; cargo sets this
    //           one to the crate root.
    // Why:      Locate the committed fixture relative to the crate root.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const manifestDir = path.resolve(__dirname, "..");
    // ```
    let manifest_dir = env!("CARGO_MANIFEST_DIR");

    // What:     `let source = format!("{manifest_dir}/{fixture_rel}");`. `format!`
    //           is a macro that builds an owned `String` by interpolating the two
    //           pieces.
    // Why:      Absolute path of the fixture to copy from.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const source = `${manifestDir}/${fixtureRel}`;
    // ```
    let source = format!("{manifest_dir}/{fixture_rel}");

    // What:     `let content = std::fs::read_to_string(&source).expect("read fixture");`.
    //           `read_to_string` returns `Result<String, io::Error>`; `&source`
    //           lends the path read-only; `.expect(msg)` unwraps the `Ok` or panics
    //           with `msg` (fine in a test: a missing fixture should fail loudly).
    // Why:      Read the sample bytes we are about to relocate.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const content = fs.readFileSync(source, "utf8");
    // ```
    let content = std::fs::read_to_string(&source).expect("read fixture");

    // What:     `let basename = std::path::Path::new(fixture_rel).file_name()
    //           .and_then(|n| n.to_str()).expect("fixture basename");`. `Path::new`
    //           wraps the string as a `&Path`; `.file_name()` returns
    //           `Option<&OsStr>` (last segment, or `None`); `.and_then(|n|
    //           n.to_str())` converts to `Option<&str>` when valid UTF-8;
    //           `.expect(...)` unwraps it.
    // Why:      Preserve the fixture's file name so a `*_tests.rs` sample keeps its
    //           name-based exemption at the new location.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const basename = path.basename(fixtureRel);
    // ```
    let basename = std::path::Path::new(fixture_rel)
        .file_name()
        .and_then(|n| return n.to_str())
        .expect("fixture basename");

    // What:     `let temp_path = std::env::temp_dir().join(format!(
    //           "rust-linter-probe-{}-{}", std::process::id(), basename));`.
    //           `temp_dir()` returns the OS temp directory as an owned `PathBuf`
    //           (the owned sibling of borrowed `&Path`); `std::process::id()` is
    //           this process's id (unique per nextest test, which runs one process
    //           per test); `.join(...)` appends a segment.
    // Why:      A unique destination path with NO exempt directory component, so the
    //           rule is not short-circuited by location.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const tempPath = path.join(os.tmpdir(), `rust-linter-probe-${process.pid}-${basename}`);
    // ```
    let temp_path = std::env::temp_dir().join(format!(
        "rust-linter-probe-{}-{}",
        std::process::id(),
        basename
    ));

    // What:     `std::fs::write(&temp_path, content).expect("write temp fixture");`.
    //           `write` creates/truncates the file and writes the bytes, returning
    //           `Result<(), io::Error>`; `&temp_path` lends the path, while
    //           `content` (an owned `String`) is MOVED in (its last use);
    //           `.expect(...)` panics on failure.
    // Why:      Materialise the disposable copy at the non-exempt path.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // fs.writeFileSync(tempPath, content);
    // ```
    std::fs::write(&temp_path, content).expect("write temp fixture");

    // What:     `let temp_arg = temp_path.to_string_lossy().into_owned();`.
    //           `to_string_lossy` decodes the path to `Cow<str>` (borrowed when
    //           valid UTF-8, owned with replacements otherwise); `.into_owned()`
    //           forces an owned `String`.
    // Why:      `run_with_stderr` takes `&str` arguments, so we need an owned string
    //           to borrow from.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const tempArg = String(tempPath);
    // ```
    let temp_arg = temp_path.to_string_lossy().into_owned();

    // What:     `let mut args = extra_args.to_vec();`. `.to_vec()` copies the slice
    //           into an owned, growable `Vec<&str>`; `mut` so we can push to it.
    // Why:      Build the full argument list: the caller's flags plus the temp path.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const args = [...extraArgs];
    // ```
    let mut args = extra_args.to_vec();

    // What:     `args.push(&temp_arg);`. `&temp_arg` lends the owned string as a
    //           `&str` and appends it; `temp_arg` stays alive until after the run
    //           call below, so the borrow is valid.
    // Why:      The path to lint is the last argument.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // args.push(tempArg);
    // ```
    args.push(&temp_arg);

    // What:     `let (code, stdout, _stderr) = run_with_stderr(&args);`. Destructure
    //           the triple; the leading `_` marks stderr intentionally unused;
    //           `&args` lends the argument vector read-only.
    // Why:      Run the binary over the relocated copy and capture its result.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const { code, stdout } = runWithStderr(args);
    // ```
    let (code, stdout, _stderr) = run_with_stderr(&args);

    // What:     `let _ = std::fs::remove_file(&temp_path);`. `remove_file` returns
    //           `Result<(), io::Error>`; `let _ =` discards it. We delete BEFORE the
    //           caller asserts, so a failed assertion never leaks the temp file.
    // Why:      Clean up the disposable copy regardless of the lint outcome.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // try { fs.unlinkSync(tempPath); } catch {}
    // ```
    let _ = std::fs::remove_file(&temp_path);

    // What:     `(code, stdout)`. Tail expression: return the exit code and stdout.
    // Why:      Hand the observable result back to the test.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return { code, stdout };
    // ```
    return (code, stdout)
}

// What:     `#[test] fn over_budget_exits_nonzero() { ... }`. Run the binary with a
//           budget smaller than the fixture's code-line count.
// Why:      A violation must exit non-zero and name the rule.
//
// In TS you'd write (pseudocode):
// ```ts
// it("exits non-zero over budget", () => { ... });
// ```
#[test]
fn over_budget_exits_nonzero() {
    // What:     `let (code, stdout) = run_relocated("fixture/sample.rs", &["--max",
    //           "2"]);`. Destructure the returned tuple; `&[...]` lends the extra
    //           flag arguments. The sample has three code lines, so a budget of 2
    //           fails. The helper relocates the sample to a non-exempt temp path so
    //           the rule is not short-circuited by the `fixture/` directory.
    // Why:      Trigger and observe a max-lines violation through the binary.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const { code, stdout } = runRelocated("fixture/sample.rs", ["--max", "2"]);
    // ```
    let (code, stdout) = run_relocated("fixture/sample.rs", &["--max", "2"]);

    // What:     `assert_eq!(code, 1, ...)`. Exit code must be 1 (violations found).
    // Why:      Lint failures are signalled by exit 1.
    assert_eq!(code, 1, "over budget should exit 1; stdout: {stdout}");

    // What:     `assert!(stdout.contains("max-lines"), ...)`. The output must name
    //           the rule. `.contains(...)` is a substring test.
    // Why:      Confirm the diagnostic, not just the exit code.
    assert!(stdout.contains("max-lines"), "stdout should name the rule: {stdout}");
}

// What:     `#[test] fn under_budget_exits_zero() { ... }`. Same fixture, generous
//           budget.
// Why:      A clean file exits 0 with no output.
//
// In TS you'd write (pseudocode):
// ```ts
// it("exits zero under budget", () => { ... });
// ```
#[test]
fn under_budget_exits_zero() {
    // What:     `let (code, stdout) = run_relocated("fixture/sample.rs", &["--max",
    //           "5"]);`. Budget 5 over three code lines, linted at a non-exempt temp
    //           path so the budget is genuinely applied (not skipped as a fixture).
    // Why:      Observe the passing path where the rule runs but finds nothing.
    let (code, stdout) = run_relocated("fixture/sample.rs", &["--max", "5"]);

    // What:     two assertions: exit 0 and empty stdout.
    // Why:      Clean runs print nothing and succeed.
    assert_eq!(code, 0, "under budget should exit 0");
    assert!(stdout.is_empty(), "under budget should print nothing: {stdout}");
}

// What:     `#[test] fn joined_max_value_exits_zero() { ... }`. Same clean path as
//           above, but uses clap's joined flag form `--max=5`.
// Why:      Preserve behaviour from the old parser while proving clap accepts the
//           form through the real binary.
//
// In TS you'd write (pseudocode):
// ```ts
// it("accepts --max=value", () => { ... });
// ```
#[test]
fn joined_max_value_exits_zero() {
    // What:     `let (code, stdout) = run_relocated("fixture/sample.rs",
    //           &["--max=5"]);`. The `=` keeps the flag name and value in one argv
    //           token; the sample is relocated to a non-exempt temp path so budget 5
    //           is really applied over its three code lines.
    // Why:      Confirm clap handles the previously supported joined spelling.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const { code, stdout } = runRelocated("fixture/sample.rs", ["--max=5"]);
    // ```
    let (code, stdout) = run_relocated("fixture/sample.rs", &["--max=5"]);

    // What:     two assertions: exit 0 and empty stdout.
    // Why:      The joined spelling should be equivalent to `--max 5`.
    assert_eq!(code, 0, "joined --max should exit 0");
    assert!(stdout.is_empty(), "joined --max should print nothing: {stdout}");
}

// What:     `#[test] fn help_exits_zero_and_mentions_max() { ... }`. Runs the real
//           binary with clap's generated `--help` flag.
// Why:      Verify the migration exposes user-facing help and includes the custom
//           max-lines option.
//
// In TS you'd write (pseudocode):
// ```ts
// it("prints help", () => { ... });
// ```
#[test]
fn help_exits_zero_and_mentions_max() {
    // What:     `let (code, stdout, stderr) = run_with_stderr(&["--help"]);`.
    //           `--help` is handled by clap before linting starts.
    // Why:      Capture every stream because clap should write help to stdout and
    //           leave stderr empty.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const { code, stdout, stderr } = runWithStderr(["--help"]);
    // ```
    let (code, stdout, stderr) = run_with_stderr(&["--help"]);

    // What:     assertions over clap help: exit 0, contains `--max`, no stderr.
    // Why:      Prove the generated help is user-visible and clean.
    assert_eq!(code, 0, "--help should exit 0; stderr: {stderr}");
    assert!(stdout.contains("--max"), "help should mention --max: {stdout}");
    assert!(stderr.is_empty(), "help should not print stderr: {stderr}");
}

// What:     `#[test] fn invalid_max_exits_two_on_stderr() { ... }`. Runs the real
//           binary with a nonnumeric `--max` value.
// Why:      Clap should reject invalid input before linting and use exit code 2.
//
// In TS you'd write (pseudocode):
// ```ts
// it("rejects invalid --max", () => { ... });
// ```
#[test]
fn invalid_max_exits_two_on_stderr() {
    // What:     `let (code, stdout, stderr) = run_with_stderr(&["--max", "nope",
    //           "fixture/sample.rs"]);`. The `nope` token cannot parse as `usize`.
    // Why:      Exercise clap's typed-value validation through the compiled binary.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const result = runWithStderr(["--max", "nope", "fixture/sample.rs"]);
    // ```
    let (code, stdout, stderr) = run_with_stderr(&["--max", "nope", "fixture/sample.rs"]);

    // What:     assertions over clap's parse error: exit 2, no stdout, useful
    //           stderr mentioning `--max`.
    // Why:      Preserve the linter's invalid-argument failure boundary while
    //           delegating the message formatting to clap.
    assert_eq!(code, 2, "invalid --max should exit 2; stderr: {stderr}");
    assert!(stdout.is_empty(), "invalid --max should not print stdout: {stdout}");
    assert!(stderr.contains("--max"), "stderr should mention --max: {stderr}");
}

// What:     `#[test] fn exempt_file_is_skipped() { ... }`. An over-budget sample
//           whose name ends in `_tests.rs`, linted at a non-exempt temp path.
// Why:      Isolate the NAME-based exemption: relocated out of `fixture/`, the only
//           reason it stays clean is its `*_tests.rs` name, even at a tiny budget.
//
// In TS you'd write (pseudocode):
// ```ts
// it("skips exempt files", () => { ... });
// ```
#[test]
fn exempt_file_is_skipped() {
    // What:     `let (code, _stdout) = run_relocated("fixture/foo_tests.rs",
    //           &["--max", "1"]);`. The leading `_` on `_stdout` marks it
    //           intentionally unused. The temp copy keeps the `*_tests.rs` name, so
    //           its directory is non-exempt but its name still is.
    // Why:      Budget 1 would fail any real file; this one is exempt by name alone.
    let (code, _stdout) = run_relocated("fixture/foo_tests.rs", &["--max", "1"]);

    // What:     `assert_eq!(code, 0, ...)`. Exempt path means a clean exit.
    // Why:      Confirm the exemption holds end to end through the binary.
    assert_eq!(code, 0, "exempt file should exit 0");
}

// What:     `#[test] fn undocumented_fixture_exits_nonzero() { ... }`. Run the
//           binary at the default budget over the undocumented sample, relocated to
//           a non-exempt temp path so the rustdoc rule actually runs on it.
// Why:      A require-rustdoc violation must exit non-zero and name the rule, end
//           to end through the binary.
//
// In TS you'd write (pseudocode):
// ```ts
// it("exits non-zero on undocumented items", () => { ... });
// ```
#[test]
fn undocumented_fixture_exits_nonzero() {
    // What:     `let (code, stdout) = run_relocated("fixture/undocumented.rs",
    //           &[]);`. No `--max`, so the default budget applies and only the
    //           rustdoc rule can fire (the file is tiny). `&[]` is an empty slice of
    //           extra flags. The helper relocates the sample out of `fixture/` so
    //           the rule is not short-circuited.
    // Why:      Trigger and observe a require-rustdoc violation.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const { code, stdout } = runRelocated("fixture/undocumented.rs", []);
    // ```
    let (code, stdout) = run_relocated("fixture/undocumented.rs", &[]);

    // What:     `assert_eq!(code, 1, ...)`. Exit code must be 1 (violations found).
    // Why:      Rustdoc failures are signalled by exit 1.
    assert_eq!(code, 1, "undocumented should exit 1; stdout: {stdout}");

    // What:     `assert!(stdout.contains("require-rustdoc"), ...)`. The output must
    //           name the rule. `.contains(...)` is a substring test.
    // Why:      Confirm the diagnostic comes from require-rustdoc, not max-lines.
    assert!(stdout.contains("require-rustdoc"), "stdout should name the rule: {stdout}");
}

// What:     `#[test] fn documented_fixture_exits_zero() { ... }`. Run the binary at
//           the default budget over the fully documented sample, relocated to a
//           non-exempt temp path so require-rustdoc actually runs on it.
// Why:      A documented file passes the rustdoc rule: exit 0 with no output even
//           with require-rustdoc active.
//
// In TS you'd write (pseudocode):
// ```ts
// it("exits zero on a documented file", () => { ... });
// ```
#[test]
fn documented_fixture_exits_zero() {
    // What:     `let (code, stdout) = run_relocated("fixture/documented.rs", &[]);`.
    //           Every item in this sample carries rustdoc; `&[]` is an empty slice
    //           of extra flags. Relocated out of `fixture/`, so the rule runs.
    // Why:      Observe the passing path where the rule runs but finds nothing.
    let (code, stdout) = run_relocated("fixture/documented.rs", &[]);

    // What:     two assertions: exit 0 and empty stdout.
    // Why:      A documented, under-budget file is clean for every rule.
    assert_eq!(code, 0, "documented should exit 0; stdout: {stdout}");
    assert!(stdout.is_empty(), "documented should print nothing: {stdout}");
}

// What:     `#[test] fn undocumented_fixture_in_place_is_exempt() { ... }`. Run the
//           binary over the REAL `fixture/undocumented.rs` in place, without
//           relocating it.
// Why:      Direct end-to-end proof of the fix: linted from its committed
//           `fixture/` path, the undocumented sample is exempt, so it reports
//           nothing and exits 0 even though it would emit four require-rustdoc
//           findings anywhere else. This also gives the committed fixture a live
//           purpose (otherwise no test reads it in place).
//
// In TS you'd write (pseudocode):
// ```ts
// it("exempts the in-place undocumented fixture", () => { ... });
// ```
#[test]
fn undocumented_fixture_in_place_is_exempt() {
    // What:     `let (code, stdout) = run(&["fixture/undocumented.rs"]);`. Lint the
    //           committed fixture at its real `fixture/` path (not a temp copy).
    // Why:      Exercise the exemption exactly as `lint:rust` reaches the file.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const { code, stdout } = run(["fixture/undocumented.rs"]);
    // ```
    let (code, stdout) = run(&["fixture/undocumented.rs"]);

    // What:     two assertions: exit 0 and empty stdout.
    // Why:      A fixture-directory file is exempt, so the linter reports nothing.
    assert_eq!(code, 0, "in-place fixture should be exempt and exit 0; stdout: {stdout}");
    assert!(stdout.is_empty(), "exempt fixture should print nothing: {stdout}");
}
