//! Counting-set simulation of a linear program under unanchored search.

/// Imports the ordered set holding each counted element's live repetition counts.
use std::collections::BTreeSet;

/// Imports the word predicate used to build the boundary context.
use crate::charset::is_word_byte;

/// Imports the boundary context that resolves anchors.
use crate::context::Ctx;

/// Imports the element IR being simulated.
use crate::counting::element::{Element, LinearProgram};

/// Live simulation state: which control points are reached and each counter's set.
///
/// What: `before[p]` means control is poised before element `p`, with `p == len`
/// the accepting point; `counts[p]` holds the live repetition counts of a `Counted`
/// element and is empty otherwise. Why: grouping counts into one per-element set is
/// the whole device, it keeps overlapping repetitions in a single set instead of
/// exploding the state count.
struct State {
    /// One reached-flag per control point `0..=len`.
    before: Vec<bool>,
    /// One value-set per element index `0..len`.
    counts: Vec<BTreeSet<u32>>,
}

/// The match entry point for the counting back-end.
impl LinearProgram {
    /// Reports whether the linear pattern matches some substring of `line`.
    ///
    /// What: runs the counting-set simulation, returning at the first accepting
    /// boundary. Why: the counting back-end's boolean answer for one pattern.
    ///
    /// @example
    /// ```ignore
    /// let prog = linearize(&parse("[A-Z]{2}").unwrap()).unwrap();
    /// assert!(prog.is_match(b"xxAB"));
    /// ```
    pub fn is_match(&self, line: &[u8]) -> bool {
        run(&self.elements, line)
    }
}

/// Runs the simulation across every boundary, returning true on first acceptance.
///
/// What: at each boundary seed a fresh start (the `Σ*` search prefix), take the
/// zero-width closure, test acceptance, then consume the next byte. Why: a match
/// may start at any position and end at any boundary, so both seeding and the
/// accept test happen at every boundary.
fn run(elements: &[Element], line: &[u8]) -> bool {
    let len = elements.len();
    let mut state = State {
        before: vec![false; len + 1],
        counts: vec![BTreeSet::new(); len],
    };
    for i in 0..=line.len() {
        // What: the search prefix keeps a fresh start live at every boundary.
        // Why: a match may begin at this position.
        state.before[0] = true;
        let ctx = boundary_ctx(line, i);
        closure(elements, &mut state, ctx);
        if state.before[len] {
            return true;
        }
        if i == line.len() {
            break;
        }
        state = step(elements, &state, line[i]);
    }
    false
}

/// Builds the boundary context at position `i` between (or at the ends of) `line`.
///
/// What: line starts after a newline or at the front; line ends before a newline or
/// at the back; word flags read the adjacent bytes. Why: mirrors exactly the
/// context the eager DFA uses, so both back-ends agree on anchors.
fn boundary_ctx(line: &[u8], i: usize) -> Ctx {
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
fn closure(elements: &[Element], state: &mut State, ctx: Ctx) {
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
        Element::Counted { .. } => state.counts[p].insert(0),
        Element::LineStart => set_before(state, p + 1, ctx.line_start),
        Element::LineEnd => set_before(state, p + 1, ctx.line_end),
        Element::WordBoundary => set_before(state, p + 1, ctx.word_before != ctx.word_after),
    }
}

/// Exits a counted element to the next point once its set meets the bound.
///
/// What: if any live count of a `Counted` element lies in `[min, max]`, mark the
/// following control point. Why: this fires for counts carried from earlier bytes,
/// so it must run whether or not the element's front is freshly reached.
fn exit_move(element: &Element, p: usize, state: &mut State) -> bool {
    if let Element::Counted { min, max, .. } = element {
        let ready = range_has(&state.counts[p], *min, *max);
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

/// Reports whether `set` holds any value in the inclusive range `[min, max]`.
///
/// What: a single ordered-range probe. Why: the counted exit guard tests the set
/// against the bound without scanning every value.
fn range_has(set: &BTreeSet<u32>, min: usize, max: usize) -> bool {
    set.range(min as u32..=max as u32).next().is_some()
}

/// Consumes one byte, producing the next simulation state.
///
/// What: a reached class advances on a matching byte; a counted element's live
/// counts each step up by one (while below `max`) on a matching byte; anchors are
/// zero-width and drop. Why: this is the only place input is consumed, and the
/// counted increment is the counting-set update that avoids new states.
fn step(elements: &[Element], state: &State, b: u8) -> State {
    let len = elements.len();
    let mut next = State {
        before: vec![false; len + 1],
        counts: vec![BTreeSet::new(); len],
    };
    for (p, element) in elements.iter().enumerate() {
        match element {
            Element::Class(set) => {
                if state.before[p] && set.contains(b) {
                    next.before[p + 1] = true;
                }
            }
            Element::Counted { set, max, .. } => {
                if set.contains(b) {
                    advance_counts(&state.counts[p], *max, &mut next.counts[p]);
                }
            }
            Element::LineStart | Element::LineEnd | Element::WordBoundary => {}
        }
    }
    next
}

/// Increments every live count below `max`, writing results into `out`.
///
/// What: maps each `s < max` to `s + 1`. Why: a matched byte advances every active
/// repetition by one; counts at `max` have already exited and are dropped.
fn advance_counts(counts: &BTreeSet<u32>, max: usize, out: &mut BTreeSet<u32>) {
    for &s in counts {
        if (s as usize) < max {
            out.insert(s + 1);
        }
    }
}

/// Differential tests against the eager DFA plus a serialized-size proof.
///
/// What: lives in a separate `*_tests.rs` file (exempt from the line and rustdoc
/// budgets). Why: keeps the simulation file within its budget while still proving
/// the counting back-end against the trusted oracle.
#[cfg(test)]
#[path = "run_tests.rs"]
mod tests;
