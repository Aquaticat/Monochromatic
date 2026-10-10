//! What the worker thread remembers:
//!  the displayed document and every server process it knows.

/// The store that decides which diagnostic sets are current.
use super::diagnostics::DiagnosticStore;
/// Hints are kept per server so one server's exit removes only its own.
use super::hints::{HintWindow, InlayHint};
/// Identities that tag every result.
use super::identity::{DocumentStamp, ServerIdentity};
/// Requests of the worker's own that a server left unanswered.
use super::owed::Owed;
/// The latest-value status rows are built from these records.
use super::status::{DocumentState, Features, LanguageStatus, ServerState, ServerStatus};
/// What:
///  `Rope` is Helix's character-indexed text buffer;
///  the `config` types describe one
///       language and name the features a server may be asked for.
/// Why:
///  The worker keeps the text it last told servers about,
///  and routes by configured features.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { type Rope, type LanguageConfiguration, LanguageServerFeature } from 'helix-core';
/// ```
use helix_core::{
    Rope,
    syntax::config::{LanguageConfiguration, LanguageServerFeature},
};
/// helix-lsp's client handle,
///  its server key,
///  and the protocol's data types.
use helix_lsp::{Client, LanguageServerId, lsp};
/// What:
///  `PathBuf` is an owned filesystem path;
///  `Arc` is a thread-safe shared pointer
///       (siblings:
///  `Rc` for one thread,
///  `Box` for one owner).
/// Why:
///  helix-lsp hands clients out as `Arc<Client>`;
///  the worker keeps clones of them.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Shared<T> = T;
/// ```
use std::{path::PathBuf, sync::Arc};

/// What:
///  One server the worker knows about:
///  a running process,
///  or a configured server that
///       could not be started.
///  `Option<Arc<Client>>` is "a shared client,
///  or nothing".
/// Why:
///  Status rows exist for servers that never ran,
///  and running servers outlive file switches.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type ServerRecord = { identity: ServerIdentity; client?: Client; state: ServerState;
///                       attached: boolean; opened: boolean; progress: [Token, string][]; owed: Owed };
/// ```
pub(super) struct ServerRecord {
    /// Name and process generation.
    pub(super) identity: ServerIdentity,
    /// Present while helix-lsp's registry holds the process.
    pub(super) client: Option<Arc<Client>>,
    /// Current state for the status rows.
    pub(super) state: ServerState,
    /// True when the server serves the displayed document's language.
    pub(super) attached: bool,
    /// True once `didOpen` for the displayed document was sent to it.
    pub(super) opened: bool,
    /// Work the server reported as begun and not yet ended,
    ///  with its title.
    pub(super) progress: Vec<(lsp::ProgressToken, String)>,
    /// Hints and pull diagnostics for the displayed text that this server left unanswered
    /// through their retries;
    ///  they are asked again when the server next sends anything.
    pub(super) owed: Owed,
}

/// Record behavior.
impl ServerRecord {
    /// What:
    ///  The helix-lsp key of the running process,
    ///  or nothing.
    ///  `LanguageServerId` is a small
    ///       copyable key.
    /// Why:
    ///  Server traffic arrives tagged with this key.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// get id(): ServerId | undefined { return this.client?.id; }
    /// ```
    pub(super) fn id(&self) -> Option<LanguageServerId> {
        // `as_ref()` borrows the client inside the `Option`; `map` reads its key when present.
        return self.client.as_ref().map(|client| return client.id());
    }

    /// The client,
    ///  only when it has finished `initialize`;
    ///  every helix-lsp call needs this gate.
    pub(super) fn ready(&self) -> Option<&Arc<Client>> {
        // What: `filter` keeps the value only when the closure accepts it.
        // Why: helix-lsp's request and notification methods panic on a client whose capabilities
        //      are not yet known; this is the one gate every call path goes through.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return this.client?.isInitialized ? this.client : undefined;
        // ```
        return self
            .client
            .as_ref()
            .filter(|client| return client.is_initialized());
    }
}

/// The displayed document as language servers know it.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type OpenDocument = { path: string; url: string; text: Rope; stamp: DocumentStamp; version: number;
///                       config?: LanguageConfiguration; languageId: string; state: DocumentState;
///                       window?: HintWindow };
/// ```
pub(super) struct OpenDocument {
    /// Resolved path,
    ///  used to match diagnostics and targets.
    pub(super) path: PathBuf,
    /// Address sent in `didOpen`,
    ///  in the spelling Helix uses for the project root.
    pub(super) url: lsp::Url,
    /// Text of the displayed revision.
    pub(super) text: Rope,
    /// File generation and revision of that text.
    pub(super) stamp: DocumentStamp,
    /// Protocol version:
    ///  zero at `didOpen`,
    ///  plus one per reload.
    ///  `i32` is the signed 32-bit
    /// integer the protocol mandates (siblings:
    ///  `u32`,
    ///  `i64`).
    pub(super) version: i32,
    /// The language's Helix configuration;
    ///  absent when the file has no recognized language.
    pub(super) config: Option<Arc<LanguageConfiguration>>,
    /// Language identifier sent to servers.
    pub(super) language_id: String,
    /// Whether servers apply to this file at all.
    pub(super) state: DocumentState,
    /// Visible lines last reported by the interface,
    ///  for hint requests after a reload.
    pub(super) window: Option<HintWindow>,
}

/// Everything the worker thread owns besides helix-lsp's registry.
pub(super) struct Session {
    /// The displayed document;
    ///  absent when none is displayed.
    pub(super) document: Option<OpenDocument>,
    /// Every known server,
    ///  in the order they were first seen.
    pub(super) servers: Vec<ServerRecord>,
    /// Process generation given to the next started server.
    ///  `u64` never wraps in practice.
    pub(super) next_instance: u64,
    /// Diagnostics for the displayed document.
    pub(super) diagnostics: DiagnosticStore,
    /// Hints for the displayed document,
    ///  per answering server.
    pub(super) hints: Vec<(ServerIdentity, Vec<InlayHint>)>,
    /// Requested hint lines of the stored hints,
    ///  as `(first, last)`.
    pub(super) hint_lines: (usize, usize),
    /// Position requests with answers outstanding,
    ///  as `(request number, servers still to answer)`.
    pub(super) pending: Vec<(u64, usize)>,
}

/// True when the language's configuration lets this server be asked for the feature.
pub(super) fn allowed(
    config: Option<&Arc<LanguageConfiguration>>,
    server: &str,
    feature: LanguageServerFeature,
) -> bool {
    // `let Some(x) = option else { ... }` binds the inner value or leaves the function.
    let Some(language) = config else {
        return true;
    };
    for features in &language.language_servers {
        if features.name == server {
            return features.has_feature(feature);
        }
    }
    return true;
}

/// Session queries and bookkeeping.
impl Session {
    /// Create a session with nothing displayed and no server known.
    pub(super) fn new() -> Self {
        return Self {
            document: None,
            servers: Vec::new(),
            next_instance: 1,
            diagnostics: DiagnosticStore::new(),
            hints: Vec::new(),
            hint_lines: (0, 0),
            pending: Vec::new(),
        };
    }

    /// What:
    ///  Index of the record whose running process has this helix-lsp key.
    ///       `Option<usize>` is "an index,
    ///  or nothing".
    /// Why:
    ///  Indexes are used instead of borrowed records so the worker can keep using its other
    ///      fields while it changes one record.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// indexOf(id: ServerId): number | undefined
    /// ```
    pub(super) fn index_of(&self, id: LanguageServerId) -> Option<usize> {
        // `position` is `Array.prototype.findIndex`, returning `None` instead of -1.
        return self
            .servers
            .iter()
            .position(|record| return record.id() == Some(id));
    }

    /// Index of the record with this identity.
    pub(super) fn index_of_identity(&self, identity: &ServerIdentity) -> Option<usize> {
        return self
            .servers
            .iter()
            .position(|record| return &record.identity == identity);
    }

    /// The displayed document's stamp,
    ///  or nothing.
    pub(super) fn stamp(&self) -> Option<DocumentStamp> {
        return self.document.as_ref().map(|document| return document.stamp);
    }

    /// What:
    ///  Detach every record from the document and forget servers that never ran.
    /// Why:
    ///  Running servers stay for the next file of their language;
    ///  rows that only explained
    ///      the previous file's state do not.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// detach() { this.servers = this.servers.filter(record => record.client); /* reset flags */ }
    /// ```
    pub(super) fn detach(&mut self) {
        // `retain` keeps only the records for which the closure returns true.
        self.servers.retain(|record| return record.client.is_some());
        for record in self.servers.iter_mut() {
            record.attached = false;
            record.opened = false;
            // `Owed::default()` builds the empty record: nothing is owed for a file no longer displayed.
            record.owed = Owed::default();
            // A server that could not follow the previous file's reloads is usable for a new file.
            if record.state == ServerState::Unsynchronized {
                record.state = ServerState::Ready;
            }
        }
        self.hints.clear();
        self.pending.clear();
    }

    /// Add a status row for a configured server that has no process.
    pub(super) fn report(&mut self, name: &str, state: ServerState) {
        self.servers.push(ServerRecord {
            identity: ServerIdentity {
                // `to_string` copies the borrowed name into owned storage.
                name: name.to_string(),
                instance: 0,
            },
            client: None,
            state,
            attached: true,
            opened: false,
            progress: Vec::new(),
            owed: Owed::default(),
        });
    }

    /// Which of the application's features a ready server offers for the displayed document.
    fn features(&self, record: &ServerRecord) -> Option<Features> {
        // The trailing `?` returns `None` unless the client has initialized.
        let client = record.ready()?;
        let config = self
            .document
            .as_ref()
            .and_then(|document| return document.config.as_ref());
        let name = record.identity.name.as_str();
        // What: A closure capturing `client`, `config`, and `name`; `|feature|` is its parameter.
        // Why: A feature counts only when the server offers it and the language's configuration
        //      does not exclude it for this server.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const offers = (feature: Feature) => client.supportsFeature(feature) && allowed(config, name, feature);
        // ```
        let offers = |feature: LanguageServerFeature| {
            return client.supports_feature(feature) && allowed(config, name, feature);
        };
        // `Some(...)` is the "value present" variant of `Option`.
        return Some(Features {
            definition: offers(LanguageServerFeature::GotoDefinition),
            references: offers(LanguageServerFeature::GotoReference),
            hover: offers(LanguageServerFeature::Hover),
            inlay_hints: offers(LanguageServerFeature::InlayHints),
            pull_diagnostics: offers(LanguageServerFeature::PullDiagnostics),
        });
    }

    /// Build the latest-value status for the displayed document.
    pub(super) fn status(&self) -> LanguageStatus {
        let Some(document) = self.document.as_ref() else {
            return LanguageStatus::closed();
        };
        let mut servers = Vec::new();
        for record in &self.servers {
            if !record.attached {
                continue;
            }
            servers.push(ServerStatus {
                // `clone` copies the identity and state so the status owns its own values.
                server: record.identity.clone(),
                state: record.state.clone(),
                features: self.features(record),
                // `last()` borrows the most recently begun work; `map` copies its title.
                progress: record
                    .progress
                    .last()
                    .map(|(_, title)| return title.clone()),
            });
        }
        return LanguageStatus {
            file: Some(document.stamp.file),
            language: document
                .config
                .as_ref()
                .map(|config| return config.language_id.clone()),
            document: document.state,
            servers,
        };
    }

    /// What:
    ///  Count one answer for a position request and return how many are still outstanding.
    /// Why:
    ///  The interface learns from `remaining == 0` that no further reply will come.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// answered(request: number): number
    /// ```
    pub(super) fn answered(&mut self, request: u64) -> usize {
        let found = self
            .pending
            .iter()
            .position(|(known, _)| return *known == request);
        let Some(index) = found else {
            return 0;
        };
        // `saturating_sub` stops at zero instead of wrapping below it.
        let remaining = self.pending[index].1.saturating_sub(1);
        self.pending[index].1 = remaining;
        if remaining == 0 {
            self.pending.remove(index);
        }
        return remaining;
    }
}
