// What:     Integration tests for the `forbidden-strings` binary. Each
//           test spawns the release binary as a subprocess and asserts
//           on its stdout/stderr/exit-code. Cargo's `tests/*.rs` layout
//           compiles each file as a separate test executable that links
//           the binary as a sibling artifact -- the `CARGO_BIN_EXE_<name>`
//           env var (compile-time `env!`) points at the binary.
// Why:      Several BUGs in the audit live in `main.rs` -- read-error
//           handling, path skip logic, the --all walker integration --
//           and can only be verified at the binary boundary. Unit tests
//           on internal helpers would miss the wiring.
// TS map:   integration tests under `__tests__/integration.test.ts`
//           that spawn the CLI via execFile and assert on output.

use std::fs;
use std::path::PathBuf;
use std::process::Command;

// What:     `const BIN: &str = env!("CARGO_BIN_EXE_forbidden-strings");`
//           uses the compile-time env var Cargo sets for integration
//           tests of a binary crate. The value is the absolute path to
//           the freshly built binary; `env!` panics at compile time if
//           the env var is absent (it never is for this crate's tests).
// Why:      Avoid hardcoding `target/release/forbidden-strings` -- that
//           breaks under `cargo test` (debug profile) and on platforms
//           where the path layout differs.
// TS map:   `const BIN = process.env.CARGO_BIN_EXE_forbidden_strings!;`.
//
// In TS you'd write (pseudocode):
// ```ts
// const BIN = process.env.CARGO_BIN_EXE_forbidden_strings!;
// ```
const BIN: &str = env!("CARGO_BIN_EXE_forbidden-strings");

// What:     `fn unique_tmp(label) -> PathBuf` returns a fresh empty
//           directory under `std::env::temp_dir()`. Uses PID + label so
//           parallel test runs do not collide.
// Why:      Tests create rules files and target files; sharing a dir
//           across tests is a flake source.
// TS map:   `path.join(os.tmpdir(), `<label>-<pid>`)`.
//
// In TS you'd write (pseudocode):
// ```ts
// function uniqueTmp(label: string): string {
//   return path.join(os.tmpdir(), `${label}-${process.pid}`);
// }
// ```
fn unique_tmp(label: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!(
        "fs-int-{}-{}",
        label,
        std::process::id()
    ));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).expect("create tmp dir");
    dir
}

// What:     `#[test] fn read_error_surfaces_as_hit_and_nonzero_exit()`.
//           BUG 4 regression test. Creates an unreadable file (chmod
//           000) containing a deny-listed literal. Pre-fix, the scanner
//           silently substituted empty content and exited 0. Post-fix
//           the scanner emits a `<path>: read error: ...` line on
//           stderr and exits 1.
// Why:      Secret-scanning CI must NOT pass on files it could not
//           inspect; a permission error is a signal, not a silent
//           success.
// TS map:   `test("read error surfaces as hit", () => { ... });`.
//
// In TS you'd write (pseudocode):
// ```ts
// test("read error surfaces as hit and non-zero exit", () => { ... });
// ```
#[test]
fn read_error_surfaces_as_hit_and_nonzero_exit() {
    let dir = unique_tmp("bug4");
    let rules = dir.join("rules.txt");
    fs::write(&rules, "SECRET_NEEDLE_XYZ_LONG_ENOUGH\n").expect("write rules");
    let target = dir.join("unreadable.txt");
    fs::write(&target, "SECRET_NEEDLE_XYZ_LONG_ENOUGH\n").expect("write target");
    // What:     `fs::set_permissions(&target, fs::Permissions::from_mode(0))`
    //           chmod 000 the target. Use the Unix-specific extension
    //           trait to set bare-bits permissions; we don't bother
    //           with a Windows fallback because the test environment is
    //           Linux and the bug specifically targets Unix read errors.
    // Why:      Force an io::ErrorKind::PermissionDenied at read time.
    // TS map:   `fs.chmodSync(target, 0o000);`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // fs.chmodSync(target, 0);
    // ```
    use std::os::unix::fs::PermissionsExt;
    fs::set_permissions(&target, fs::Permissions::from_mode(0))
        .expect("chmod 000");

    let output = Command::new(BIN)
        .args(["--rules"])
        .arg(&rules)
        .arg(&target)
        .output()
        .expect("spawn binary");

    // What:     Restore permissions so cleanup can remove the file.
    // Why:      Tempdir cleanup on a chmod-000 file would itself fail
    //           with EACCES, leaving the fixture behind for the next
    //           run.
    let _ = fs::set_permissions(&target, fs::Permissions::from_mode(0o644));

    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(
        !output.status.success(),
        "BUG 4: unreadable file must produce non-zero exit; got success.\n\
         stdout: {}\nstderr: {}",
        String::from_utf8_lossy(&output.stdout),
        stderr,
    );
    assert!(
        stderr.contains("read error"),
        "BUG 4: stderr must contain `read error`; got: {}",
        stderr
    );

    let _ = fs::remove_dir_all(&dir);
}

// What:     `#[test] fn nul_byte_in_file_does_not_skip_scan()`. BUG 5
//           regression test. Creates a file whose content begins with
//           the deny-listed literal then a NUL byte. Pre-fix, the
//           presence of NUL in the first 8 KiB caused `is_likely_binary`
//           to return true and the entire scan to short-circuit, so
//           the literal was never detected even though it appeared
//           BEFORE the NUL. Post-fix the binary-skip is removed and AC
//           scans raw bytes content-agnostic.
// Why:      A redacted secret in a binary blob (lockfile sidecar,
//           bundled artifact, accidentally-committed image) is exactly
//           the kind of thing a deny-list scanner should catch. The
//           skip-on-NUL heuristic was an unsound shortcut.
// TS map:   `test("NUL byte does not skip scan", () => { ... });`.
//
// In TS you'd write (pseudocode):
// ```ts
// test("NUL byte does not skip scan", () => { ... });
// ```
// What:     `#[test] fn explicit_arg_with_skip_basename_is_still_scanned()`.
//           BUG 6 regression test. The pre-fix `is_skipped_file` matched
//           by basename anywhere in the tree, so an explicit argument
//           like `sub/forbidden-strings.local.txt` was silently skipped
//           even though it lives in a different directory than the
//           scanner's actual rule file. Post-fix the skip logic is
//           path-anchored AND only applied to walker output (--all
//           mode), not to explicit positional args.
// Why:      "The user asked" -- positional args are an explicit request
//           that overrides every basename-based heuristic. The pre-fix
//           skip was an over-aggressive guard that hid real positive
//           findings under CI invocations like
//           `forbidden-strings <path>` for paths whose basenames
//           happened to collide.
// TS map:   `test("explicit args bypass skip basename heuristic", () => { ... });`.
//
// In TS you'd write (pseudocode):
// ```ts
// test("explicit arg with skip-basename is still scanned", () => { ... });
// ```
#[test]
fn explicit_arg_with_skip_basename_is_still_scanned() {
    let dir = unique_tmp("bug6");
    let rules = dir.join("rules.txt");
    fs::write(&rules, "SECRET_NEEDLE_XYZ_LONG_ENOUGH\n").expect("write rules");
    // Create a subdir whose target file's basename collides with the
    // hardcoded skip list. Pre-fix the scanner skipped it silently.
    let sub = dir.join("sub");
    fs::create_dir_all(&sub).expect("create sub");
    let target = sub.join("forbidden-strings.local.txt");
    fs::write(&target, "SECRET_NEEDLE_XYZ_LONG_ENOUGH\n").expect("write target");

    let output = Command::new(BIN)
        .args(["--rules"])
        .arg(&rules)
        .arg(&target)
        .output()
        .expect("spawn binary");

    assert!(
        !output.status.success(),
        "BUG 6: explicit positional arg must be scanned regardless of basename; got success.\n\
         stdout: {}\nstderr: {}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr),
    );
    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(
        stderr.contains("forbidden-strings.local.txt"),
        "BUG 6: stderr must reference the target file; got: {}",
        stderr
    );

    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn nul_byte_in_file_does_not_skip_scan() {
    let dir = unique_tmp("bug5");
    let rules = dir.join("rules.txt");
    fs::write(&rules, "SECRET_NEEDLE_XYZ_LONG_ENOUGH\n").expect("write rules");
    let target = dir.join("with_nul.txt");
    // Literal + NUL + tail. The literal is entirely before the NUL.
    fs::write(&target, b"SECRET_NEEDLE_XYZ_LONG_ENOUGH\0and then more")
        .expect("write target");

    let output = Command::new(BIN)
        .args(["--rules"])
        .arg(&rules)
        .arg(&target)
        .output()
        .expect("spawn binary");

    assert!(
        !output.status.success(),
        "BUG 5: file containing NUL must still be scanned; got success.\n\
         stdout: {}\nstderr: {}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr),
    );
    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(
        stderr.contains("with_nul.txt"),
        "BUG 5: stderr must reference the target file; got: {}",
        stderr
    );

    let _ = fs::remove_dir_all(&dir);
}
