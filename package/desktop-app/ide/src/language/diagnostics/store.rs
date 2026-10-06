//! Which pushed and pulled diagnostic sets describe the displayed revision.

/// Conversion and grouping live beside the public types.
use super::{DiagnosticsSnapshot, Freshness, SourceGroup, add_to_group, convert};
/// Sets are keyed by server process and stamped with the text they were accepted for.
use crate::language::identity::{DocumentStamp, ServerIdentity};
/// Conversion happens against the rope of the displayed revision.
use helix_core::Rope;
/// The protocol's diagnostic record and each server's column unit.
use helix_lsp::{OffsetEncoding, lsp};

/// What:
///  A closed set of names for what happened to one pushed set.
/// Why:
///  The worker logs the reason,
///  and tests assert the exact rule that applied.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type PushVerdict = 'acceptedVersioned' | 'acceptedUnversioned' | 'wrongVersion'
///                  | 'held' | 'lineOutOfRange' | 'noDocument';
/// ```
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum PushVerdict {
    /// The set's version equals the displayed revision's protocol version.
    AcceptedVersioned,
    /// No version was sent,
    ///  no hold is open,
    ///  and every range starts on an existing line.
    AcceptedUnversioned,
    /// The set names another protocol version of the document.
    WrongVersion,
    /// No version was sent and the server has not yet answered anything since the last reload.
    Held,
    /// No version was sent and a range starts past the last line of the displayed text.
    LineOutOfRange,
    /// No file is displayed.
    NoDocument,
}

/// The displayed document as the store needs it.
struct Tracked {
    /// File generation and revision of the displayed text.
    stamp: DocumentStamp,
    /// Protocol version of that revision.
    ///  `i32` is the signed 32-bit integer the protocol
    /// mandates (siblings:
    ///  `u32`,
    ///  `i64`).
    version: i32,
}

/// One accepted set from one server on one channel.
struct StoredSet {
    /// Server process that sent it.
    server: ServerIdentity,
    /// True for an answer to a pull request;
    ///  false for a pushed notification.
    pulled: bool,
    /// Text the set was accepted for.
    stamp: DocumentStamp,
    /// How its freshness was established.
    freshness: Freshness,
    /// Column unit of the sending server.
    encoding: OffsetEncoding,
    /// What:
    ///  `Vec<lsp::Diagnostic>` keeps the protocol records unconverted.
    /// Why:
    ///  A later "unchanged" pull answer re-stamps the set for a new revision,
    ///  and the ranges
    ///      must then be converted against that revision's text.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// items: lsp.Diagnostic[];
    /// ```
    items: Vec<lsp::Diagnostic>,
}

/// An open hold on one server's unversioned pushes.
struct Hold {
    /// Server whose unversioned sets are discarded.
    server: ServerIdentity,
    /// Number of the reload that opened the hold;
    ///  `u64` never wraps in practice.
    serial: u64,
}

/// What:
///  The store's whole state.
///  `Option<Tracked>` is "a tracked document,
///  or nothing".
/// Why:
///  Push and pull arrive on different paths at different times;
///  one owner decides which
///      sets may be shown together.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// class DiagnosticStore { document?: Tracked; sets: StoredSet[] = []; holds: Hold[] = [];
///                         resultIds: [ServerIdentity, string][] = []; serial = 0; }
/// ```
pub(crate) struct DiagnosticStore {
    /// Displayed document,
    ///  absent when no file is displayed.
    document: Option<Tracked>,
    /// At most one pushed and one pulled set per server process.
    sets: Vec<StoredSet>,
    /// Servers whose unversioned pushes are discarded for now.
    holds: Vec<Hold>,
    /// Result identifiers servers attached to their last full pull answer.
    result_ids: Vec<(ServerIdentity, String)>,
    /// Count of reloads,
    ///  used to tell a late hold timer from a current one.
    serial: u64,
}

/// Store operations,
///  each corresponding to one lifecycle or protocol event.
impl DiagnosticStore {
    /// Create an empty store with no displayed document.
    pub(crate) fn new() -> Self {
        return Self {
            document: None,
            sets: Vec::new(),
            holds: Vec::new(),
            result_ids: Vec::new(),
            serial: 0,
        };
    }

    /// A file is displayed:
    ///  forget everything about the previous one.
    pub(crate) fn open(&mut self, stamp: DocumentStamp, version: i32) {
        self.close();
        // `Some(...)` wraps the record in the "value present" variant of `Option`.
        self.document = Some(Tracked { stamp, version });
    }

    /// No file is displayed:
    ///  a file switch or close clears every set,
    ///  hold,
    ///  and result identifier.
    pub(crate) fn close(&mut self) {
        self.document = None;
        self.sets.clear();
        self.holds.clear();
        self.result_ids.clear();
    }

    /// What:
    ///  Record an accepted reload and return its number.
    ///  `&[ServerIdentity]` lends a list
    ///       of the servers that hold the document open.
    /// Why:
    ///  Every pushed set of the previous revision is invalid at once,
    ///  and each server's
    ///      unversioned pushes are held until it has demonstrably processed the change.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// reload(stamp: DocumentStamp, version: number, servers: ServerIdentity[]): number {
    ///   this.sets = this.sets.filter(set => set.pulled);
    ///   this.holds = servers.map(server => ({ server, serial: ++this.serial }));
    /// }
    /// ```
    pub(crate) fn reload(
        &mut self,
        stamp: DocumentStamp,
        version: i32,
        servers: &[ServerIdentity],
    ) -> u64 {
        self.serial += 1;
        self.document = Some(Tracked { stamp, version });
        // What: `retain` keeps only the items for which the closure returns true; `|set|` is a
        //       closure parameter, like `set =>` in an arrow function.
        // Why: Pulled sets stay stored but unshown, because an "unchanged" answer may re-stamp them.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // this.sets = this.sets.filter(set => set.pulled);
        // ```
        self.sets.retain(|set| return set.pulled);
        self.holds.clear();
        for server in servers {
            self.holds.push(Hold {
                // `clone` copies the identity so the hold owns its own value.
                server: server.clone(),
                serial: self.serial,
            });
        }
        return self.serial;
    }

    /// True while the server's unversioned pushes are being discarded.
    pub(crate) fn is_held(&self, server: &ServerIdentity) -> bool {
        // `iter().any(...)` is `Array.prototype.some`; `&self.holds` is only read.
        return self.holds.iter().any(|hold| return &hold.server == server);
    }

    /// What:
    ///  The server answered a request sent for `stamp`;
    ///  returns true when that ended a hold.
    /// Why:
    ///  An answer to a request sent after the change shows the server processed the change,
    ///      provided servers handle messages in order,
    ///  which the protocol does not promise.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// answered(server: ServerIdentity, stamp: DocumentStamp): boolean
    /// ```
    pub(crate) fn answered(&mut self, server: &ServerIdentity, stamp: DocumentStamp) -> bool {
        // What: `as_ref()` borrows the value inside the `Option`; `is_none_or` is true for
        //       "nothing" or when the closure accepts the value.
        // Why: An answer about an older revision proves nothing about the latest change.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (this.document?.stamp !== stamp) return false;
        // ```
        if self
            .document
            .as_ref()
            .is_none_or(|tracked| return tracked.stamp != stamp)
        {
            return false;
        }
        let before = self.holds.len();
        self.holds.retain(|hold| return &hold.server != server);
        return self.holds.len() != before;
    }

    /// The fixed delay after reload number `serial` passed;
    ///  returns true when a hold ended.
    pub(crate) fn hold_expired(&mut self, serial: u64) -> bool {
        let before = self.holds.len();
        self.holds.retain(|hold| return hold.serial != serial);
        return self.holds.len() != before;
    }

    /// What:
    ///  Judge one `publishDiagnostics` notification for the displayed file and store it when
    ///       accepted.
    ///  `version` is the optional document version the server attached;
    ///       `line_count` is the number of lines of the displayed text.
    /// Why:
    ///  A versioned set is exact;
    ///  an unversioned one can only be shown conservatively.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// push(server, encoding, version: number | undefined, items, lineCount: number): PushVerdict
    /// ```
    pub(crate) fn push(
        &mut self,
        server: &ServerIdentity,
        encoding: OffsetEncoding,
        version: Option<i32>,
        items: Vec<lsp::Diagnostic>,
        line_count: usize,
    ) -> PushVerdict {
        // `let Some(x) = option else { ... }` binds the inner value or leaves the function.
        let Some(tracked) = self.document.as_ref() else {
            return PushVerdict::NoDocument;
        };
        let stamp = tracked.stamp;
        let freshness = match version {
            Some(sent) => {
                if sent != tracked.version {
                    return PushVerdict::WrongVersion;
                }
                Freshness::Versioned
            }
            None => {
                if self.is_held(server) {
                    return PushVerdict::Held;
                }
                for item in &items {
                    // What: `usize::try_from` converts the protocol's `u32`; `is_ok_and` is true only
                    //       for a successful conversion whose value passes the closure's test.
                    // Why: A range starting past the last line belongs to another revision.
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // if (item.range.start.line >= lineCount) return 'lineOutOfRange';
                    // ```
                    let exists = usize::try_from(item.range.start.line)
                        .is_ok_and(|line| return line < line_count);
                    if !exists {
                        return PushVerdict::LineOutOfRange;
                    }
                }
                Freshness::Unversioned
            }
        };
        // Any later set from the same server replaces its earlier pushed set.
        self.sets
            .retain(|set| return set.pulled || &set.server != server);
        self.sets.push(StoredSet {
            server: server.clone(),
            pulled: false,
            stamp,
            freshness,
            encoding,
            items,
        });
        if freshness == Freshness::Versioned {
            return PushVerdict::AcceptedVersioned;
        }
        return PushVerdict::AcceptedUnversioned;
    }

    /// What:
    ///  Store a full pull answer;
    ///  false when it answers another revision or file.
    ///       `Option<String>` is the result identifier the server may attach.
    /// Why:
    ///  A pull answer is fenced like every other reply:
    ///  only the displayed text counts.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// pulledFull(server, encoding, stamp, resultId: string | undefined, items): boolean
    /// ```
    pub(crate) fn pulled_full(
        &mut self,
        server: &ServerIdentity,
        encoding: OffsetEncoding,
        stamp: DocumentStamp,
        result_id: Option<String>,
        items: Vec<lsp::Diagnostic>,
    ) -> bool {
        if self
            .document
            .as_ref()
            .is_none_or(|tracked| return tracked.stamp != stamp)
        {
            return false;
        }
        self.sets
            .retain(|set| return !set.pulled || &set.server != server);
        self.result_ids.retain(|(known, _)| return known != server);
        if let Some(identifier) = result_id {
            self.result_ids.push((server.clone(), identifier));
        }
        self.sets.push(StoredSet {
            server: server.clone(),
            pulled: true,
            stamp,
            freshness: Freshness::Pulled,
            encoding,
            items,
        });
        return true;
    }

    /// The server said its previous pull answer still holds:
    ///  re-stamp it for the displayed text.
    pub(crate) fn pulled_unchanged(
        &mut self,
        server: &ServerIdentity,
        stamp: DocumentStamp,
        result_id: String,
    ) -> bool {
        if self
            .document
            .as_ref()
            .is_none_or(|tracked| return tracked.stamp != stamp)
        {
            return false;
        }
        // `iter_mut` hands out modifiable borrows so the stored set can be re-stamped in place.
        for set in self.sets.iter_mut() {
            if set.pulled && &set.server == server {
                set.stamp = stamp;
                self.result_ids.retain(|(known, _)| return known != server);
                self.result_ids.push((server.clone(), result_id));
                return true;
            }
        }
        return false;
    }

    /// What:
    ///  The identifier to send with the next pull request,
    ///  or nothing.
    /// Why:
    ///  It is offered only while the set it refers to is still stored;
    ///  otherwise an
    ///      "unchanged" answer would leave nothing to show.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// previousResultId(server: ServerIdentity): string | undefined
    /// ```
    pub(crate) fn previous_result_id(&self, server: &ServerIdentity) -> Option<String> {
        let stored = self
            .sets
            .iter()
            .any(|set| return set.pulled && &set.server == server);
        if !stored {
            // `None` is the "nothing" variant of `Option`.
            return None;
        }
        for (known, identifier) in &self.result_ids {
            if known == server {
                return Some(identifier.clone());
            }
        }
        return None;
    }

    /// A server process ended:
    ///  its sets,
    ///  hold,
    ///  and result identifier are removed.
    pub(crate) fn server_exited(&mut self, server: &ServerIdentity) {
        self.sets.retain(|set| return &set.server != server);
        self.holds.retain(|hold| return &hold.server != server);
        self.result_ids.retain(|(known, _)| return known != server);
    }

    /// What:
    ///  Build the latest-value snapshot against the displayed text,
    ///  or nothing when no file
    ///       is displayed.
    ///  Only sets stamped with the displayed revision take part.
    /// Why:
    ///  Sets of an earlier revision are removed from display,
    ///  never carried forward.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// snapshot(text: Rope): DiagnosticsSnapshot | undefined
    /// ```
    pub(crate) fn snapshot(&self, text: &Rope) -> Option<DiagnosticsSnapshot> {
        // The trailing `?` returns `None` when no document is tracked.
        let tracked = self.document.as_ref()?;
        let mut groups: Vec<SourceGroup> = Vec::new();
        for set in &self.sets {
            if set.stamp != tracked.stamp {
                continue;
            }
            for raw in &set.items {
                // `if let Some(x) = ...` runs the block only when conversion produced a value.
                if let Some(item) = convert(raw, text, set.encoding, &set.server, set.freshness) {
                    // What: `as_deref()` turns `Option<String>` into `Option<&str>`;
                    //       `unwrap_or("")` substitutes empty text for "nothing".
                    // Why: A server that names no source still gets one group.
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // addToGroup(groups, raw.source ?? '', item);
                    // ```
                    add_to_group(&mut groups, raw.source.as_deref().unwrap_or(""), item);
                } else {
                    tracing::debug!(server = %set.server.name, "dropped a diagnostic outside the displayed text");
                }
            }
        }
        // What: `sort_by` orders in place; `cmp` compares two values and returns their ordering.
        // Why: A stable order keeps equal snapshots equal, so unchanged state is not republished.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // groups.sort((left, right) => left.source.localeCompare(right.source));
        // ```
        groups.sort_by(|left, right| return left.source.cmp(&right.source));
        for group in groups.iter_mut() {
            group.items.sort_by(|left, right| {
                return (left.start, left.end).cmp(&(right.start, right.end));
            });
        }
        return Some(DiagnosticsSnapshot {
            stamp: tracked.stamp,
            groups,
        });
    }
}
