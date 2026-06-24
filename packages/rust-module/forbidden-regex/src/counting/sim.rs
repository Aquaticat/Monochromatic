//! Shared counting-set simulation primitives over a linear element chain.
//!
//! What: the [`State`] (reached control points plus per-element count bitsets) and
//! the zero-width [`closure`], byte [`step_into`], and boundary helpers that advance
//! it. Why: both the single-pattern search loop and the synchronized product run
//! the same per-operand simulation, so its core lives here once instead of twice;
//! states are reused as ping-pong buffers so the byte step never allocates.

/// Imports the word predicate used to build the boundary context.
use crate::charset::is_word_byte;

/// Imports the boundary context that resolves anchors.
use crate::context::Ctx;

/// Imports the bitset that holds a counted element's live counts.
use crate::counting::countset::CountSet;

/// Imports the element IR being simulated.
use crate::counting::element::Element;

/// Live simulation state: which control points are reached and each counter's set.
///
/// What: `before[p]` means control is poised before element `p`, with `p == len`
/// the accepting point; `counts[p]` holds the live repetition counts of a `Counted`
/// element and is empty otherwise. Why: grouping counts into one per-element bitset
/// is the whole device, it keeps overlapping repetitions in one word-addressable
/// set instead of exploding the state count.
pub(crate) struct State {
    /// One reached-flag per control point `0..=len`.
    pub(crate) before: Vec<bool>,
    /// One count bitset per element index `0..len`.
    pub(crate) counts: Vec<CountSet>,
}

/// Construction, reuse, and predicates over a simulation state.
impl State {
    /// Builds an empty state shaped for `elements`.
    ///
    /// What: `len + 1` reached-flags and one count bitset per element, each sized to
    /// that element's bound. Why: the extra flag is the accepting control point, and
    /// sizing the bitsets once lets them be cleared and reused without reallocation.
    pub(crate) fn new(elements: &[Element]) -> State {
        State {
            before: vec![false; elements.len() + 1],
            counts: elements.iter().map(count_set_for).collect(),
        }
    }

    /// Builds a state with a fresh start already poised before the first element.
    ///
    /// What: a `new` state then `seed`. Why: the product anchors one thread per
    /// start position, each seeded exactly once at creation.
    pub(crate) fn seeded(elements: &[Element]) -> State {
        let mut state = State::new(elements);
        state.seed();
        state
    }

    /// Empties the state in place for reuse as a ping-pong buffer.
    ///
    /// What: clears every reached-flag and count bitset without reallocating. Why:
    /// the byte step fills a cleared destination buffer, so no allocation happens
    /// per byte.
    pub(crate) fn clear(&mut self) {
        self.before.iter_mut().for_each(|reached| *reached = false);
        self.counts.iter_mut().for_each(CountSet::clear);
    }

    /// Marks the first control point as reached.
    ///
    /// What: sets `before[0]`. Why: the search loop re-seeds this every boundary
    /// for the `Σ*` prefix; a product thread seeds it once at its start.
    pub(crate) fn seed(&mut self) {
        self.before[0] = true;
    }

    /// Reports whether control has reached the accepting point.
    ///
    /// What: the last reached-flag (index `len`). Why: reaching past the final
    /// element is acceptance.
    pub(crate) fn accepts(&self) -> bool {
        self.before.last().copied().unwrap_or(false)
    }

    /// Reports whether the state can never reach acceptance again.
    ///
    /// What: no control point is reached and every count bitset is empty. Why: a
    /// product thread whose required operand has gone dead can be dropped, which
    /// bounds the number of live threads by the longest operand.
    pub(crate) fn is_dead(&self) -> bool {
        self.before.iter().all(|&reached| !reached) && self.counts.iter().all(CountSet::is_empty)
    }
}

/// Builds the count bitset for one element, sized to its repetition bound.
///
/// What: a `Counted` element gets a set holding `[0, max]`; any other element gets a
/// minimal placeholder never used. Why: only counted elements carry counts, but a
/// uniform per-index vector keeps the simulation's indexing simple.
fn count_set_for(element: &Element) -> CountSet {
    match element {
        Element::Counted { max, .. } => CountSet::new(*max),
        _ => CountSet::new(0),
    }
}

/// Builds the boundary context at position `i` between (or at the ends of) `line`.
///
/// What: line starts after a newline or at the front; line ends before a newline or
/// at the back; word flags read the adjacent bytes. Why: mirrors exactly the
/// context the eager DFA uses, so both back-ends agree on anchors.
pub(crate) fn boundary_ctx(line: &[u8], i: usize) -> Ctx {
    let len = line.len();
    Ctx {
        line_start: i == 0 || line[i - 1] == b'\n',
        line_end: i == len || line[i] == b'\n',
        word_before: i > 0 && is_word_byte(line[i - 1]),
        word_after: i < len && is_word_byte(line[i]),
    }
}

/// Expands live control points through every zero-width move to a fixpoint.
///
/// What: passes anchors when `ctx` permits, enters a `Counted` element by seeding
/// count 0, and exits one whose set already meets its bound; loops until stable.
/// Why: zero-width moves chain (adjacent anchors, a skippable repetition), so one
/// pass is not enough.
pub(crate) fn closure(elements: &[Element], state: &mut State, ctx: Ctx) {
    let mut changed = true;
    while changed {
        changed = false;
        for (p, element) in elements.iter().enumerate() {
            if entry_move(element, p, state, ctx) {
                changed = true;
            }
            if exit_move(element, p, state) {
                changed = true;
            }
        }
    }
}

/// Applies the zero-width move out of a reached element's front.
///
/// What: for a reached anchor, pass to the next point when `ctx` allows; for a
/// reached counted element, seed count 0. Why: these are the moves that depend on
/// the control point being live this pass.
fn entry_move(element: &Element, p: usize, state: &mut State, ctx: Ctx) -> bool {
    if !state.before[p] {
        return false;
    }
    match element {
        Element::Class(_) => false,
        Element::Counted { .. } => state.counts[p].insert_zero(),
        Element::LineStart => set_before(state, p + 1, ctx.line_start),
        Element::LineEnd => set_before(state, p + 1, ctx.line_end),
        Element::WordBoundary => set_before(state, p + 1, ctx.word_before != ctx.word_after),
    }
}

/// Exits a counted element to the next point once its set meets the bound.
///
/// What: if any live count of a `Counted` element is at least `min`, mark the
/// following control point. Why: this fires for counts carried from earlier bytes,
/// so it must run whether or not the element's front is freshly reached.
fn exit_move(element: &Element, p: usize, state: &mut State) -> bool {
    if let Element::Counted { min, .. } = element {
        let ready = state.counts[p].has_at_least(*min);
        if ready && !state.before[p + 1] {
            state.before[p + 1] = true;
            return true;
        }
    }
    false
}

/// Marks control point `q` when `cond` holds and it was not already marked.
///
/// What: a guarded set that reports whether it changed anything. Why: the closure
/// fixpoint needs to know when a pass made progress.
fn set_before(state: &mut State, q: usize, cond: bool) -> bool {
    if cond && !state.before[q] {
        state.before[q] = true;
        true
    } else {
        false
    }
}

/// Consumes one byte, writing the next state into a reused destination buffer.
///
/// What: clears `dst`, then a reached class advances on a matching byte and a
/// counted element's live counts each step up by one (capped at `max`) on a
/// matching byte; anchors are zero-width and drop. Why: this is the only place
/// input is consumed; filling a reused buffer keeps the byte step allocation-free
/// and the counted update a single word-level shift.
pub(crate) fn step_into(elements: &[Element], src: &State, b: u8, dst: &mut State) {
    dst.clear();
    for (p, element) in elements.iter().enumerate() {
        match element {
            Element::Class(set) => {
                if src.before[p] && set.contains(b) {
                    dst.before[p + 1] = true;
                }
            }
            Element::Counted { set, max, .. } => {
                if set.contains(b) {
                    dst.counts[p].copy_advanced_from(&src.counts[p], *max);
                }
            }
            Element::LineStart | Element::LineEnd | Element::WordBoundary => {}
        }
    }
}
