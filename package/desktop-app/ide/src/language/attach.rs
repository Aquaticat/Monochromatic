//! Server processes:
//!  on-demand start,
//!  the start deadline,
//!  readiness,
//!  exit,
//!  and removal.

/// What:
///  `use` brings names from other modules into this file under their short names.
/// Why:
///  Results of an ended server are removed by its identity.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { type ServerIdentity } from './identity';
/// ```
use super::identity::ServerIdentity;
/// `didOpen` follows readiness.
use super::lifecycle::send_did_open;
/// States reported to the interface thread.
use super::status::{DocumentState, ServerState};
/// The worker whose state these steps change.
use super::worker::Worker;
/// helix-lsp's key for one server process.
use helix_lsp::LanguageServerId;

/// On-demand start of a language's servers,
///  after the program,
///  the root,
///  and the launch were checked.
mod start;

/// Records of a server that ended unexpectedly or did not finish starting,
///  with its last
/// standard-error lines.
mod report;

/// What:
///  Remove one server process from helix-lsp's registry and record why.
///  `usize` is the
///       record's index in the session;
///  `stop` says whether the process may still be running.
/// Why:
///  helix-lsp never removes a client by itself.
///  `remove_by_id` plus `force_shutdown` is used
///      instead of `Registry::stop`,
///  because `stop` leaves a marker that prevents every later
///      start of that server name.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function retire(worker: Worker, index: number, state: ServerState, stop: boolean): void
/// ```
fn retire(worker: &mut Worker, index: usize, state: ServerState, stop: bool) {
    let record = &mut worker.session.servers[index];
    // `take()` moves the client out of the record, leaving "nothing" behind.
    if let Some(client) = record.client.take() {
        if stop {
            // Sends `shutdown` and `exit` without waiting; dropping the client then kills what is left.
            client.force_shutdown();
        }
        worker.registry.remove_by_id(client.id());
    }
    record.state = state;
    record.opened = false;
    record.progress.clear();
    // `clone` copies the identity so the record borrow ends before the stores are changed.
    let identity = record.identity.clone();
    forget_results(worker, &identity);
}

/// Remove everything a server process contributed to the displayed document.
fn forget_results(worker: &mut Worker, identity: &ServerIdentity) {
    worker.session.diagnostics.server_exited(identity);
    // `retain` keeps only the entries for which the closure returns true.
    worker
        .session
        .hints
        .retain(|(server, _)| return server != identity);
}

/// What:
///  Attach already running servers to a document outside the project;
///  nothing is started.
/// Why:
///  A dependency or standard-library file opened from a definition belongs to no project
///      root of its own;
///  only the servers the project already runs are asked about it.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function attachRunning(worker: Worker, names: string[]): void
/// ```
fn attach_running(worker: &mut Worker, names: &[String]) {
    for index in 0..worker.session.servers.len() {
        let record = &mut worker.session.servers[index];
        if record.client.is_none() || !names.contains(&record.identity.name) {
            continue;
        }
        record.attached = true;
        send_did_open(worker, index);
    }
}

/// What:
///  Resolve the displayed document's language and attach its servers.
/// Why:
///  This is the single path by which a server comes to serve a document,
///  used when a file
///      is displayed and when an exited server is started again.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// async function attach(worker: Worker): Promise<void>
/// ```
pub(super) async fn attach(worker: &mut Worker) {
    let Some(path) = worker
        .session
        .document
        .as_ref()
        .map(|document| return document.path.clone())
    else {
        return;
    };
    // The inner block ends the registry guard's borrow before the worker is changed again.
    let recognized = {
        let loader = worker.languages.loader.load();
        loader
            .language_for_filename(&path)
            .map(|found| return loader.language(found).config().language_id.clone())
    };
    let Some(language) = recognized else {
        return;
    };
    if let Err(error) = worker.languages.refresh(&language) {
        tracing::error!(
            ?error,
            "cannot rebuild the language registry; keeping the previous one"
        );
    }
    let configured = {
        let loader = worker.languages.loader.load();
        loader
            .language_for_filename(&path)
            .map(|found| return loader.language(found).config().clone())
    };
    let Some(config) = configured else {
        return;
    };
    // `to_vec` copies the borrowed list so the registry tables are free to change.
    let names = worker.languages.configured(&language).to_vec();
    let outside = !path.starts_with(&worker.root);
    if let Some(document) = worker.session.document.as_mut() {
        // The server-facing identifier falls back to Helix's language name.
        document.language_id = config
            .language_server_language_id
            .clone()
            .unwrap_or_else(|| return config.language_id.clone());
        document.config = Some(config.clone());
        document.state = if names.is_empty() {
            DocumentState::NoServerConfigured
        } else if outside {
            DocumentState::OutsideProject
        } else {
            DocumentState::Attached
        };
    }
    if outside {
        attach_running(worker, &names);
    } else {
        start::start(worker, &config, &names).await;
    }
}

/// What:
///  Start exited servers of the displayed document again;
///  returns true when anything was tried.
/// Why:
///  A server that ended is started again only by an explicit open or position request,
///      never in a loop.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// async function revive(worker: Worker): Promise<boolean>
/// ```
pub(super) async fn revive(worker: &mut Worker) -> bool {
    let exited = worker
        .session
        .servers
        .iter()
        .any(|record| return record.attached && record.state == ServerState::Exited);
    if !exited {
        return false;
    }
    // Rows without a process are rebuilt by the attach step.
    worker
        .session
        .servers
        .retain(|record| return record.client.is_some());
    attach(worker).await;
    return true;
}

/// What:
///  A server finished `initialize`:
///  send its settings,
///  mark it ready,
///  and open the document.
/// Why:
///  helix-lsp injects a synthetic `initialized` notification for exactly this;
///  Helix's
///      editor sends `workspace/didChangeConfiguration` at the same point.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function initialized(worker: Worker, server: ServerId): void
/// ```
pub(super) fn initialized(worker: &mut Worker, server: LanguageServerId) {
    let Some(index) = worker.session.index_of(server) else {
        return;
    };
    let record = &mut worker.session.servers[index];
    let Some(client) = record.ready() else {
        return;
    };
    if let Some(settings) = client.config() {
        client.did_change_configuration(settings.clone());
    }
    tracing::info!(server = %record.identity.name, instance = record.identity.instance, encoding = ?client.offset_encoding(), "language server is ready");
    record.state = ServerState::Ready;
    send_did_open(worker, index);
}

/// What:
///  A server process ended:
///  remove it from helix-lsp's registry and from the session.
/// Why:
///  Without removal the registry would hand the dead client out again,
///  and a kept client
///      would leave the ended process unreaped.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function exited(worker: Worker, server: ServerId): void
/// ```
pub(super) fn exited(worker: &mut Worker, server: LanguageServerId) {
    let Some(index) = worker.session.index_of(server) else {
        worker.registry.remove_by_id(server);
        return;
    };
    let was_ready = worker.session.servers[index].ready().is_some();
    let state = if was_ready {
        ServerState::Exited
    } else {
        ServerState::FailedToStart {
            reason: "the server process ended before it finished starting".to_string(),
        }
    };
    // The record waits briefly for the server's last standard-error lines; the state does not.
    report::ended_unexpectedly(
        worker.session.servers[index].identity.name.clone(),
        was_ready,
    );
    retire(worker, index, state, false);
    if !worker.session.servers[index].attached {
        worker.session.servers.remove(index);
    }
}

/// What:
///  A starting server's deadline passed:
///  if it still has not initialized,
///  stop it.
/// Why:
///  helix-lsp reports neither an error answer to `initialize` nor a missing answer;
///  time is
///      the only signal that the start failed.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function startDeadline(worker: Worker, server: ServerId): void
/// ```
pub(super) fn start_deadline(worker: &mut Worker, server: LanguageServerId) {
    let Some(index) = worker.session.index_of(server) else {
        return;
    };
    if worker.session.servers[index].ready().is_some() {
        return;
    }
    let name = worker.session.servers[index].identity.name.clone();
    let seconds = worker.languages.timeout(&name);
    tracing::error!(server = %name, seconds, "language server did not answer initialize in time and is stopped");
    let reason = format!("{name} did not answer initialize within {seconds} seconds");
    report::stopped_during_start(&name);
    retire(worker, index, ServerState::FailedToStart { reason }, true);
    if !worker.session.servers[index].attached {
        worker.session.servers.remove(index);
    }
}
