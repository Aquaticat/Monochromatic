//! What: The shipped policies as the engine sees them: one check per policy, built from
//!       the pure rule cores and the repository facts they ask for.
//! Why: The engine owns order, severity and stopping; the rule cores own decisions from
//!      arguments; this module joins them and fetches a repository fact only when a core
//!      asks. The five content policies need candidate content, which is not ported: they
//!      report nothing where a lifecycle has no candidates and are unavailable where it
//!      has some, so an unchecked file can never read as a clean one.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // const findings = await policy.check({ context });
//! ```

/// What: `use` brings names from sibling files into this file; `super::` means "the parent
///       module", where every sibling file of this crate is declared.
/// Why:  Each check combines one rule core with the facts interface.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { decideRequireRoot, resolveRequireRoot } from './rule_require_root.ts';
/// ```
use super::diagnostics::EngineFailureCode;
use super::effective_target::{EffectiveTarget, classify_effective_target};
use super::policy_engine::{PolicyChecks, PolicyFinding, PolicyOutcome};
use super::policy_registry::PolicyId;
use super::policy_trigger::Trigger;
use super::repository_facts::RepositoryFacts;
use super::repository_location::{RepositoryLocation, effective_directory};
use super::rule_add_explicit::{BULK_ADD_CODE, decide_add_explicit};
use super::rule_branch_worktree::{
    BRANCH_CREATION_CODE, BranchWorktreeDecision, branch_creation_message, decide_branch_worktree,
};
use super::rule_linked_worktree::{
    LINKED_WORKTREE_REQUIRED_CODE, LinkedWorktreeDecision, decide_linked_worktree,
    resolve_linked_worktree,
};
use super::rule_require_root::{
    NOT_AT_ROOT_CODE, RequireRootDecision, RequireRootFacts, RequireRootVerdict,
    decide_require_root, resolve_require_root,
};
use super::worktree_identity::worktree_root;
/// What: `OsString` is owned operating-system text of raw bytes. Sibling the reader might
///       expect: `String`, which must be valid UTF-8.
/// Why:  The command's arguments are kept exactly as Git will receive them.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // string, but byte-preserving.
/// ```
use std::ffi::OsString;
/// `PathBuf` is an owned filesystem path of raw bytes.
use std::path::PathBuf;

/// What: What the current lifecycle offers a content policy. An `enum` is a closed set of
///       named alternatives; `NotPorted` carries words naming what is missing.
///       `#[derive(...)]` asks the compiler to generate copying, debug printing and `==`.
/// Why:  "There are no files to check" and "there are files this executable cannot read
///       yet" must never be confused: the first is clean, the second is unavailable.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type CandidateSource = { kind: 'none' } | { kind: 'not-ported'; needs: string };
/// ```
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum CandidateSource {
    /// The lifecycle has no candidate content, as for a forwarded command other than `git add`.
    None,
    /// The lifecycle has candidates, and reading them is not ported.
    NotPorted(&'static str),
}

/// What: The shipped policies over one invocation. `<F: RepositoryFacts>` says the record
///       works with any one type `F` that provides the facts interface, chosen where the
///       record is built: real Git in the executable, a script in tests.
/// Why:  Holding the provider by value keeps its remembered answers and its query count
///       for the whole invocation, and lets a test read them back afterwards.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type ShippedChecks<F extends RepositoryFacts> = { facts: F; arguments: string[]; candidates: CandidateSource; allowedWorktreeDirs: string[] };
/// ```
#[derive(Clone, Debug)]
pub struct ShippedChecks<F: RepositoryFacts> {
    /// Where repository facts come from.
    pub facts: F,
    /// The command's arguments without wrapper controls; for a direct command, the Git
    /// global options written before `cli-git`.
    pub arguments: Vec<OsString>,
    /// What the lifecycle offers content policies.
    pub candidates: CandidateSource,
    /// Tool-cache directories exempt from linked-worktree enforcement.
    pub allowed_worktree_dirs: Vec<PathBuf>,
}

/// What: The outcome of a check whose repository fact could not be read.
///       `String` is the owned reason the facts provider gave.
/// Why:  Every fact these checks ask for is read from the repository, so its absence is
///       `content-unavailable`, never a failure of the policy itself.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const factUnavailable = (message: string): PolicyOutcome => ({ kind: 'failed', code: 'content-unavailable', message });
/// ```
fn fact_unavailable(message: String) -> PolicyOutcome {
    return PolicyOutcome::Failed {
        code: EngineFailureCode::ContentUnavailable,
        message,
    };
}

/// What: The outcome "nothing found". `Vec::<PolicyFinding>::new()` is an empty owned list.
/// Why:  Most checks end this way; one helper keeps them identical.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const clean = (): PolicyOutcome => ({ kind: 'findings', findings: [] });
/// ```
fn clean() -> PolicyOutcome {
    return PolicyOutcome::Findings(Vec::<PolicyFinding>::new());
}

/// What: The outcome "exactly one finding about the command". `&'static str` is text
///       baked into the program; `String` is owned text.
/// Why:  The four command policies each report at most one finding, without a path.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const rejected = (code: string, message: string): PolicyOutcome => ({ kind: 'findings', findings: [{ code, message }] });
/// ```
fn rejected(code: &'static str, message: String) -> PolicyOutcome {
    // `vec![...]` is a macro building an owned list from literal items.
    return PolicyOutcome::Findings(vec![PolicyFinding {
        code,
        message,
        // `None` is the "absent" case of `Option`.
        path: None,
        location: None,
        fix_available: false,
    }]);
}

/// What: The require-root check. `&mut dyn RepositoryFacts` lends "any facts provider" for
///       writing (`dyn` means the concrete type is chosen at run time, like a TS interface
///       value); `&[OsString]` borrows the arguments.
/// Why:  A forwarded command is first judged by its arguments, because many commands are
///       exempt. A direct check has no Git command whose exemption could apply. The root
///       and the directory both come from Git's own answer.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// async function checkRequireRoot(facts: RepositoryFacts, args: string[], trigger: PolicyTrigger): Promise<PolicyOutcome>;
/// ```
fn check_require_root(
    facts: &mut dyn RepositoryFacts,
    arguments: &[OsString],
    trigger: Trigger,
) -> PolicyOutcome {
    // `&[]` is an empty flag list: wrapper controls were removed before this point.
    if trigger == Trigger::PreForward
        && decide_require_root(arguments, &[]) != RequireRootDecision::NeedsRepositoryRoot
    {
        return clean();
    }
    // `match` unpacks the answer; `Ok`/`Err` are the success/failure variants.
    let location: RepositoryLocation = match facts.location() {
        Ok(found) => found,
        Err(message) => return fact_unavailable(message),
    };
    // `let Some(x) = ... else { ... };` unwraps the top level or returns: no worktree, no root.
    let Some(root) = worktree_root(&location.identity) else {
        return clean();
    };
    let measured: RequireRootFacts = RequireRootFacts {
        effective_directory: effective_directory(root, location.prefix.as_slice()),
        // `Some(x)` is the "present" case; `.to_path_buf()` copies the borrowed path.
        repository_root: Some(root.to_path_buf()),
    };
    // `&measured` lends the measurements read-only.
    match resolve_require_root(&measured) {
        RequireRootVerdict::Pass => return clean(),
        RequireRootVerdict::NotAtRoot(violation) => {
            return rejected(NOT_AT_ROOT_CODE, violation.message);
        }
    }
}

/// What: The linked-worktree-only check. `&[PathBuf]` borrows the exempt tool caches.
/// Why:  Only a guarded, state-changing command needs to know which worktree it targets.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// async function checkLinkedWorktree(facts, args, allowedDirs): Promise<PolicyOutcome>;
/// ```
fn check_linked_worktree(
    facts: &mut dyn RepositoryFacts,
    arguments: &[OsString],
    allowed_worktree_dirs: &[PathBuf],
) -> PolicyOutcome {
    // `let Variant(x) = ... else { ... };` unwraps the guarded command or returns.
    let LinkedWorktreeDecision::NeedsEffectiveTarget(command) = decide_linked_worktree(arguments)
    else {
        return clean();
    };
    let location: RepositoryLocation = match facts.location() {
        Ok(found) => found,
        Err(message) => return fact_unavailable(message),
    };
    let target: EffectiveTarget =
        classify_effective_target(&location.identity, allowed_worktree_dirs);
    match resolve_linked_worktree(command, target) {
        // `String::from` copies the compiled-in text into owned text.
        Some(message) => return rejected(LINKED_WORKTREE_REQUIRED_CODE, String::from(message)),
        None => return clean(),
    }
}

/// What: The branch-worktree-only check.
/// Why:  Explicit creation is rejected from the arguments; a bare name is rejected only
///       when Git would create a branch for it from the one remote that has it.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// async function checkBranchWorktree(facts, args): Promise<PolicyOutcome>;
/// ```
fn check_branch_worktree(facts: &mut dyn RepositoryFacts, arguments: &[OsString]) -> PolicyOutcome {
    match decide_branch_worktree(arguments) {
        BranchWorktreeDecision::Pass => return clean(),
        BranchWorktreeDecision::Creates(command) => {
            return rejected(BRANCH_CREATION_CODE, branch_creation_message(command, None));
        }
        BranchWorktreeDecision::NeedsRemoteGuess { command, target } => {
            // `.as_os_str()` lends the owned name as a borrowed one.
            match facts.remote_guess_creates_branch(target.as_os_str()) {
                Err(message) => return fact_unavailable(message),
                Ok(false) => return clean(),
                Ok(true) => {
                    return rejected(
                        BRANCH_CREATION_CODE,
                        branch_creation_message(command, Some(target.as_os_str())),
                    );
                }
            }
        }
    }
}

/// What: The add-explicit check.
/// Why:  The decision needs the arguments only.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function checkAddExplicit(args: string[]): PolicyOutcome;
/// ```
fn check_add_explicit(arguments: &[OsString]) -> PolicyOutcome {
    match decide_add_explicit(arguments) {
        Some(message) => return rejected(BULK_ADD_CODE, message),
        None => return clean(),
    }
}

/// What: The check of every policy that reads candidate content.
/// Why:  Each of them derives every finding from the candidates, so no candidates means
///       no findings, and unreadable candidates mean the policy cannot answer.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const candidates = await context.git.candidates(); if (candidates.length === 0) return [];
/// ```
fn check_content(candidates: CandidateSource) -> PolicyOutcome {
    match candidates {
        CandidateSource::None => return clean(),
        CandidateSource::NotPorted(needs) => return PolicyOutcome::Unavailable(needs),
    }
}

/// What: `impl<F: RepositoryFacts> PolicyChecks for ShippedChecks<F>` provides the engine's
///       interface for the shipped policies, for any facts provider `F`.
/// Why:  One `match` over the typed policy identity is the whole registry of behavior:
///       the compiler refuses a policy without a check.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// check(policy: PolicyId, trigger: PolicyTrigger): Promise<PolicyOutcome> { switch (policy) { /* ... */ } }
/// ```
impl<F: RepositoryFacts> PolicyChecks for ShippedChecks<F> {
    fn check(&mut self, policy: PolicyId, trigger: Trigger) -> PolicyOutcome {
        // `&mut self.facts` lends the provider for writing; `.as_slice()` lends a list.
        match policy {
            PolicyId::RequireRoot => {
                return check_require_root(&mut self.facts, self.arguments.as_slice(), trigger);
            }
            PolicyId::LinkedWorktreeOnly => {
                return check_linked_worktree(
                    &mut self.facts,
                    self.arguments.as_slice(),
                    self.allowed_worktree_dirs.as_slice(),
                );
            }
            PolicyId::BranchWorktreeOnly => {
                return check_branch_worktree(&mut self.facts, self.arguments.as_slice());
            }
            PolicyId::AddExplicit => return check_add_explicit(self.arguments.as_slice()),
            PolicyId::FinalNewline
            | PolicyId::MarkdownAutofix
            | PolicyId::ForbiddenRootContext
            | PolicyId::DependentVersionBump
            | PolicyId::ForbiddenStrings => return check_content(self.candidates),
        }
    }
}

/// Per-policy outcomes and lazy fact use stay out of the release executable.
#[cfg(test)]
#[path = "policy_checks_tests.rs"]
mod tests;
