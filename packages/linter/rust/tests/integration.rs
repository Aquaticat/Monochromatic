// What:     Integration tests that drive the compiled `rust-linter` binary as a
//           subprocess over the fixtures in `fixtures/`. Files under `tests/` are
//           compiled by cargo into a separate test binary, not into the library.
// Why:      Exercise the real end-user path (argv in, exit code and stdout out),
//           not just internal functions.
// TS map:   a `*.e2e.test.ts` that spawns the built CLI and checks its output.
//
// In TS you'd write (pseudocode):
// ```ts
// import { execFileSync } from "node:child_process";
// describe("rust-linter cli", () => { ... });
// ```

// What:     `use std::process::Command;` imports the standard-library type for
//           spawning a child process.
// Why:      We run the linter binary and read its result.
// TS map:   `import { execFile } from "node:child_process";`
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
// TS map:   `function run(args: string[]): { code: number; stdout: string } { ... }`
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
    // TS map:   no equivalent; cargo hands us the path for free.
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
    // TS map:   `const manifestDir = __dirname + "/..";`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const manifestDir = path.resolve(__dirname, "..");
    // ```
    let manifest_dir = env!("CARGO_MANIFEST_DIR");

    // What:     `let mut command = Command::new(binary);`. Build a child-process
    //           spec for the binary. `mut` because the next lines configure it.
    // Why:      Prepare to launch the linter.
    // TS map:   conceptually `const command = { file: binary, args: [], cwd: "" };`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // // build args for execFileSync below
    // ```
    let mut command = Command::new(binary);

    // What:     `command.current_dir(manifest_dir);`. Set the child's working
    //           directory.
    // Why:      So `fixtures/sample.rs` is found relative to the crate root.
    // TS map:   `options.cwd = manifestDir;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // options.cwd = manifestDir;
    // ```
    command.current_dir(manifest_dir);

    // What:     `command.args(args);`. Append all caller-supplied arguments.
    // Why:      Pass the flags and fixture path through.
    // TS map:   `const argv = args;`
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
    // TS map:   `const output = execFileSync(binary, argv, options);`
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
    // TS map:   `const code = output.status ?? -1;`
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
    // TS map:   `const stdout = output.toString("utf8");`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const stdout = output.toString("utf8");
    // ```
    let stdout = String::from_utf8_lossy(&output.stdout).into_owned();

    // What:     `(code, stdout)`. Tail expression: return the pair as a tuple.
    // Why:      Hand both values back to the test.
    // TS map:   `return { code, stdout };`
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
// TS map:   `it("exits non-zero over budget", () => { ... });`
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
    // TS map:   `const { code, stdout } = run(["--max", "2", "fixtures/sample.rs"]);`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const { code, stdout } = run(["--max", "2", "fixtures/sample.rs"]);
    // ```
    let (code, stdout) = run(&["--max", "2", "fixtures/sample.rs"]);

    // What:     `assert_eq!(code, 1, ...)`. Exit code must be 1 (violations found).
    // Why:      Lint failures are signalled by exit 1.
    // TS map:   `expect(code).toBe(1);`
    assert_eq!(code, 1, "over budget should exit 1; stdout: {stdout}");

    // What:     `assert!(stdout.contains("max-lines"), ...)`. The output must name
    //           the rule. `.contains(...)` is a substring test.
    // Why:      Confirm the diagnostic, not just the exit code.
    // TS map:   `expect(stdout).toContain("max-lines");`
    assert!(stdout.contains("max-lines"), "stdout should name the rule: {stdout}");
}

// What:     `#[test] fn under_budget_exits_zero() { ... }`. Same fixture, generous
//           budget.
// Why:      A clean file exits 0 with no output.
// TS map:   `it("exits zero under budget", () => { ... });`
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
    // TS map:   `const { code, stdout } = run(["--max", "5", "fixtures/sample.rs"]);`
    let (code, stdout) = run(&["--max", "5", "fixtures/sample.rs"]);

    // What:     two assertions: exit 0 and empty stdout.
    // Why:      Clean runs print nothing and succeed.
    // TS map:   `expect(code).toBe(0); expect(stdout).toBe("");`
    assert_eq!(code, 0, "under budget should exit 0");
    assert!(stdout.is_empty(), "under budget should print nothing: {stdout}");
}

// What:     `#[test] fn exempt_file_is_skipped() { ... }`. An over-budget fixture
//           whose name ends in `_tests.rs`.
// Why:      Exempt files are never reported, even with a tiny budget.
// TS map:   `it("skips exempt files", () => { ... });`
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
    // TS map:   `const { code } = run(["--max", "1", "fixtures/foo_tests.rs"]);`
    let (code, _stdout) = run(&["--max", "1", "fixtures/foo_tests.rs"]);

    // What:     `assert_eq!(code, 0, ...)`. Exempt path means a clean exit.
    // Why:      Confirm the exemption holds end to end through the binary.
    // TS map:   `expect(code).toBe(0);`
    assert_eq!(code, 0, "exempt file should exit 0");
}
