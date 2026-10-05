//! Server processes: on-demand start, the start deadline, readiness, exit, and removal.

/// Why a configured server cannot be started.
use super::config::Unavailable;
/// Identities given to started processes.
use super::identity::ServerIdentity;
/// Private directories a launch needs are prepared before the process exists.
use super::launch::prepare;
/// `didOpen` follows readiness.
use super::lifecycle::send_did_open;
/// Root checks made before and after a start.
use super::root::{RootRefusal, RootView};
/// Session records.
use super::session::ServerRecord;
/// States reported to the interface thread.
use super::status::{DocumentState, ServerState};
/// The worker whose state these steps change.
use super::worker::{Internal, Worker};
/// One language's Helix configuration.
use helix_core::syntax::config::LanguageConfiguration;
/// helix-lsp's client handle and server key.
use helix_lsp::{Client, LanguageServerId};
/// What: `Arc` is a thread-safe shared pointer (siblings: `Rc`, `Box`); `Duration` is a time span.
/// Why: helix-lsp hands clients out as `Arc<Client>`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Shared<T> = T;
/// ```
use std::{sync::Arc, time::Duration};

/// Seconds added to a server's request timeout before its start is declared failed.
const START_MARGIN: u64 = 2;

/// Translate a root refusal into the state shown for a server.
fn refusal_state(refusal: &RootRefusal) -> ServerState {
    // What: `match` unpacks the tagged union; `clone` copies the path into the new state.
    // Why: The two refusals have different remedies and stay distinct states.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return refusal.kind === 'outsideProject' ? { kind: 'rootOutsideProject', root } : { kind: 'wrongWorkingDirectory', directory };
    // ```
    return match refusal {
        RootRefusal::OutsideProject(root) => ServerState::RootOutsideProject { root: root.clone() },
        RootRefusal::WrongWorkingDirectory(directory) => ServerState::WrongWorkingDirectory {
            directory: directory.clone(),
        },
    };
}

/// What: Remove one server process from helix-lsp's registry and record why. `usize` is the
///       record's index in the session; `stop` says whether the process may still be running.
/// Why: helix-lsp never removes a client by itself. `remove_by_id` plus `force_shutdown` is used
///      instead of `Registry::stop`, because `stop` leaves a marker that prevents every later
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

/// What: Take a client helix-lsp returned into the session: a new process gets a record, an
///       identity, and a start deadline; a reused one keeps its record.
/// Why: The workspace folders helix-lsp will announce are checked once more after the start;
///      a folder outside the project ends the server at once.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// async function adopt(worker: Worker, name: string, client: Client, view: RootView): Promise<void>
/// ```
async fn adopt(worker: &mut Worker, name: String, client: Arc<Client>, view: &RootView) {
    let index = match worker.session.index_of(client.id()) {
        Some(index) => index,
        None => {
            let instance = worker.session.next_instance;
            worker.session.next_instance += 1;
            worker.session.servers.push(ServerRecord {
                identity: ServerIdentity { name, instance },
                // `Some(...)` is the "value present" variant; `clone` copies the shared pointer.
                client: Some(client.clone()),
                state: ServerState::Starting,
                attached: false,
                opened: false,
                progress: Vec::new(),
            });
            let seconds = worker.languages.timeout(client.name()) + START_MARGIN;
            worker.timer(
                Duration::from_secs(seconds),
                Internal::StartDeadline(client.id()),
            );
            worker.session.servers.len() - 1
        }
    };
    // What: `.await` waits for helix-lsp's folder list; `clone` copies it so the lock is released.
    // Why: The list is filled when the client is created, before `initialize` is answered.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const folders = [...await client.workspaceFolders()];
    // ```
    let folders = client.workspace_folders().await.clone();
    for folder in &folders {
        // `to_file_path` returns `Result`; an address that is not a local path counts as outside.
        let inside = folder
            .uri
            .to_file_path()
            .is_ok_and(|path| return view.contains(&path));
        if !inside {
            tracing::error!(server = client.name(), folder = %folder.uri, "server was rooted outside the project and is stopped");
            let root = folder.uri.to_file_path().unwrap_or_default();
            retire(
                worker,
                index,
                ServerState::RootOutsideProject { root },
                true,
            );
            worker.session.servers[index].attached = true;
            return;
        }
    }
    let record = &mut worker.session.servers[index];
    record.attached = true;
    if client.is_initialized() {
        record.state = ServerState::Ready;
        send_did_open(worker, index);
    }
}

/// What: Create the private directories of every server that is about to start; returns the
///       name and reason of the first failure.
/// Why: A launch that cannot be prepared must not happen at all; there is no unconfined fallback.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function prepareLaunches(worker: Worker, names: string[]): [string, string] | undefined
/// ```
fn prepare_launches(worker: &Worker, names: &[String]) -> Option<(String, String)> {
    for name in names {
        // A running server keeps its directories; emptying its scratch space would break it.
        let running = worker
            .session
            .servers
            .iter()
            .any(|record| return record.client.is_some() && &record.identity.name == name);
        if running {
            continue;
        }
        let Some(launch) = worker.languages.launch(name) else {
            continue;
        };
        if let Err(reason) = prepare(launch, &worker.root, worker.languages.state_root()) {
            return Some((name.clone(), reason));
        }
    }
    // `None` is the "nothing" variant: every launch is prepared.
    return None;
}

/// What: Start or reuse the servers of the displayed document's language inside the project.
/// Why: Each outcome of `Registry::get` is one of the states the interface must tell apart, and
///      nothing is spawned before the executable, the root, and the launch were checked.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// async function start(worker: Worker, config: LanguageConfiguration, names: string[]): Promise<void>
/// ```
async fn start(worker: &mut Worker, config: &Arc<LanguageConfiguration>, names: &[String]) {
    let mut startable: Vec<String> = Vec::new();
    for name in names {
        match worker.languages.unavailable(name) {
            Some(Unavailable::Missing(reason)) => {
                let state = ServerState::MissingExecutable {
                    reason: reason.clone(),
                };
                worker.session.report(name, state);
            }
            Some(Unavailable::Refused(reason)) => {
                let state = ServerState::LaunchRefused {
                    reason: reason.clone(),
                };
                worker.session.report(name, state);
            }
            None => startable.push(name.clone()),
        }
    }
    if startable.is_empty() {
        return;
    }
    let Some(path) = worker
        .session
        .document
        .as_ref()
        .map(|document| return document.path.clone())
    else {
        return;
    };
    let view = match RootView::discover(&worker.root) {
        Ok(view) => view,
        Err(refusal) => {
            tracing::error!(
                ?refusal,
                "language servers are not started: the process working directory is not the project root"
            );
            for name in &startable {
                worker.session.report(name, refusal_state(&refusal));
            }
            return;
        }
    };
    let document = view.to_helix(&path);
    if let Err(refusal) = view.lsp_root(config, &document) {
        tracing::warn!(
            ?refusal,
            "language servers are not started: their root would be outside the project"
        );
        for name in &startable {
            worker.session.report(name, refusal_state(&refusal));
        }
        return;
    }
    if let Some((failed, reason)) = prepare_launches(worker, &startable) {
        tracing::error!(server = %failed, %reason, "language servers are not started: a launch could not be prepared");
        for name in &startable {
            let state = if name == &failed {
                ServerState::LaunchRefused {
                    reason: reason.clone(),
                }
            } else {
                ServerState::NotStarted {
                    reason: format!("not started because {failed} could not be launched safely"),
                }
            };
            worker.session.report(name, state);
        }
        return;
    }
    let root_directories = [view.helix().to_path_buf()];
    // What: `Registry::get` returns a lazy sequence of `(name, Result<Arc<Client>>)`; `collect()`
    //       runs it to completion into a list. It reuses a running server whose root matches,
    //       otherwise spawns the process and sends `initialize` from a task.
    // Why: Collecting first ends the registry borrow before the session is changed.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const started = [...registry.get(config, document, [root], false)];
    // ```
    let started: Vec<(String, helix_lsp::Result<Arc<Client>>)> = worker
        .registry
        .get(config, Some(document.as_path()), &root_directories, false)
        .collect();
    let mut seen: Vec<String> = Vec::new();
    for (name, outcome) in started {
        seen.push(name.clone());
        match outcome {
            // Helix looked the program up itself and did not find it: it vanished since the registry was built.
            Err(helix_lsp::Error::ExecutableNotFound(error)) => {
                worker.session.report(
                    &name,
                    ServerState::MissingExecutable {
                        reason: error.to_string(),
                    },
                );
            }
            Err(error) => {
                worker.session.report(
                    &name,
                    ServerState::FailedToStart {
                        reason: error.to_string(),
                    },
                );
            }
            Ok(client) => adopt(worker, name, client, &view).await,
        }
    }
    for name in &startable {
        if !seen.contains(name) {
            let reason = "its required root files are absent from the project".to_string();
            worker
                .session
                .report(name, ServerState::NotStarted { reason });
        }
    }
    return;
}

/// What: Attach already running servers to a document outside the project; nothing is started.
/// Why: A dependency or standard-library file opened from a definition belongs to no project
///      root of its own; only the servers the project already runs are asked about it.
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

/// What: Resolve the displayed document's language and attach its servers.
/// Why: This is the single path by which a server comes to serve a document, used when a file
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
        start(worker, &config, &names).await;
    }
}

/// What: Start exited servers of the displayed document again; returns true when anything was tried.
/// Why: A server that ended is started again only by an explicit open or position request,
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

/// What: A server finished `initialize`: send its settings, mark it ready, and open the document.
/// Why: helix-lsp injects a synthetic `initialized` notification for exactly this; Helix's
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

/// What: A server process ended: remove it from helix-lsp's registry and from the session.
/// Why: Without removal the registry would hand the dead client out again, and a kept client
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
    tracing::warn!(server = %worker.session.servers[index].identity.name, was_ready, "language server process ended");
    retire(worker, index, state, false);
    if !worker.session.servers[index].attached {
        worker.session.servers.remove(index);
    }
}

/// What: A starting server's deadline passed: if it still has not initialized, stop it.
/// Why: helix-lsp reports neither an error answer to `initialize` nor a missing answer; time is
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
    retire(worker, index, ServerState::FailedToStart { reason }, true);
    if !worker.session.servers[index].attached {
        worker.session.servers.remove(index);
    }
}
