// What:     Integration tests that drive the compiled `rust-linter` binary as a
//           subprocess over the fixtures in `fixtures/`. Files under `tests/` are
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

// What:     `fn run(args: &[&str]) -> (i32, String)`. Helper that runs the binary
//           with the given arguments and returns the `(exit_code, stdout)` pair.
//           `&[&str]` is a borrowed slice of borrowed string slices. `(i32,
//           String)` is a tuple: a 32-bit signed exit code and an owned stdout
//           string.
// Why:      All three tests differ only in arguments and expectations.
//
// In TS you'd write (pseudocode):
// ```ts
// function run(args: string[]): { code: number; stdout: string } { /* ... */ }
// ```
fn run(args: &[&str]) -> (i32, String) {
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
    //           relative `fixtures/...` paths resolve.
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
    // Why:      So `fixtures/sample.rs` is found relative to the crate root.
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
    // Why:      Capture the exit status and stdout.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const output = execFileSync(binary, argv, options);
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
    // Why:      Inspect the printed diagnostics as text.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const stdout = output.toString("utf8");
    // ```
    let stdout = String::from_utf8_lossy(&output.stdout).into_owned();

    // What:     `(code, stdout)`. Tail expression: return the pair as a tuple.
    // Why:      Hand both values back to the test.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return { code, stdout };
    // ```
    (code, stdout)
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
    // What:     `let (code, stdout) = run(&["--max", "2", "fixtures/sample.rs"]);`.
    //           Destructure the returned tuple into two bindings. `&[...]` borrows
    //           an array of argument strings; the fixture has three code lines so
    //           a budget of 2 fails.
    // Why:      Trigger and observe a violation.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const { code, stdout } = run(["--max", "2", "fixtures/sample.rs"]);
    // ```
    let (code, stdout) = run(&["--max", "2", "fixtures/sample.rs"]);

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
    // What:     `let (code, stdout) = run(&["--max", "5", "fixtures/sample.rs"]);`.
    //           Budget 5 over three code lines.
    // Why:      Observe the passing path.
    let (code, stdout) = run(&["--max", "5", "fixtures/sample.rs"]);

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
    // What:     `let (code, stdout) = run(&["--max=5", "fixtures/sample.rs"]);`.
    //           The `=` keeps the flag name and value in one argv token.
    // Why:      Confirm clap handles the previously supported joined spelling.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const { code, stdout } = run(["--max=5", "fixtures/sample.rs"]);
    // ```
    let (code, stdout) = run(&["--max=5", "fixtures/sample.rs"]);

    // What:     two assertions: exit 0 and empty stdout.
    // Why:      The joined spelling should be equivalent to `--max 5`.
    assert_eq!(code, 0, "joined --max should exit 0");
    assert!(stdout.is_empty(), "joined --max should print nothing: {stdout}");
}

// What:     `#[test] fn exempt_file_is_skipped() { ... }`. An over-budget fixture
//           whose name ends in `_tests.rs`.
// Why:      Exempt files are never reported, even with a tiny budget.
//
// In TS you'd write (pseudocode):
// ```ts
// it("skips exempt files", () => { ... });
// ```
#[test]
fn exempt_file_is_skipped() {
    // What:     `let (code, _stdout) = run(&["--max", "1", "fixtures/foo_tests.rs"]);`.
    //           The leading `_` on `_stdout` marks it intentionally unused.
    // Why:      Budget 1 would fail any real file; this one is exempt by name.
    let (code, _stdout) = run(&["--max", "1", "fixtures/foo_tests.rs"]);

    // What:     `assert_eq!(code, 0, ...)`. Exempt path means a clean exit.
    // Why:      Confirm the exemption holds end to end through the binary.
    assert_eq!(code, 0, "exempt file should exit 0");
}

// What:     `#[test] fn undocumented_fixture_exits_nonzero() { ... }`. Run the
//           binary at the default budget over a fixture whose items lack rustdoc.
// Why:      A require-rustdoc violation must exit non-zero and name the rule, end
//           to end through the binary.
//
// In TS you'd write (pseudocode):
// ```ts
// it("exits non-zero on undocumented items", () => { ... });
// ```
#[test]
fn undocumented_fixture_exits_nonzero() {
    // What:     `let (code, stdout) = run(&["fixtures/undocumented.rs"]);`. No
    //           `--max`, so the default budget applies and only the rustdoc rule
    //           can fire (the file is tiny).
    // Why:      Trigger and observe a require-rustdoc violation.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const { code, stdout } = run(["fixtures/undocumented.rs"]);
    // ```
    let (code, stdout) = run(&["fixtures/undocumented.rs"]);

    // What:     `assert_eq!(code, 1, ...)`. Exit code must be 1 (violations found).
    // Why:      Rustdoc failures are signalled by exit 1.
    assert_eq!(code, 1, "undocumented should exit 1; stdout: {stdout}");

    // What:     `assert!(stdout.contains("require-rustdoc"), ...)`. The output must
    //           name the rule. `.contains(...)` is a substring test.
    // Why:      Confirm the diagnostic comes from require-rustdoc, not max-lines.
    assert!(stdout.contains("require-rustdoc"), "stdout should name the rule: {stdout}");
}

// What:     `#[test] fn documented_fixture_exits_zero() { ... }`. Run the binary at
//           the default budget over a fully documented fixture.
// Why:      A clean file exits 0 with no output, even with require-rustdoc active.
//
// In TS you'd write (pseudocode):
// ```ts
// it("exits zero on a documented file", () => { ... });
// ```
#[test]
fn documented_fixture_exits_zero() {
    // What:     `let (code, stdout) = run(&["fixtures/documented.rs"]);`. Every item
    //           in this fixture carries rustdoc.
    // Why:      Observe the passing path.
    let (code, stdout) = run(&["fixtures/documented.rs"]);

    // What:     two assertions: exit 0 and empty stdout.
    // Why:      A documented, under-budget file is clean for every rule.
    assert_eq!(code, 0, "documented should exit 0; stdout: {stdout}");
    assert!(stdout.is_empty(), "documented should print nothing: {stdout}");
}
