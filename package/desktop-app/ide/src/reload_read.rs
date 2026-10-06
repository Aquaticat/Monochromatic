//! Resolve project opens on the reader thread, then prepare source correspondence and classifications.

/// Existing source reads retain regular-file and UTF-8 validation before producing a prepared change.
use crate::{
    file_reload::{QuietRead, read_reload, read_reload_if_quiet},
    reload_worker::{ReloadReply, ReloadRequest, SyntaxReply},
    syntax::SyntaxEngine,
    workspace::Workspace,
};
/// Initialization failures remain distinct from unrecognized plain-text source.
use anyhow::Result;
/// Syntax classifies the exact immutable rope used by the prepared source revision.
use helix_core::Rope;
/// Paths stay native rather than becoming labels or shell arguments.
use std::path::Path;

/// Prepare syntax without making a classification failure discard otherwise readable source text.
fn classify(engine: &Result<SyntaxEngine>, path: &Path, text: &Rope, revision: u64) -> SyntaxReply {
    // What: match extracts the initialized engine or wraps its original initialization diagnostic.
    // Why: Missing runtime assets must not masquerade as an unrecognized language.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const result = engine.ok ? highlight(engine.value, path, text) : failure(engine.error);
    // ```
    let result = match engine {
        Ok(active) => active.highlight(path, text),
        Err(error) => Err(anyhow::anyhow!(
            "Cannot initialize highlighting for {}: {error:#}",
            path.display()
        )),
    };
    return SyntaxReply { revision, result };
}

/// Project opens resolve within the explicit root; ordinary refreshes retain their already accepted target.
pub(crate) fn prepare(
    request: ReloadRequest,
    workspace: Option<Workspace>,
    syntax: &Result<SyntaxEngine>,
) -> ReloadReply {
    // What: if-let extracts an optional project boundary; clone owns the already accepted path otherwise.
    // Why: New tree/search opens cannot escape the project through parent components or symbolic links.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const target = workspace === undefined ? request.path : workspace.resolve(request.path);
    // ```
    let resolved = if let Some(project) = workspace {
        project.resolve(&request.path)
    } else {
        Ok(request.path.clone())
    };
    let path = match resolved {
        Ok(path) => path,
        Err(error) => {
            tracing::warn!(path = %request.path.display(), %error, "project source resolution failed");
            // None means no accepted target or classification; preserve the resolution failure.
            return ReloadReply {
                generation: request.generation,
                resolved_path: None,
                result: Err(error),
                syntax: None,
                recent_write: false,
            };
        }
    };
    // What: `if let Some(quiet)` runs the quiet read only when the request requires quiet; `match` then
    //       turns a recent write into an early reply and a finished read into the usual result.
    // Why: A read no notification asked for must not show a save in progress.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const outcome = quiet === undefined ? readReload(...) : readReloadIfQuiet(..., quiet);
    // if (outcome.kind === 'recentlyWritten') return { ..., recentWrite: true };
    // ```
    let result = if let Some(quiet) = request.require_quiet {
        match read_reload_if_quiet(&request.snapshot, &path, quiet) {
            Ok(QuietRead::RecentlyWritten) => {
                // Ok(None) installs nothing; the flag tells the UI to wait for the writer.
                return ReloadReply {
                    generation: request.generation,
                    resolved_path: Some(path),
                    result: Ok(None),
                    syntax: None,
                    recent_write: true,
                };
            }
            Ok(QuietRead::Read(update)) => Ok(update),
            Err(error) => Err(error),
        }
    } else {
        // Lend the base snapshot and accepted path without sharing any mutable native state.
        read_reload(&request.snapshot, &path)
    };
    let classified = match &result {
        Ok(Some(reload)) => Some(classify(
            syntax,
            &path,
            reload.text(),
            request.snapshot.revision() + 1,
        )),
        Ok(None) if request.highlight_unchanged => Some(classify(
            syntax,
            &path,
            request.snapshot.text(),
            request.snapshot.revision(),
        )),
        // Failures keep their original result; unchanged accepted classifications need no repeated parse.
        _ => None,
    };
    // Some transfers the accepted path to the consumer so symlink aliases do not become separate open identities.
    return ReloadReply {
        generation: request.generation,
        resolved_path: Some(path),
        result,
        syntax: classified,
        recent_write: false,
    };
}
