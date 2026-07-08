//! The pane-strip state machine: columns of panes, spawn-with-dedup, focus, and close.
//!
//! Pure and GTK-free so the Niri spawn/dedup/close rules (docs/planning/file-manager.md) unit-test
//! directly. The UI layer (strip/spawn modules) renders this state and calls its mutators.

/// What: imports the hash-map container.
/// Why: pane lookup by id and the location-keyed dedup index are both hash maps.
use std::collections::HashMap;

/// What: imports the pane identity and location domain types.
/// Why: the state machine keys panes by `PaneId` and deduplicates by `PaneLocation`.
use crate::types::{PaneId, PaneLocation};

/// What: one pane in the strip: its id, what it shows, and which column it sits in.
/// Why: a pane's horizontal position is its column (lineage depth); its vertical position is its
///      index within that column's ordered list.
#[derive(Clone, Debug)]
pub struct Pane {
    /// Stable identity, unique for this pane's lifetime.
    pub id: PaneId,
    /// What the pane shows; also the dedup key unless the pane is a forced duplicate.
    pub location: PaneLocation,
    /// Zero-based column index; a child sits one column right of its parent.
    pub column: usize,
}

/// What: the whole strip: every live pane, the column layout, the active pane, and the dedup
///       index (location -> canonical pane, absent for forced duplicates).
/// Why: panes die only on explicit close, with no automatic pruning, so this owns identities for
///      their whole lifetime; `Default` gives the empty strip a fresh session starts from.
#[derive(Default)]
pub struct PaneStripState {
    /// Next id to mint; increments so ids are never reused within a session.
    next_id: u64,
    /// Every live pane keyed by id.
    panes: HashMap<PaneId, Pane>,
    /// Ordered pane ids per column; `columns[c]` stacks the panes at lineage depth `c`.
    columns: Vec<Vec<PaneId>>,
    /// The focused pane, if any; cleared when that pane is closed.
    active: Option<PaneId>,
    /// Location -> canonical pane, the lookup that makes revisits dedup-and-focus.
    dedup: HashMap<PaneLocation, PaneId>,
}

/// What: constructors, spawn/dedup/focus mutators, and read accessors for the pane strip.
/// Why: the single place the Niri interaction rules live, tested independently of GTK.
impl PaneStripState {
    /// What: build an empty strip.
    /// Why: a fresh session (or a not-yet-restored one) starts with no panes.
    pub fn new() -> Self {
        Self::default()
    }

    /// What: open a root pane for `location` in column 0, deduplicating first.
    /// Why: the initial directory (and any OS-detached open handled elsewhere) has no parent; if a
    ///      pane already shows this location, focus it instead of spawning a second.
    pub fn open_root(&mut self, location: PaneLocation) -> PaneId {
        if let Some(&existing) = self.dedup.get(&location) {
            self.active = Some(existing);
            return existing;
        }
        self.insert_pane(location, 0, true)
    }

    /// What: spawn a child of `parent` showing `location`, one column to the right, and focus it;
    ///       `force_duplicate` skips dedup to mint a fresh pane even when one already exists.
    /// Why: single-click descent spawns children that dedup-and-focus on revisit, while a modifier
    ///      (Ctrl+click) deliberately mints a duplicate that is not registered for future dedup.
    pub fn spawn_child(
        &mut self,
        parent: PaneId,
        location: PaneLocation,
        force_duplicate: bool,
    ) -> PaneId {
        if !force_duplicate
            && let Some(&existing) = self.dedup.get(&location)
        {
            self.active = Some(existing);
            return existing;
        }
        let parent_column = self.panes.get(&parent).map_or(0, |pane| pane.column);
        self.insert_pane(location, parent_column + 1, !force_duplicate)
    }

    /// What: focus `id` when it names a live pane.
    /// Why: keyboard and pointer selection move the active pane; a stale id is ignored.
    pub fn focus(&mut self, id: PaneId) {
        if self.panes.contains_key(&id) {
            self.active = Some(id);
        }
    }

    /// What: close one pane, removing it from the panes map, its column, and the dedup index when
    ///       it was that location's canonical pane.
    /// Why: explicit close is the only way a pane dies; clearing the dedup entry lets a later
    ///      visit spawn a fresh pane rather than focus a dead id.
    pub fn close(&mut self, id: PaneId) {
        let Some(pane) = self.panes.remove(&id) else {
            return;
        };
        if self.dedup.get(&pane.location) == Some(&id) {
            self.dedup.remove(&pane.location);
        }
        if let Some(column) = self.columns.get_mut(pane.column) {
            column.retain(|&candidate| candidate != id);
        }
        if self.active == Some(id) {
            self.active = None;
        }
    }

    /// What: close every pane in `column` (the "close column" bulk gesture).
    /// Why: spawn-on-descent accumulates panes, so bulk-close is required early; snapshot the ids
    ///      first because `close` mutates the column vector as it goes.
    pub fn close_column(&mut self, column: usize) {
        let ids = self.columns.get(column).cloned().unwrap_or_default();
        for id in ids {
            self.close(id);
        }
    }

    /// What: close every column to the right of `column` (the "close everything right of here"
    ///       bulk gesture).
    /// Why: descending then backing up leaves a tail of panes; one gesture clears the tail.
    pub fn close_right_of(&mut self, column: usize) {
        for col in (column + 1)..self.columns.len() {
            self.close_column(col);
        }
    }

    /// What: the currently focused pane id, if any.
    /// Why: the renderer highlights it and routes keyboard input to it.
    pub fn active(&self) -> Option<PaneId> {
        self.active
    }

    /// What: borrow a pane by id.
    /// Why: the renderer reads a pane's location and column to place and fill it.
    pub fn pane(&self, id: PaneId) -> Option<&Pane> {
        self.panes.get(&id)
    }

    /// What: the column layout: ordered pane ids per column.
    /// Why: the fixed-canvas renderer walks columns to place panes at their `(column, row)` slots.
    pub fn columns(&self) -> &[Vec<PaneId>] {
        &self.columns
    }

    /// What: number of live panes.
    /// Why: cheap invariant check for tests and instrumentation.
    pub fn len(&self) -> usize {
        self.panes.len()
    }

    /// What: whether the strip holds no panes.
    /// Why: pairs with `len` (clippy) and gates first-open behavior.
    pub fn is_empty(&self) -> bool {
        self.panes.is_empty()
    }

    /// What: mint a fresh, never-reused pane id.
    /// Why: identity must survive duplicates and closes, so ids only ever increase.
    fn mint_id(&mut self) -> PaneId {
        let id = PaneId(self.next_id);
        self.next_id += 1;
        id
    }

    /// What: create a pane at `column`, optionally registering it for dedup, and focus it.
    /// Why: the shared tail of `open_root` and `spawn_child`; `register_dedup` is false only for
    ///      forced duplicates so future visits do not focus the extra pane.
    fn insert_pane(&mut self, location: PaneLocation, column: usize, register_dedup: bool) -> PaneId {
        let id = self.mint_id();
        if register_dedup {
            self.dedup.insert(location.clone(), id);
        }
        self.ensure_column(column).push(id);
        self.panes.insert(id, Pane { id, location, column });
        self.active = Some(id);
        id
    }

    /// What: grow the column vector so index `column` exists, then borrow that column mutably.
    /// Why: a child may open a column that does not exist yet; new columns start empty.
    fn ensure_column(&mut self, column: usize) -> &mut Vec<PaneId> {
        if self.columns.len() <= column {
            self.columns.resize_with(column + 1, Vec::new);
        }
        &mut self.columns[column]
    }
}
