//! Counting-set simulation of a linear program under unanchored search.

/// Imports the linear program matched here.
use crate::counting::element::{Element, LinearProgram};

/// Imports the shared simulation core.
use crate::counting::sim::{State, boundary_ctx, closure, step};

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
    let mut state = State::new(elements.len());
    for i in 0..=line.len() {
        // What: the search prefix keeps a fresh start live at every boundary.
        // Why: a match may begin at this position.
        state.seed();
        let ctx = boundary_ctx(line, i);
        closure(elements, &mut state, ctx);
        if state.accepts() {
            return true;
        }
        if i == line.len() {
            break;
        }
        state = step(elements, &state, line[i]);
    }
    false
}

/// Differential tests against the eager DFA plus a serialized-size proof.
///
/// What: lives in a separate `*_tests.rs` file (exempt from the line and rustdoc
/// budgets). Why: keeps the simulation file within its budget while still proving
/// the counting back-end against the trusted oracle.
#[cfg(test)]
#[path = "run_tests.rs"]
mod tests;
