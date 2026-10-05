//! What: Configuration and fail-closed controls through the built executable.
//! Why: Commands that could change a repository must not reach Git while policy
//!      execution is missing, configuration errors must stop them first, and
//!      inspection commands must never read configuration at all.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // expect(run(wrappedGit, ['add', 'file']).status).toBe(2); expect(staged()).toEqual([]);
//! ```

/// Import the shared fixtures and bounded process helpers.
use super::support::{
    Fixture, Observed, direct, fixture, git, observe, remove, repository, wrapped,
};
use std::ffi::OsStr;
use std::path::{Path, PathBuf};

/// The only configuration file the native wrapper reads.
const CONFIG_FILE_NAME: &str = "cli-git.config.jsonc";

/// Run a wrapped command in a repository and return what the caller saw.
fn run_wrapped(fixture: &Fixture, repo: &Path, arguments: &[&str]) -> Observed {
    return observe(wrapped(fixture).current_dir(repo).args(arguments), b"");
}

/// Real Git's porcelain status of a repository, as raw bytes.
fn status(fixture: &Fixture, repo: &Path) -> Vec<u8> {
    return git(
        fixture,
        repo,
        &["status", "--porcelain=v1", "--untracked-files=all"],
    )
    .stdout;
}

/// Repository-changing commands stop with exit status 2 and leave the repository untouched.
#[test]
fn repository_changing_commands_are_not_run() {
    let fixture: Fixture = fixture("fail-closed");
    let repo: PathBuf = repository(&fixture, OsStr::new("repo"));
    std::fs::write(repo.join("file.txt"), b"content\n").expect("file");
    let before: Vec<u8> = status(&fixture, repo.as_path());
    assert_eq!(before, b"?? file.txt\n");
    let head_before: Vec<u8> = git(&fixture, repo.as_path(), &["rev-parse", "HEAD"]).stdout;
    for (arguments, subcommand) in [
        (vec!["add", "file.txt"], "add"),
        (
            vec!["commit", "--allow-empty", "--message=blocked"],
            "commit",
        ),
        (vec!["branch", "created"], "branch"),
        (vec!["tag", "v1"], "tag"),
        (vec!["config", "user.name", "Changed"], "config"),
        (vec!["-c", "alias.st=status", "st"], "st"),
        (vec!["update-ref", "refs/heads/moved", "HEAD"], "update-ref"),
    ] {
        let observed: Observed = run_wrapped(&fixture, repo.as_path(), arguments.as_slice());
        assert_eq!(
            observed,
            Observed {
                code: Some(2),
                stdout: Vec::<u8>::new(),
                stderr: format!(
                    "cli-git: policy execution is not implemented in this native development \
                     executable, so git {subcommand} was not run. Repository-changing commands \
                     still require the installed cli-git.\n"
                )
                .into_bytes(),
            },
            "{arguments:?}"
        );
    }
    assert_eq!(status(&fixture, repo.as_path()), before);
    assert_eq!(
        git(&fixture, repo.as_path(), &["rev-parse", "HEAD"]).stdout,
        head_before
    );
    assert_eq!(
        git(
            &fixture,
            repo.as_path(),
            &["for-each-ref", "--format=%(refname)"]
        )
        .stdout,
        b"refs/heads/main\n"
    );
    remove(&fixture);
}

/// Invalid, legacy and unknown-key configuration stops a changing command with the key or file named.
#[test]
fn configuration_errors_stop_before_git() {
    let fixture: Fixture = fixture("config-errors");
    let repo: PathBuf = repository(&fixture, OsStr::new("repo"));
    std::fs::write(repo.join("file.txt"), b"content\n").expect("file");
    let source: PathBuf = repo.join(CONFIG_FILE_NAME);
    for (content, fragment) in [
        (
            r#"{ "plugins": {} }"#,
            "Configuration key plugins is retired",
        ),
        (r#"{ "unknown": 1 }"#, "Unknown configuration key: unknown."),
        (
            r#"{ "policies": { "no-such-policy": "error" } }"#,
            "Unknown policy ID: no-such-policy.",
        ),
        (
            r#"{ "hooks": {}, "hooks": {} }"#,
            "Configuration key hooks is defined more than once",
        ),
        (
            r#"{ "policies": { "final-newline": "fatal" } }"#,
            "Configuration key policies.final-newline has an invalid severity",
        ),
        (
            r#"{ "landing": { "reserveAfterLostRaces": 0 } }"#,
            "Configuration key landing.reserveAfterLostRaces must be a whole number from 1",
        ),
        (
            r#"{ "policies": { "security/forbidden-strings": ["error", { "executable": "./x" }] } }"#,
            "Configuration key policies.security/forbidden-strings[1].executable is retired",
        ),
        (
            r#"{ "policies": null }"#,
            "Configuration key policies must not be null",
        ),
        ("export default {};", "JSONC syntax error at byte 0"),
    ] {
        std::fs::write(&source, content).expect("write configuration");
        let observed: Observed = run_wrapped(&fixture, repo.as_path(), &["add", "file.txt"]);
        let stderr: String = String::from_utf8_lossy(&observed.stderr).into_owned();
        assert_eq!(observed.code, Some(2), "{content}");
        assert_eq!(observed.stdout, Vec::<u8>::new(), "{content}");
        // Exactly one config-invalid event, on standard error for a wrapped command.
        assert!(
            stderr.starts_with(format!("{{\"schemaVersion\":1,\"sequence\":0,\"type\":\"engine-failure\",\"code\":\"config-invalid\",\"message\":\"{}: ", source.display()).as_str()),
            "{content}\n  got: {stderr}"
        );
        assert!(stderr.ends_with("\"}\n"), "{content}\n  got: {stderr}");
        assert_eq!(stderr.matches('\n').count(), 1, "{content}");
        assert!(stderr.contains(fragment), "{content}\n  got: {stderr}");
        assert!(
            !stderr.contains("not implemented"),
            "{content}\n  got: {stderr}"
        );
    }
    // A legacy file alone: the migration diagnostic, and the legacy file is never executed.
    std::fs::remove_file(&source).expect("remove JSONC");
    std::fs::write(
        repo.join("cli-git.config.mjs"),
        "import { writeFileSync } from 'node:fs'; writeFileSync('executed', ''); export default {};\n",
    )
    .expect("legacy configuration");
    let legacy: Observed = run_wrapped(&fixture, repo.as_path(), &["add", "file.txt"]);
    let legacy_stderr: String = String::from_utf8_lossy(&legacy.stderr).into_owned();
    assert_eq!(legacy.code, Some(2));
    assert!(
        legacy_stderr.starts_with(
            format!(
                "{{\"schemaVersion\":1,\"sequence\":0,\"type\":\"engine-failure\",\"code\":\"config-invalid\",\"message\":\"Legacy configuration {} is not executed or read by the native cli-git.",
                repo.join("cli-git.config.mjs").display()
            )
            .as_str()
        ),
        "{legacy_stderr}"
    );
    assert!(!repo.join("executed").exists());
    assert!(!fixture.root.join("executed").exists());
    assert_eq!(
        status(&fixture, repo.as_path()),
        b"?? cli-git.config.mjs\n?? file.txt\n"
    );
    remove(&fixture);
}

/// Inspection commands are identical to real Git even beside invalid and legacy configuration.
#[test]
fn inspection_commands_never_read_configuration() {
    let fixture: Fixture = fixture("fast-path");
    let repo: PathBuf = repository(&fixture, OsStr::new("repo"));
    std::fs::write(repo.join(CONFIG_FILE_NAME), "this is not JSONC").expect("invalid");
    std::fs::write(
        repo.join("cli-git.config.ts"),
        "throw new Error('executed');\n",
    )
    .expect("legacy");
    for arguments in [
        vec!["status", "--porcelain=v1"],
        vec!["log", "--oneline"],
        vec!["rev-parse", "--show-toplevel"],
        vec!["branch", "--list"],
        vec!["tag", "--list"],
        vec!["--version"],
    ] {
        let through_wrapper: Observed = run_wrapped(&fixture, repo.as_path(), arguments.as_slice());
        let through_git: Observed = observe(
            direct(&fixture)
                .current_dir(&repo)
                .args(arguments.as_slice()),
            b"",
        );
        assert_eq!(through_git.code, Some(0), "{arguments:?}");
        assert_eq!(through_wrapper, through_git, "{arguments:?}");
    }
    remove(&fixture);
}

/// A legacy file beside a valid JSONC file is reported by `git cli-git check` only: an
/// ordinary configuration-loading command and `git cli-git fix` print nothing about it.
#[test]
fn legacy_file_beside_jsonc_is_reported_by_check_only() {
    let fixture: Fixture = fixture("legacy-notice");
    let repo: PathBuf = repository(&fixture, OsStr::new("repo"));
    std::fs::write(
        repo.join(CONFIG_FILE_NAME),
        r#"{ "policies": { "mono/dependent-version-bump": "off" } }"#,
    )
    .expect("valid configuration");
    std::fs::write(repo.join("cli-git.config.ts"), "export default {};\n").expect("legacy");
    std::fs::write(repo.join("cli-git.config.mjs"), "export default {};\n").expect("legacy");
    // Positive control: the configuration really is loaded by this ordinary command.
    let ordinary: Observed = run_wrapped(&fixture, repo.as_path(), &["add", "anything"]);
    assert_eq!(ordinary.code, Some(2));
    assert_eq!(ordinary.stdout, Vec::<u8>::new());
    let ordinary_stderr: String = String::from_utf8_lossy(&ordinary.stderr).into_owned();
    assert!(!ordinary_stderr.contains("egacy"), "{ordinary_stderr}");
    assert!(
        !ordinary_stderr.contains("cli-git.config.ts"),
        "{ordinary_stderr}"
    );
    assert!(
        !ordinary_stderr.contains("configuration-warning"),
        "{ordinary_stderr}"
    );
    let fix: Observed = run_wrapped(&fixture, repo.as_path(), &["cli-git", "fix", "--all"]);
    assert_eq!(fix.code, Some(2));
    assert_eq!(fix.stdout, Vec::<u8>::new());
    assert!(
        !String::from_utf8_lossy(&fix.stderr).contains("egacy"),
        "{:?}",
        String::from_utf8_lossy(&fix.stderr)
    );
    let check: Observed = run_wrapped(&fixture, repo.as_path(), &["cli-git", "check", "--all"]);
    assert_eq!(check.code, Some(2));
    assert_eq!(
        String::from_utf8_lossy(&check.stdout),
        format!(
            "{{\"schemaVersion\":1,\"sequence\":0,\"type\":\"configuration-warning\",\"code\":\"legacy-config-ignored\",\"message\":\"Legacy configuration {mjs} is ignored: {jsonc} is authoritative for the native cli-git. Remove the legacy file once no TypeScript cli-git reads it.\",\"path\":\"{mjs}\"}}\n\
             {{\"schemaVersion\":1,\"sequence\":1,\"type\":\"configuration-warning\",\"code\":\"legacy-config-ignored\",\"message\":\"Legacy configuration {ts} is ignored: {jsonc} is authoritative for the native cli-git. Remove the legacy file once no TypeScript cli-git reads it.\",\"path\":\"{ts}\"}}\n",
            mjs = repo.join("cli-git.config.mjs").display(),
            ts = repo.join("cli-git.config.ts").display(),
            jsonc = repo.join(CONFIG_FILE_NAME).display()
        )
    );
    assert!(
        !String::from_utf8_lossy(&check.stderr).contains("egacy"),
        "{:?}",
        String::from_utf8_lossy(&check.stderr)
    );
    // Without the JSONC file the legacy files are a migration error on every command.
    std::fs::remove_file(repo.join(CONFIG_FILE_NAME)).expect("remove JSONC");
    for arguments in [
        vec!["add", "anything"],
        vec!["cli-git", "fix", "--all"],
        vec!["cli-git", "check", "--all"],
    ] {
        let migration: Observed = run_wrapped(&fixture, repo.as_path(), arguments.as_slice());
        assert_eq!(migration.code, Some(2), "{arguments:?}");
        let text: String = format!(
            "{}{}",
            String::from_utf8_lossy(&migration.stdout),
            String::from_utf8_lossy(&migration.stderr)
        );
        assert!(
            text.contains("\"code\":\"config-invalid\",\"message\":\"Legacy configuration "),
            "{arguments:?}: {text}"
        );
    }
    remove(&fixture);
}
