//! What:
//!  Migration of a prepared commit's shadow-only objects into the real store as one pack,
//!  optionally kept by a `.keep` file naming the transaction.
//! Why:
//!  The real target may name the commit only after the compare-and-swap, so its objects must be
//!  in the real store first, and the keep stops prune or repack from removing them mid-landing
//!  (`src/policy-engine/commit-landing-objects.ts`).
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! await migrateShadowObjects({ gitPath, cwd, shadowPath, newOid, oldBase, keepMessage });
//! ```

/// Shadow-scoped Git requests.
use super::shadow_git::shadow_request;
/// Journal target value.
use super::transaction_journal::Base;
/// Running real Git and failing on a nonzero exit.
use super::transaction_git::{GitContext, GitFailure, GitRequest, run_git_checked};
/// `Path` is a borrowed filesystem path.
use std::path::Path;

/// What:
///  Packs the commit's objects that the shadow holds and the real store lacks,
///  and indexes the pack into the real store.
/// Why:
///   `pack-objects --local` leaves out objects reached through the shadow's alternates,
///  so the pack carries only what the landing introduces.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const pack = await runShadowGit({ args: ['pack-objects', '--revs', '--local', '--stdout', '--quiet'] });
/// await runTransactionGit({ args: ['index-pack', '--stdin', `--keep=${keepMessage}`], input: pack });
/// ```
pub fn migrate_shadow_objects(
    context: &GitContext,
    cwd: &Path,
    shadow: &Path,
    new_oid: &str,
    old_base: &Base,
    keep_message: Option<&str>,
) -> Result<String, GitFailure> {
    let mut revisions: String = format!("{new_oid}\n");
    if let Base::Commit(oid) = old_base {
        revisions.push_str(&format!("^{oid}\n"));
    }
    let mut pack_request = shadow_request(
        shadow,
        cwd,
        &["pack-objects", "--revs", "--local", "--stdout", "--quiet"],
    );
    pack_request.input = Some(revisions.into_bytes());
    let pack = run_git_checked(context, &pack_request)?;
    let mut index_arguments: Vec<String> = vec!["index-pack".to_string(), "--stdin".to_string()];
    if let Some(message) = keep_message {
        index_arguments.push(format!("--keep={message}"));
    }
    let mut index_request = GitRequest::new(cwd, &index_arguments);
    index_request.input = Some(pack.stdout);
    let indexed = run_git_checked(context, &index_request)?;
    let report: String = String::from_utf8(indexed.stdout)
        .map_err(|error| { return GitFailure(format!("git index-pack printed non-UTF-8 text: {error}")); })?;
    let trimmed: &str = report.trim();
    let Some((_, name)) = trimmed.split_once('\t') else {
        return Err(GitFailure(format!(
            "git index-pack reported no pack: {}",
            serde_json::to_string(trimmed).unwrap_or_default()
        )));
    };
    return Ok(name.to_string());
}

/// Migration controls stay out of the production code path.
#[cfg(test)]
#[path = "landing_objects_tests.rs"]
mod tests;
