//! Latest accepted inlay hints and diagnostics for the displayed text.
//!
//! The Language module publishes both as latest-value snapshots. This store keeps the newest one
//! of each that describes the displayed file and revision, and hands it out only while it still
//! does, so the source renderer never places hints or diagnostics by offsets of another text.

/// The snapshot types and the identity they carry.
use ide_app::language::{
    diagnostics::DiagnosticsSnapshot, hints::HintsSnapshot, identity::DocumentStamp,
};
/// What: `Arc` is a thread-safe shared pointer (siblings: `Rc` for one thread, `Box` for one owner).
/// Why: The worker publishes snapshots behind `Arc`; keeping the pointer avoids copying them.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Arc<T> = T;
/// ```
use std::sync::Arc;

/// What: The two latest snapshots. `Option<Arc<...>>` is "a shared snapshot, or nothing";
///       `#[derive(Default)]` makes `Annotations::default()` start with nothing.
/// Why: Hints and diagnostics arrive independently and are replaced independently.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// class Annotations { hints?: HintsSnapshot; diagnostics?: DiagnosticsSnapshot; }
/// ```
#[derive(Debug, Default)]
pub(in crate::native) struct Annotations {
    /// Latest accepted hints.
    hints: Option<Arc<HintsSnapshot>>,
    /// Latest accepted diagnostics.
    diagnostics: Option<Arc<DiagnosticsSnapshot>>,
}

/// Accepting and reading snapshots; every read names the text it is for.
impl Annotations {
    /// What: Hints for `displayed`, or nothing when the stored hints describe other text.
    ///       `Option<&HintsSnapshot>` lends the snapshot without copying it.
    /// Why: The renderer asks with the stamp of what it is about to draw.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// hintsFor(displayed: DocumentStamp): HintsSnapshot | undefined
    /// ```
    pub(in crate::native) fn hints(&self, displayed: DocumentStamp) -> Option<&HintsSnapshot> {
        // `as_deref` lends the snapshot inside the shared pointer; `filter` keeps it only when it matches.
        return self
            .hints
            .as_deref()
            .filter(|snapshot| return snapshot.stamp == displayed);
    }

    /// Diagnostics for `displayed`, or nothing when the stored ones describe other text.
    pub(in crate::native) fn diagnostics(
        &self,
        displayed: DocumentStamp,
    ) -> Option<&DiagnosticsSnapshot> {
        return self
            .diagnostics
            .as_deref()
            .filter(|snapshot| return snapshot.stamp == displayed);
    }

    /// Store hints that describe `displayed`; returns false and keeps the old ones otherwise.
    pub(super) fn accept_hints(
        &mut self,
        displayed: DocumentStamp,
        snapshot: Arc<HintsSnapshot>,
    ) -> bool {
        if snapshot.stamp != displayed {
            return false;
        }
        // `Some(...)` stores the snapshot as the present value.
        self.hints = Some(snapshot);
        return true;
    }

    /// Store diagnostics that describe `displayed`; returns false and keeps the old ones otherwise.
    pub(super) fn accept_diagnostics(
        &mut self,
        displayed: DocumentStamp,
        snapshot: Arc<DiagnosticsSnapshot>,
    ) -> bool {
        if snapshot.stamp != displayed {
            return false;
        }
        self.diagnostics = Some(snapshot);
        return true;
    }
}
