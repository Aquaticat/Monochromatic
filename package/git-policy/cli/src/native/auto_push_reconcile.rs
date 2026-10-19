//! What:
//!  Publishing a landed commit when the remote branch advanced after the commit landed:
//!       the merge of the remote tip and the local tip is computed in the object store,
//!       committed without a worktree or an index, and pushed with a plain push.
//! Why:
//!  A rejected `push` of a branch that the remote moved cannot succeed again, and an ordinary merge in the active
//!  worktree can be blocked, or made unsafe, by another consumer's uncommitted files.
//!  `git merge-tree --write-tree` and `git commit-tree` read and write only objects, so the active worktree,
//!  its index and its untracked files are never touched while merging, and both histories stay reachable from the
//!  published tip.
//!  Only after the push succeeds is the branch fast-forwarded, and only in a worktree with nothing to lose.
//!  A branch whose published history was rewritten (an amend or a rebase) is never merged:
//!  the merge would bring the replaced commits back, so its rejection stays visible as it always was.

/// The per-branch record of the last push this wrapper made.
use super::auto_push_record::{LastPushedRead, read_last_pushed_record};
/// The coordinator's Git, its command builder, queries and error type.
use super::auto_push_single_flight::{
    PushAttempt, PushGit, SingleFlightError, git_command, git_output,
    resolve_push_coordination_paths, run_query,
};
/// The deadline-bound runner of network commands and the limits it applies.
use super::bounded_push::{STOP_GRACE, apply_low_speed_defaults, push_deadline, run_bounded_push};
/// The diagnostic log of the wrapper.
use super::diagnostic_log::debug;
/// Owned OS strings for Git arguments.
use std::ffi::OsString;

/// Tag used for diagnostics from this module.
const TAG: &str = "cli-git";

/// Prefix of every line this module adds to a push's output, so the terminal filter can keep it.
pub const RECONCILE_LINE_PREFIX: &str = "cli-git: auto-push: ";

/// Start of the line that explains why a rejected push stays unpublished; the generic "run `git push`" note is then
/// wrong advice and is not printed.
pub const RECONCILE_FAILED_PREFIX: &str = "cli-git: auto-push: not published: ";

/// How many times the remote tip is fetched, merged and pushed before the push is reported as failed.
pub const MAX_RECONCILE_ATTEMPTS: u32 = 3;

/// The marker Git prints for a push the remote refused as stale; the word is not translated.
const REJECTED_MARKER: &str = "[rejected]";

/// Where the plain push goes: the branch's upstream remote and the ref it tracks there.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Destination = { remote: string; mergeRef: string };
/// ```
#[derive(Clone, Debug, Eq, PartialEq)]
struct Destination {
    /// Remote name from `branch.<name>.remote`.
    remote: String,
    /// Full ref from `branch.<name>.merge`, for example `refs/heads/main`.
    merge_ref: String,
}

/// What:
///  Whether a push's output shows that the remote refused the update as stale.
/// Why:
///   Only a stale-update refusal can be cured by merging; a hook refusal, an authentication failure or an offline error
///  must be reported as they are.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const wasRejectedAsStale = (output: string) => output.includes('[rejected]');
/// ```
pub fn was_rejected_as_stale(output: &str) -> bool {
    return output.contains(REJECTED_MARKER);
}

/// A failed attempt that explains itself and keeps the push output that came before.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// { exitCode: 1, output: `${previous}\n${RECONCILE_FAILED_PREFIX}${reason}` }
/// ```
fn unpublished(previous: &str, exit_code: i64, reason: &str) -> PushAttempt {
    return PushAttempt {
        exit_code: if exit_code == 0 { 1 } else { exit_code },
        output: format!("{previous}\n{RECONCILE_FAILED_PREFIX}{reason}"),
    };
}

/// Argument list from string literals and owned text.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// ['merge-tree', '--write-tree', ...]
/// ```
fn argv(parts: &[&str]) -> Vec<OsString> {
    return parts.iter().map(OsString::from).collect();
}

/// What:
///  Whether the first commit is the second or one of its ancestors, or nothing when Git cannot tell.
/// Why:
///   Exit `0` and `1` are the answers; any other exit means an object is missing, and that is not an answer.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// async function isAncestor({ ancestor, descendant }): Promise<boolean | undefined>;
/// ```
fn is_ancestor(
    git: &PushGit,
    ancestor: &str,
    descendant: &str,
) -> Result<Option<bool>, SingleFlightError> {
    let output = run_query(
        git,
        &argv(&["merge-base", "--is-ancestor", ancestor, descendant]),
    )?;
    return Ok(match output.code {
        Some(0) => Some(true),
        Some(1) => Some(false),
        _ => None,
    });
}

/// What:
///  The upstream remote and ref, when the plain push goes to the same place the branch tracks.
/// Why:
///   With `push.default=current`, a push remote or a triangular setup, the rejection came from a destination this
///  module does not fetch, so merging with the tracked tip would publish the wrong thing.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// async function readDestination({ branch }): Promise<Destination | undefined>;
/// ```
fn read_destination(
    git: &PushGit,
    branch_ref: &str,
) -> Result<Option<Destination>, SingleFlightError> {
    let Some(name) = branch_ref.strip_prefix("refs/heads/") else {
        return Ok(None);
    };
    let upstream = run_query(
        git,
        &argv(&["rev-parse", "--symbolic-full-name", "@{upstream}"]),
    )?;
    let pushed = run_query(
        git,
        &argv(&["rev-parse", "--symbolic-full-name", "@{push}"]),
    )?;
    // A failed query prints nothing, so a failed `@{push}` differs from a resolved `@{upstream}` here as well.
    if upstream.code != Some(0) || upstream.stdout != pushed.stdout {
        return Ok(None);
    }
    let remote = run_query(
        git,
        &argv(&["config", "--get", &format!("branch.{name}.remote")]),
    )?;
    let merge = run_query(
        git,
        &argv(&["config", "--get", &format!("branch.{name}.merge")]),
    )?;
    // A key that is not set prints nothing, and the checks below reject the empty remote and the empty ref.
    let remote_name = String::from_utf8_lossy(&remote.stdout).trim().to_owned();
    let merge_ref = String::from_utf8_lossy(&merge.stdout).trim().to_owned();
    if remote_name.is_empty() || remote_name == "." || !merge_ref.starts_with("refs/heads/") {
        return Ok(None);
    }
    return Ok(Some(Destination {
        remote: remote_name,
        merge_ref,
    }));
}

/// What:
///  The commits the branch is known to have published, any one of which the branch may descend from.
/// Why:
///   A branch that contains none of what this wrapper last published or what the tracking ref last showed was
///  amended or rebased; merging the remote tip into it would bring the replaced commits back.
///   The record names the last published tip even after a failed attempt, and the tracking ref covers a branch
///  published by hand; the tracking ref alone is not enough, because a reconcile leaves it on a merge that the
///  branch does not contain, and a branch that moved on after a push by hand or a force push shows only the ref.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// async function publishedBases({ branchRef }): Promise<string[]>;
/// ```
fn published_bases(git: &PushGit, branch_ref: &str) -> Result<Vec<String>, SingleFlightError> {
    let paths = resolve_push_coordination_paths(git, branch_ref)?;
    let mut bases: Vec<String> = Vec::new();
    if let Ok(LastPushedRead::Record(record)) = read_last_pushed_record(&paths.record_path)
        && let Some(tip) = record.published()
    {
        bases.push(tip.to_owned());
    }
    bases.push(git_output(
        git,
        &argv(&["rev-parse", "--verify", "@{upstream}^{commit}"]),
    )?);
    return Ok(bases);
}

/// What:
///  Fetch the remote branch into a private ref and return the commit it names.
/// Why:
///   `FETCH_HEAD` is shared by every fetch in the repository, so another process could replace it between the fetch
///  and the read; a ref named for this process cannot be replaced, and it is deleted before this returns.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// async function fetchRemoteTip({ destination }): Promise<string | PushAttempt>;
/// ```
fn fetch_remote_tip(
    git: &PushGit,
    destination: &Destination,
) -> Result<Result<String, PushAttempt>, SingleFlightError> {
    let private_ref = format!("refs/cli-git/auto-push/fetch-{}", std::process::id());
    let refspec = format!("+{}:{private_ref}", destination.merge_ref);
    let arguments = argv(&[
        "fetch",
        "--no-tags",
        "--quiet",
        &destination.remote,
        &refspec,
    ]);
    let mut command = git_command(git, &arguments);
    apply_low_speed_defaults(&mut command, &git.environment);
    let fetched = run_bounded_push(command, push_deadline(&git.environment), STOP_GRACE)?;
    if fetched.exit_code != 0 {
        return Ok(Err(fetched));
    }
    let tip = git_output(
        git,
        &argv(&[
            "rev-parse",
            "--verify",
            &format!("{private_ref}^{{commit}}"),
        ]),
    );
    // The private ref is scaffolding; a failed deletion leaves one small ref that the next run overwrites.
    let _deleted = run_query(git, &argv(&["update-ref", "-d", &private_ref]));
    return Ok(Ok(tip?));
}

/// What:
///  Commit the merge of two tips from objects alone and return its OID, or the paths that conflict.
/// Why:
///   `merge-tree --write-tree` exits `1` for a conflicted merge and lists the paths; nothing is written to a worktree.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// async function commitMerge({ local, remote, message }): Promise<{ oid } | { conflicts }>;
/// ```
fn commit_merge(
    git: &PushGit,
    local: &str,
    remote: &str,
    message: &str,
) -> Result<Result<String, Vec<String>>, SingleFlightError> {
    let merged = run_query(
        git,
        &argv(&[
            "merge-tree",
            "--write-tree",
            "--no-messages",
            "--name-only",
            local,
            remote,
        ]),
    )?;
    let text = String::from_utf8_lossy(&merged.stdout).into_owned();
    let mut lines = text.lines();
    let tree = lines.next().unwrap_or_default().trim().to_owned();
    if merged.code == Some(1) {
        let paths: Vec<String> = lines
            .map(str::trim)
            .filter(|line| {
                return !line.is_empty();
            })
            .map(str::to_owned)
            .collect();
        return Ok(Err(paths));
    }
    if merged.code != Some(0) {
        return Err(SingleFlightError::Git {
            arguments: format!("merge-tree --write-tree {local} {remote}"),
            code: merged.code,
            stderr: String::from_utf8_lossy(&merged.stderr).into_owned(),
        });
    }
    let mut commit_tree = vec!["commit-tree"];
    if signs_commits(git)? {
        commit_tree.push("-S");
    }
    commit_tree.extend(["-p", local, "-p", remote, "-m", message, &tree]);
    let oid = git_output(git, &argv(&commit_tree))?;
    return Ok(Ok(oid));
}

/// What:
///  Whether `commit.gpgsign` asks for signed commits.
/// Why:
///   `git commit-tree` signs only when given `-S` and never reads `commit.gpgsign`, so the merge would be the one
///  unsigned commit of a signed branch, which a remote that requires verified signatures rejects.
///   An unset key is `git config` exit `1`; any other failure is reported like every failed command.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// async function signsCommits(git): Promise<boolean>;
/// ```
fn signs_commits(git: &PushGit) -> Result<bool, SingleFlightError> {
    let asked = run_query(
        git,
        &argv(&["config", "--type=bool", "--get", "commit.gpgsign"]),
    )?;
    if asked.code == Some(1) {
        return Ok(false);
    }
    if asked.code != Some(0) {
        return Err(SingleFlightError::Git {
            arguments: String::from("config --type=bool --get commit.gpgsign"),
            code: asked.code,
            stderr: String::from_utf8_lossy(&asked.stderr).into_owned(),
        });
    }
    return Ok(asked.stdout.trim_ascii() == b"true");
}

/// What:
///  Fast-forward the pushed branch and this worktree to the published merge, or the reason that was not done.
/// Why:
///   A branch left behind the remote makes the next commit rejected again, and the person at the keyboard would have
///  to merge by hand; the merge contains the branch tip, so the move is a pure fast-forward.
///   It is attempted only where nothing can be lost or surprised: the worktree has the branch checked out at the tip
///  that was pushed and has no change to a tracked file.
///   The status read takes no optional lock, and `git merge --ff-only` refuses, without changing anything, a move that
///  would overwrite an untracked file or a change made after the status read.
///   Every refusal is a reason for the report, never a failure: the merge is already published.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// async function advanceLocalBranch({ git, branchRef, local, mergeOid }): Promise<{ reason?: string }>;
/// ```
fn advance_local_branch(
    git: &PushGit,
    branch_ref: &str,
    local: &str,
    merge_oid: &str,
) -> Result<Result<(), String>, SingleFlightError> {
    let checked_out = run_query(git, &argv(&["symbolic-ref", "--quiet", "HEAD"]))?;
    if checked_out.code != Some(0) {
        return Ok(Err(String::from("HEAD is detached")));
    }
    if String::from_utf8_lossy(&checked_out.stdout).trim() != branch_ref {
        return Ok(Err(String::from(
            "this worktree has another branch checked out",
        )));
    }
    let head = run_query(git, &argv(&["rev-parse", "--verify", "HEAD^{commit}"]))?;
    if String::from_utf8_lossy(&head.stdout).trim() != local {
        return Ok(Err(String::from(
            "the branch moved after the commit landed",
        )));
    }
    let status = run_query(
        git,
        &argv(&[
            "--no-optional-locks",
            "status",
            "--porcelain=v1",
            "--untracked-files=no",
        ]),
    )?;
    if status.code != Some(0) {
        return Ok(Err(String::from("the worktree status could not be read")));
    }
    if !status.stdout.is_empty() {
        return Ok(Err(String::from(
            "the worktree has uncommitted changes to tracked files",
        )));
    }
    let moved = run_query(git, &argv(&["merge", "--ff-only", "--quiet", merge_oid]))?;
    if moved.code != Some(0) {
        let detail = String::from_utf8_lossy(&moved.stderr);
        return Ok(Err(format!(
            "Git refused the fast-forward: {}",
            detail.lines().next().unwrap_or_default().trim()
        )));
    }
    return Ok(Ok(()));
}

/// What:
///  Merge the remote tip into the pushed branch's tip and publish the result, a bounded number of times.
/// Why:
///   Another worktree advancing the remote makes the plain push fail for good, while both histories are valid and
///  must both be kept; the merge is published as a new commit above the local tip, so the landed commit stays
///  reachable and nothing is forced.
///   Once the merge is published, the branch and its worktree are fast-forwarded to it when that cannot lose or
///  overwrite anything; otherwise they are left as they are and the report says why.
///   A rewritten branch, a different push destination, a conflict, an exhausted retry budget and every failure of a
///  command are reported, and only the first two leave the original rejection unchanged.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// async function reconcileDivergentPush({ git, branchRef, rejected }): Promise<PushAttempt>;
/// ```
pub fn reconcile_divergent_push(
    git: &PushGit,
    branch_ref: &str,
    rejected: PushAttempt,
) -> Result<PushAttempt, SingleFlightError> {
    if !was_rejected_as_stale(&rejected.output) {
        return Ok(rejected);
    }
    let Some(destination) = read_destination(git, branch_ref)? else {
        debug(
            TAG,
            "the push destination is not the upstream; no reconcile",
        );
        return Ok(rejected);
    };
    let local = git_output(
        git,
        &argv(&["rev-parse", "--verify", &format!("{branch_ref}^{{commit}}")]),
    )?;
    let bases = published_bases(git, branch_ref)?;
    let mut contains_a_base = false;
    for base in &bases {
        if is_ancestor(git, base, &local)? == Some(true) {
            contains_a_base = true;
            break;
        }
    }
    if !contains_a_base {
        debug(
            TAG,
            &format!(
                "{local} does not contain any published tip of {}; history was rewritten, no reconcile",
                bases.join(", ")
            ),
        );
        return Ok(rejected);
    }
    let short = destination
        .merge_ref
        .strip_prefix("refs/heads/")
        .unwrap_or(&destination.merge_ref)
        .to_owned();
    let message = format!(
        "Merge {}/{short} into {short}\n\nCreated by cli-git auto-push because {}/{short} advanced after the commit landed.",
        destination.remote, destination.remote
    );
    let mut previous = rejected.output.clone();
    for attempt in 1..=MAX_RECONCILE_ATTEMPTS {
        let remote_tip = match fetch_remote_tip(git, &destination)? {
            Ok(tip) => tip,
            Err(failed) => {
                return Ok(unpublished(
                    &format!("{previous}\n{}", failed.output),
                    failed.exit_code,
                    &format!(
                        "{}/{short} has commits this branch lacks, and fetching them failed; nothing was pushed and the worktree was not touched.",
                        destination.remote
                    ),
                ));
            }
        };
        match (
            is_ancestor(git, &remote_tip, &local)?,
            is_ancestor(git, &local, &remote_tip)?,
        ) {
            (Some(true), _) => {
                debug(
                    TAG,
                    "the remote tip is behind the branch; the rejection was not a divergence",
                );
                return Ok(rejected);
            }
            (_, Some(true)) => {
                return Ok(PushAttempt {
                    exit_code: 0,
                    output: format!(
                        "{RECONCILE_LINE_PREFIX}{}/{short} already contains {local}; nothing to push.",
                        destination.remote
                    ),
                });
            }
            (Some(false), Some(false)) => {}
            _ => {
                return Ok(unpublished(
                    &previous,
                    rejected.exit_code,
                    "Git could not relate the branch to the remote tip; nothing was pushed and the worktree was not touched.",
                ));
            }
        }
        let merge_oid = match commit_merge(git, &local, &remote_tip, &message)? {
            Ok(oid) => oid,
            Err(paths) => {
                return Ok(unpublished(
                    &previous,
                    rejected.exit_code,
                    &format!(
                        "merging {}/{short} into {short} conflicts in: {}. Nothing was pushed and the worktree was not touched; \
                         merge {}/{short} in a separate worktree, resolve the conflicts and push.",
                        destination.remote,
                        paths.join(", "),
                        destination.remote
                    ),
                ));
            }
        };
        debug(
            TAG,
            &format!(
                "attempt {attempt}: pushing the merge {merge_oid} of {local} and {remote_tip}"
            ),
        );
        let arguments = argv(&[
            "push",
            &destination.remote,
            &format!("{merge_oid}:{}", destination.merge_ref),
        ]);
        let mut command = git_command(git, &arguments);
        apply_low_speed_defaults(&mut command, &git.environment);
        let pushed = run_bounded_push(command, push_deadline(&git.environment), STOP_GRACE)?;
        if pushed.exit_code == 0 {
            let branch = branch_ref
                .strip_prefix("refs/heads/")
                .unwrap_or(branch_ref);
            let followed = match advance_local_branch(git, branch_ref, &local, &merge_oid)? {
                Ok(()) => format!("{branch} and the worktree were fast-forwarded to it."),
                Err(reason) => {
                    debug(TAG, &format!("{branch} was not fast-forwarded: {reason}"));
                    format!(
                        "{branch} itself and the worktree are unchanged ({reason}); update {branch} with `git merge --ff-only {}/{short}` \
                         when the worktree allows.",
                        destination.remote
                    )
                }
            };
            return Ok(PushAttempt {
                exit_code: 0,
                output: format!(
                    "{}\n{RECONCILE_LINE_PREFIX}{}/{short} had new commits, so the merge {merge_oid} of {branch} and {}/{short} \
                     was published. {followed}",
                    pushed.output, destination.remote, destination.remote
                )
                .trim_start_matches('\n')
                .to_owned(),
            });
        }
        if !was_rejected_as_stale(&pushed.output) {
            return Ok(pushed);
        }
        previous = pushed.output;
    }
    return Ok(unpublished(
        &previous,
        rejected.exit_code,
        &format!(
            "{}/{short} advanced again during each of {MAX_RECONCILE_ATTEMPTS} attempts, so nothing was pushed and the worktree was not touched. \
             Push again when the remote is quiet.",
            destination.remote
        ),
    ));
}

/// Reconcile behavior is controlled in the test module.
#[cfg(test)]
#[path = "auto_push_reconcile_tests.rs"]
mod tests;
