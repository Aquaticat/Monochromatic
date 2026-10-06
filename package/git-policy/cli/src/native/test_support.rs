//! What: Disposable directories and real-Git fixtures shared by unit tests.
//! Why: Every test that touches the filesystem or a repository owns a fresh directory
//!      under the temporary directory and never reads the real home or global Git configuration.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // const root = await mkdtemp(join(tmpdir(), 'native-')); await git(root, ['init']);
//! ```

/// Native string, path and process types used by the fixtures.
use std::ffi::OsStr;
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, Command, Output, Stdio};

/// The real Git 2.56.0 executable installed in the verification image.
pub(crate) const REAL_GIT: &str = "/usr/bin/git";

/// Create one empty fixture directory owned by this test process and test name.
pub(crate) fn fixture(name: &str) -> PathBuf {
    let root: PathBuf =
        std::env::temp_dir().join(format!("native-unit-{}-{name}", std::process::id()));
    if root.exists() {
        std::fs::remove_dir_all(&root).expect("remove stale fixture");
    }
    std::fs::create_dir(&root).expect("fresh fixture");
    // Canonical form so comparisons with Git's canonical output are exact.
    return std::fs::canonicalize(&root).expect("canonical fixture");
}

/// Remove only the fixture directory a test created.
pub(crate) fn remove(root: &Path) {
    std::fs::remove_dir_all(root).expect("remove only the fixture");
}

/// Run real Git in a fixture with no system or global configuration and a fixed identity.
pub(crate) fn git_output<S: AsRef<OsStr>>(directory: &Path, arguments: &[S]) -> Output {
    return Command::new(REAL_GIT)
        .current_dir(directory)
        .env_clear()
        .env("PATH", "/usr/bin:/bin")
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .env("GIT_CONFIG_GLOBAL", "/nonexistent-global-config")
        .env("GIT_AUTHOR_NAME", "Fixture")
        .env("GIT_AUTHOR_EMAIL", "fixture@example.invalid")
        .env("GIT_COMMITTER_NAME", "Fixture")
        .env("GIT_COMMITTER_EMAIL", "fixture@example.invalid")
        .args(arguments)
        .output()
        .expect("native Git fixture command");
}

/// Run real Git in a fixture and require success.
pub(crate) fn git<S: AsRef<OsStr>>(directory: &Path, arguments: &[S]) -> Output {
    let output: Output = git_output(directory, arguments);
    assert!(
        output.status.success(),
        "git failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    return output;
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

/// What: Write an executable file, as a PATH candidate fixture, through a child `tee` process.
/// Why:  Tests run on several threads. If this process opened the file for writing, a
///       child forked by another test at that moment would inherit the open file until it
///       starts its own program, and running the fixture in that window fails with
///       "Text file busy". A file only ever opened for writing by `tee` cannot be
///       inherited by any other child of this process.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// spawnSync('tee', [path], { input: content }); chmodSync(path, 0o755);
/// ```
#[cfg(unix)]
pub(crate) fn executable(path: &Path, content: &[u8]) {
    use std::io::Write;
    use std::os::unix::fs::PermissionsExt;
    // `Stdio::piped()` connects this process to `tee`'s input; its copy to standard output is discarded.
    let mut writer: Child = Command::new("tee")
        .arg(path)
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .spawn()
        .expect("start fixture writer");
    // `.take()` moves the pipe out of the child record so it can be closed below.
    let mut input: ChildStdin = writer.stdin.take().expect("fixture writer input");
    input.write_all(content).expect("write candidate");
    // `drop` closes the pipe now, which is how `tee` learns the content is complete.
    drop(input);
    assert!(
        writer.wait().expect("fixture writer exit").success(),
        "fixture writer failed for {path:?}"
    );
    // Changing the mode names the file by path and never opens it.
    std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o755))
        .expect("mark candidate executable");
}

/// What: Variables that isolate a Git child started through the production runners from the
///       real system and global configuration, with the fixed fixture identity.
/// Why:  Production runners add an overlay to the inherited environment instead of clearing
///       it, so tests pass these pairs as that overlay.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const overlay = [['GIT_CONFIG_NOSYSTEM', '1'], ['GIT_CONFIG_GLOBAL', '/nonexistent-global-config'], ...];
/// ```
pub(crate) fn isolated_overlay() -> Vec<(std::ffi::OsString, std::ffi::OsString)> {
    // `mut` allows collecting the pairs one at a time.
    let mut pairs: Vec<(std::ffi::OsString, std::ffi::OsString)> = Vec::new();
    for (name, value) in [
        ("GIT_CONFIG_NOSYSTEM", "1"),
        ("GIT_CONFIG_GLOBAL", "/nonexistent-global-config"),
        ("GIT_AUTHOR_NAME", "Fixture"),
        ("GIT_AUTHOR_EMAIL", "fixture@example.invalid"),
        ("GIT_COMMITTER_NAME", "Fixture"),
        ("GIT_COMMITTER_EMAIL", "fixture@example.invalid"),
    ] {
        pairs.push((
            std::ffi::OsString::from(name),
            std::ffi::OsString::from(value),
        ));
    }
    return pairs;
}

/// What: A transaction Git context running the real fixture Git with the isolating overlay.
/// Why:  Recovery and landing tests start Git through the production runner.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const context = { gitPath: '/usr/bin/git', overlay: isolatedOverlay(), globalPrefix: [] };
/// ```
pub(crate) fn git_context() -> crate::transaction_git::GitContext {
    return crate::transaction_git::GitContext {
        real_git: PathBuf::from(REAL_GIT),
        overlay: isolated_overlay(),
        global_prefix: Vec::new(),
    };
}

/// What: Real Git's standard output with one trailing newline removed, as text.
/// Why:  Tests compare object IDs and ref values.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// git(directory, args).stdout.toString().trimEnd()
/// ```
pub(crate) fn git_text<S: AsRef<OsStr>>(directory: &Path, arguments: &[S]) -> String {
    let output: Output = git(directory, arguments);
    let text: String = String::from_utf8(output.stdout).expect("UTF-8 Git output");
    return String::from(text.strip_suffix('\n').unwrap_or(text.as_str()));
}
