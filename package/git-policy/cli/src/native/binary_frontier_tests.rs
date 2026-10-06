//! What: The refusal frontier through the built executable: every command that needs work
//!       this executable does not do stops with exit status 2, names what is missing and
//!       leaves the repository untouched.
//! Why: A commit, a `git add` an unported content policy should check, a real push, a worktree copy or a command beside
//!      a landing transaction that reached Git would run without the installed wrapper's
//!      protection, and nothing would show it. Each refusal has a positive control: the
//!      neighbouring command that is forwarded really changes the repository.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // expect(run(wrappedGit, ['commit', '-m', 'x']).status).toBe(2); expect(head()).toBe(before);
//! ```

/// Import the shared fixtures, the bounded process helpers and the refusal texts.
use super::support::{
    Fixture, Observed, fixture, git, observe, porcelain, remove, repository, run_direct,
    run_wrapped, silent_success, stderr_of, stopped_with, wrapped,
};
use git_policy_cli::policy_checks::{DEPENDENT_VERSION_BUMP_NEEDS, MARKDOWN_AUTOFIX_NEEDS};
use git_policy_cli::policy_registry::PolicyId;
use git_policy_cli::policy_trigger::Trigger;
use git_policy_cli::refusal_frontier::LEASE_VARIABLES;
use git_policy_cli::unported::{Unported, unported_notice};
use std::ffi::OsStr;
use std::path::{Path, PathBuf};

/// The commit `HEAD` names, as text.
fn head(fixture: &Fixture, repo: &Path) -> String {
    let output: std::process::Output = git(fixture, repo, &["rev-parse", "HEAD"]);
    return String::from_utf8_lossy(&output.stdout).into_owned();
}

/// Every ref of a repository, one name per line.
fn refs(fixture: &Fixture, repo: &Path) -> String {
    let output: std::process::Output = git(fixture, repo, &["for-each-ref", "--format=%(refname)"]);
    return String::from_utf8_lossy(&output.stdout).into_owned();
}

/// A repository with a linked worktree `linked` on branch `topic`.
fn repository_with_linked_worktree(fixture: &Fixture) -> (PathBuf, PathBuf) {
    let repo: PathBuf = repository(fixture, OsStr::new("repo"));
    let linked: PathBuf = fixture.root.join("linked");
    git(
        fixture,
        repo.as_path(),
        &["worktree", "add", "--quiet", "-b", "topic", "../linked"],
    );
    return (repo, linked);
}

/// Every `git commit` except a dry run is refused; the index and `HEAD` stay as they were.
#[test]
fn a_real_commit_is_refused() {
    let fixture: Fixture = fixture("frontier-commit");
    let repo: PathBuf = repository(&fixture, OsStr::new("repo"));
    let nested: PathBuf = repo.join("nested");
    std::fs::create_dir(&nested).expect("nested directory");
    std::fs::write(repo.join("file.txt"), b"content\n").expect("file");
    git(&fixture, repo.as_path(), &["add", "--", "file.txt"]);
    let head_before: String = head(&fixture, repo.as_path());
    let refused: Observed =
        stopped_with(unported_notice(&Unported::CommitTransaction, "commit").as_str());
    for arguments in [
        vec!["commit", "-m", "refused"],
        vec!["commit", "-m", "refused", "--", "file.txt"],
        vec!["commit", "--allow-empty", "--message=refused"],
        vec!["commit", "-a", "-m", "refused"],
        vec!["commit", "--amend", "--no-edit"],
        vec!["commit", "--no-enforce-only", "-m", "refused"],
        vec!["commit", "--dry-run", "--no-dry-run", "-m", "refused"],
        vec!["commit", "--no-such-option"],
        vec!["-c", "user.name=Other", "commit", "-m", "refused"],
        vec!["--cli-git-keep-going", "commit", "-m", "refused"],
    ] {
        assert_eq!(
            run_wrapped(&fixture, repo.as_path(), arguments.as_slice()),
            refused,
            "{arguments:?}"
        );
    }
    // The refusal comes before any policy: below the top level it is still the commit refusal.
    assert_eq!(
        run_wrapped(&fixture, nested.as_path(), &["commit", "-m", "refused"]),
        refused
    );
    assert_eq!(head(&fixture, repo.as_path()), head_before);
    assert_eq!(porcelain(&fixture, repo.as_path()), "A  file.txt\n");
    // Positive control: a dry run is forwarded, with the commit-only insertion, and commits nothing.
    let native: Observed = run_direct(
        &fixture,
        repo.as_path(),
        &["commit", "-o", "--dry-run", "-m", "dry", "--", "file.txt"],
    );
    assert_eq!(native.code, Some(0));
    assert_eq!(
        run_wrapped(
            &fixture,
            repo.as_path(),
            &["commit", "--dry-run", "-m", "dry", "--", "file.txt"]
        ),
        native
    );
    assert_eq!(head(&fixture, repo.as_path()), head_before);
    // Git itself makes every status-format option a dry run, so those are forwarded too.
    for format in ["--short", "--porcelain", "--long", "-z"] {
        let through_git: Observed = run_direct(
            &fixture,
            repo.as_path(),
            &["commit", "-o", format, "--", "file.txt"],
        );
        assert_eq!(through_git.code, Some(0), "{format}");
        assert_eq!(
            run_wrapped(
                &fixture,
                repo.as_path(),
                &["commit", format, "--", "file.txt"]
            ),
            through_git,
            "{format}"
        );
        assert_eq!(head(&fixture, repo.as_path()), head_before, "{format}");
    }
    assert_eq!(porcelain(&fixture, repo.as_path()), "A  file.txt\n");
    remove(&fixture);
}

/// The final-newline warning of `git add` about `file.txt`.
const FILE_WARNING: &str = "{\"schemaVersion\":1,\"sequence\":0,\"type\":\"finding\",\"trigger\":\"pre-forward\",\"policyId\":\"final-newline\",\"severity\":\"warn\",\"code\":\"final-newline/noncanonical-final-newline\",\"message\":\"Non-empty text file must end with exactly one LF byte.\",\"path\":\"file.txt\",\"fix\":\"none\"}\n";

/// The forbidden-root-context error of `git add` about the top-level `CONTEXT.md`.
const CONTEXT_ERROR: &str = "{\"schemaVersion\":1,\"sequence\":0,\"type\":\"finding\",\"trigger\":\"pre-forward\",\"policyId\":\"mono/forbidden-root-context\",\"severity\":\"error\",\"code\":\"mono/forbidden-root-context/root-context-forbidden\",\"message\":\"Root CONTEXT.md is forbidden; read source code directly.\",\"path\":\"CONTEXT.md\",\"fix\":\"none\"}\n";

/// `git add` runs the ported content policies over what it would stage, and is refused
/// while an unported content policy is on.
#[test]
fn add_runs_ported_content_policies_and_refuses_unported_ones() {
    let fixture: Fixture = fixture("frontier-add");
    let repo: PathBuf = repository(&fixture, OsStr::new("repo"));
    std::fs::write(repo.join("file.txt"), b"no final newline").expect("file");
    std::fs::write(repo.join("second.txt"), b"second\n").expect("second file");
    std::fs::write(repo.join("CONTEXT.md"), b"context\n").expect("context file");
    // The built-in policy warns about the bytes the add stages, and Git stages them.
    assert_eq!(
        run_wrapped(&fixture, repo.as_path(), &["add", "--", "file.txt"]),
        Observed {
            code: Some(0),
            stdout: Vec::<u8>::new(),
            stderr: FILE_WARNING.as_bytes().to_vec(),
        }
    );
    assert_eq!(
        porcelain(&fixture, repo.as_path()),
        "A  file.txt\n?? CONTEXT.md\n?? second.txt\n"
    );
    // A listed ported policy at error stops the add, and nothing is staged.
    let configuration: PathBuf = repo.join("cli-git.config.jsonc");
    std::fs::write(
        &configuration,
        "{ \"policies\": { \"mono/forbidden-root-context\": \"error\" } }\n",
    )
    .expect("configuration");
    assert_eq!(
        run_wrapped(&fixture, repo.as_path(), &["add", "--", "CONTEXT.md"]),
        Observed {
            code: Some(1),
            stdout: Vec::<u8>::new(),
            stderr: CONTEXT_ERROR.as_bytes().to_vec(),
        }
    );
    // Each unported content policy refuses under its own name, and nothing is staged.
    for (name, policy, needs) in [
        (
            "markdown/autofix",
            PolicyId::MarkdownAutofix,
            MARKDOWN_AUTOFIX_NEEDS,
        ),
        (
            "mono/dependent-version-bump",
            PolicyId::DependentVersionBump,
            DEPENDENT_VERSION_BUMP_NEEDS,
        ),
    ] {
        std::fs::write(
            &configuration,
            format!("{{ \"policies\": {{ \"{name}\": \"error\" }} }}\n"),
        )
        .expect("configuration");
        assert_eq!(
            run_wrapped(&fixture, repo.as_path(), &["add", "--", "second.txt"]),
            stopped_with(unported_notice(&Unported::PolicyNeeds { policy, needs }, "add").as_str()),
            "{name}"
        );
    }
    assert_eq!(
        porcelain(&fixture, repo.as_path()),
        "A  file.txt\n?? CONTEXT.md\n?? cli-git.config.jsonc\n?? second.txt\n"
    );
    // Positive control: with the unported policy escaped, the same command stages the file.
    assert_eq!(
        run_wrapped(
            &fixture,
            repo.as_path(),
            &[
                "add",
                "--no-enforce-mono/dependent-version-bump",
                "--",
                "second.txt"
            ]
        ),
        silent_success()
    );
    assert_eq!(
        porcelain(&fixture, repo.as_path()),
        "A  file.txt\nA  second.txt\n?? CONTEXT.md\n?? cli-git.config.jsonc\n"
    );
    remove(&fixture);
}

/// A real push stops at the manual-push gate; a dry run is forwarded with `--atomic`.
#[test]
fn a_real_push_is_refused_at_the_manual_push_gate() {
    let fixture: Fixture = fixture("frontier-push");
    let repo: PathBuf = repository(&fixture, OsStr::new("repo"));
    git(
        &fixture,
        fixture.root.as_path(),
        &["init", "--quiet", "--bare", "remote.git"],
    );
    let remote: PathBuf = fixture.root.join("remote.git");
    git(
        &fixture,
        repo.as_path(),
        &["remote", "add", "origin", "../remote.git"],
    );
    let refused: Observed =
        stopped_with(unported_notice(&Unported::Lifecycle(Trigger::ManualPush), "push").as_str());
    for arguments in [
        vec!["push", "origin", "main"],
        vec!["push", "--quiet", "origin", "main"],
        vec!["push", "--dry-run", "--no-dry-run", "origin", "main"],
    ] {
        assert_eq!(
            run_wrapped(&fixture, repo.as_path(), arguments.as_slice()),
            refused,
            "{arguments:?}"
        );
    }
    assert_eq!(refs(&fixture, remote.as_path()), "");
    // A dry run publishes nothing and is forwarded with the atomic-push insertion.
    let native: Observed = run_direct(
        &fixture,
        repo.as_path(),
        &["push", "--atomic", "--dry-run", "origin", "main"],
    );
    assert_eq!(native.code, Some(0));
    assert_eq!(
        run_wrapped(
            &fixture,
            repo.as_path(),
            &["push", "--dry-run", "origin", "main"]
        ),
        native
    );
    assert_eq!(refs(&fixture, remote.as_path()), "");
    // Positive control: with the only manual-push policy escaped, the same push publishes.
    assert_eq!(
        run_wrapped(
            &fixture,
            repo.as_path(),
            &[
                "push",
                "--quiet",
                "--no-enforce-final-newline",
                "origin",
                "main"
            ]
        ),
        silent_success()
    );
    assert_eq!(refs(&fixture, remote.as_path()), "refs/heads/main\n");
    remove(&fixture);
}

/// From a linked worktree, creating a worktree and running a possible alias are refused.
#[test]
fn worktree_creation_and_aliases_are_refused_from_a_linked_worktree() {
    let fixture: Fixture = fixture("frontier-worktree");
    let (repo, linked): (PathBuf, PathBuf) = repository_with_linked_worktree(&fixture);
    assert_eq!(
        run_wrapped(
            &fixture,
            linked.as_path(),
            &["worktree", "add", "--quiet", "-b", "second", "../second"]
        ),
        stopped_with(unported_notice(&Unported::WorktreeCopy, "worktree").as_str())
    );
    assert_eq!(
        run_wrapped(
            &fixture,
            linked.as_path(),
            &[
                "-c",
                "alias.wta=worktree add",
                "wta",
                "--quiet",
                "-b",
                "third",
                "../third"
            ]
        ),
        stopped_with(unported_notice(&Unported::AliasResolution, "wta").as_str())
    );
    assert!(!fixture.root.join("second").exists());
    assert!(!fixture.root.join("third").exists());
    assert_eq!(
        refs(&fixture, repo.as_path()),
        "refs/heads/main\nrefs/heads/topic\n"
    );
    // Positive controls: the opt-out, another worktree subcommand and the main worktree are forwarded.
    assert_eq!(
        run_wrapped(
            &fixture,
            linked.as_path(),
            &[
                "worktree",
                "add",
                "--no-worktree-copy",
                "--quiet",
                "-b",
                "second",
                "../second"
            ]
        )
        .code,
        Some(0)
    );
    assert!(fixture.root.join("second/.git").exists());
    assert_eq!(
        run_wrapped(&fixture, linked.as_path(), &["worktree", "prune"]),
        silent_success()
    );
    assert_eq!(
        run_wrapped(
            &fixture,
            repo.as_path(),
            &["worktree", "add", "--quiet", "-b", "fourth", "../fourth"]
        )
        .code,
        Some(0)
    );
    assert!(fixture.root.join("fourth/.git").exists());
    remove(&fixture);
}

/// Registered transactions, an interrupted worktree copy and an inherited lease stop a guarded command.
#[test]
fn leftover_state_and_leases_refuse_guarded_commands() {
    let fixture: Fixture = fixture("frontier-state");
    let (repo, linked): (PathBuf, PathBuf) = repository_with_linked_worktree(&fixture);
    let guarded: [&str; 3] = ["reset", "--soft", "HEAD"];
    // Positive control: in a quiet repository the guarded command runs.
    assert_eq!(
        run_wrapped(&fixture, repo.as_path(), &guarded),
        silent_success()
    );
    let registry: PathBuf = repo.join(".git/cli-git-transactions");
    std::fs::create_dir_all(registry.join("0123-transaction")).expect("registry entry");
    assert_eq!(
        run_wrapped(&fixture, repo.as_path(), &guarded),
        stopped_with(
            unported_notice(&Unported::TransactionRecovery(registry.clone()), "reset").as_str()
        )
    );
    // The linked worktree has its own registry, so it is not stopped by the main one.
    assert_eq!(
        run_wrapped(&fixture, linked.as_path(), &guarded),
        silent_success()
    );
    // A read-only command is forwarded beside the same state.
    assert_eq!(
        run_wrapped(
            &fixture,
            repo.as_path(),
            &["rev-parse", "--is-inside-work-tree"]
        )
        .stdout,
        b"true\n"
    );
    std::fs::remove_dir_all(&registry).expect("remove registry");
    let legacy: PathBuf = repo.join(".git/cli-git-transaction");
    std::fs::create_dir(&legacy).expect("legacy transaction directory");
    assert_eq!(
        run_wrapped(&fixture, repo.as_path(), &guarded),
        stopped_with(
            unported_notice(&Unported::TransactionRecovery(legacy.clone()), "reset").as_str()
        )
    );
    std::fs::remove_dir(&legacy).expect("remove legacy directory");
    // An interrupted worktree copy concerns the linked worktree, not the main one.
    let journals: PathBuf = repo.join(".git/cli-git-worktree-copy/v1");
    std::fs::create_dir_all(journals.join("settlement.lock")).expect("settlement lock");
    assert_eq!(
        run_wrapped(&fixture, linked.as_path(), &guarded),
        silent_success()
    );
    std::fs::write(journals.join("0123.json"), b"{}").expect("journal");
    assert_eq!(
        run_wrapped(&fixture, linked.as_path(), &guarded),
        stopped_with(
            unported_notice(&Unported::WorktreeCopyRecovery(journals.clone()), "reset").as_str()
        )
    );
    assert_eq!(
        run_wrapped(&fixture, repo.as_path(), &guarded),
        silent_success()
    );
    std::fs::remove_file(journals.join("0123.json")).expect("remove journal");
    // Each lease variable stops the guarded command, and none stops a read-only one.
    for variable in LEASE_VARIABLES {
        assert_eq!(
            observe(
                wrapped(&fixture)
                    .current_dir(&repo)
                    .env(variable, "inherited")
                    .args(guarded),
                b""
            ),
            stopped_with(unported_notice(&Unported::InheritedLease(variable), "reset").as_str()),
            "{variable}"
        );
        assert_eq!(
            observe(
                wrapped(&fixture)
                    .current_dir(&repo)
                    .env(variable, "inherited")
                    .args(["rev-parse", "--is-inside-work-tree"]),
                b""
            )
            .stdout,
            b"true\n",
            "{variable}"
        );
    }
    assert_eq!(
        stderr_of(&run_wrapped(&fixture, repo.as_path(), &guarded)),
        ""
    );
    remove(&fixture);
}
