//! What: Argument builders, disposable real-Git fixtures and table oracles for unit tests.
//! Why: Every command module is checked against the Git 2.56.0 binary in the verification
//!      image, inside a fresh directory, never against the real home or global configuration.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // const root = await mkdtemp(join(tmpdir(), 'native-')); await git(root, ['init']);
//! ```

/// Tokenizer table type checked by the oracles in this file.
use super::command_options::OptionSpec;
/// Native string, path, stream and process types used by the fixtures.
use std::ffi::OsString;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Output, Stdio};

/// The real Git 2.56.0 executable installed in the verification image.
pub(crate) const REAL_GIT: &str = "/usr/bin/git";

/// Own a fixture argument vector without changing any spelling.
pub(crate) fn os_arguments(values: &[&str]) -> Vec<OsString> {
    let mut result: Vec<OsString> = Vec::<OsString>::new();
    for value in values {
        result.push(OsString::from(value));
    }
    return result;
}

/// Build one argument from raw bytes that need not be UTF-8.
#[cfg(unix)]
pub(crate) fn byte_argument(bytes: &[u8]) -> OsString {
    use std::os::unix::ffi::OsStringExt;
    return OsString::from_vec(bytes.to_vec());
}

/// Create one empty fixture directory owned by this test process and test name.
pub(crate) fn fixture(name: &str) -> PathBuf {
    let root: PathBuf =
        std::env::temp_dir().join(format!("native-command-{}-{name}", std::process::id()));
    if root.exists() {
        std::fs::remove_dir_all(&root).expect("remove stale fixture");
    }
    std::fs::create_dir(&root).expect("fresh fixture");
    return std::fs::canonicalize(&root).expect("canonical fixture");
}

/// Remove only the fixture directory a test created.
pub(crate) fn remove(root: &Path) {
    std::fs::remove_dir_all(root).expect("remove only the fixture");
}

/// Start real Git in a fixture with no system or global configuration and a fixed identity.
fn git_command(directory: &Path) -> Command {
    let mut command: Command = Command::new(REAL_GIT);
    command
        .current_dir(directory)
        .env_clear()
        .env("PATH", "/usr/bin:/bin")
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .env("GIT_CONFIG_GLOBAL", "/nonexistent-global-config")
        .env("GIT_AUTHOR_NAME", "Fixture")
        .env("GIT_AUTHOR_EMAIL", "fixture@example.invalid")
        .env("GIT_COMMITTER_NAME", "Fixture")
        .env("GIT_COMMITTER_EMAIL", "fixture@example.invalid")
        .env("GIT_EDITOR", "true");
    return command;
}

/// Run real Git with native arguments and report its status and streams without judging them.
pub(crate) fn git_output(directory: &Path, arguments: &[OsString]) -> Output {
    return git_command(directory)
        .args(arguments)
        .stdin(Stdio::null())
        .output()
        .expect("native Git fixture command");
}

/// Run real Git with text arguments and require success.
pub(crate) fn git(directory: &Path, arguments: &[&str]) -> Output {
    let output: Output = git_output(directory, os_arguments(arguments).as_slice());
    assert!(
        output.status.success(),
        "git {arguments:?} failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    return output;
}

/// Run real Git with text arguments where failure is the observation.
pub(crate) fn git_status(directory: &Path, arguments: &[&str]) -> Output {
    return git_output(directory, os_arguments(arguments).as_slice());
}

/// Run real Git with bytes on standard input, as `git rev-parse --parseopt` needs.
pub(crate) fn git_with_input(directory: &Path, arguments: &[OsString], input: &[u8]) -> Output {
    let mut child: std::process::Child = git_command(directory)
        .args(arguments)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("native Git fixture command");
    child
        .stdin
        .take()
        .expect("piped standard input")
        .write_all(input)
        .expect("write option specification");
    return child.wait_with_output().expect("native Git fixture result");
}

/// Create a repository with one empty commit on `main` inside a fixture directory.
pub(crate) fn repository(parent: &Path, name: &str) -> PathBuf {
    let root: PathBuf = parent.join(name);
    std::fs::create_dir(&root).expect("repository directory");
    git(
        root.as_path(),
        &["init", "--quiet", "--initial-branch=main"],
    );
    git(
        root.as_path(),
        &["commit", "--quiet", "--allow-empty", "--message=initial"],
    );
    return root;
}

/// Require what Git's `parse_options_check` requires of a table (parse-options.c:642-736):
/// unique short letters, unique long names, and spellings that can introduce an option.
pub(crate) fn assert_table_invariants(table: &[OptionSpec]) {
    let mut shorts: Vec<u8> = Vec::<u8>::new();
    let mut longs: Vec<&str> = Vec::<&str>::new();
    for spec in table {
        assert!(spec.short.is_some() || spec.long.is_some(), "{spec:?}");
        if let Some(short) = spec.short {
            assert!(short.is_ascii_graphic() && short != b'-', "{spec:?}");
            assert!(!shorts.contains(&short), "duplicate short {spec:?}");
            shorts.push(short);
        }
        if let Some(long) = spec.long {
            assert!(!long.is_empty() && !long.contains('='), "{spec:?}");
            assert!(!long.starts_with('-'), "{spec:?}");
            assert!(!longs.contains(&long), "duplicate long {spec:?}");
            longs.push(long);
        }
    }
}
