//! Synchronized-product back-end for intersection and complement over linear
//! operands.
//!
//! What: a [`ProductProgram`] holds positive operands (each must match the same
//! span) and negative operands (none may match that span, the `~(...)` operands),
//! matched by running every operand in lockstep per start position. Why: under
//! `Σ*·(A & ~B)` the SAME substring must satisfy `A` and fail `B`, so the operands
//! cannot be run as independent search automata (they would match different spans);
//! one thread per start keeps them synchronized while each operand's counts still
//! live in a counter-set, so bounded repetition never blows up.

/// Imports the serde derives so a product program can be persisted.
use serde::{Deserialize, Serialize};

/// Imports the node algebra the linearizer reads.
use crate::ast::node::Node;

/// Imports the boundary context threaded through the closure.
use crate::context::Ctx;

/// Imports the linear operand IR and its linearizer.
use crate::counting::element::{LinearProgram, linearize};

/// Imports the shared simulation core.
use crate::counting::sim::{State, boundary_ctx, closure, step};

/// Imports the error type for validating a decoded program.
use crate::error::CompileError;

/// An intersection of linear operands, some of them complemented.
///
/// What: the positives that must all match one span and the negatives that must
/// all fail that same span. Why: the serializable, counter-aware back-end for
/// `&`/`~` patterns whose operands are each linear; its size is linear in the
/// pattern, never in any repetition bound.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ProductProgram {
    /// Operands that must each match the same span.
    pub positives: Vec<LinearProgram>,
    /// Operands whose match would veto the span (the `~(...)` operands).
    pub negatives: Vec<LinearProgram>,
}

/// Matching and decode validation for a product program.
impl ProductProgram {
    /// Reports whether some span satisfies every positive and no negative.
    ///
    /// What: runs the synchronized-product simulation. Why: the boolean answer for
    /// an intersection-with-complement pattern.
    pub fn is_match(&self, line: &[u8]) -> bool {
        run_product(self, line)
    }

    /// Checks that a decoded product program is safe to run on untrusted input.
    ///
    /// What: requires at least one positive operand and validates every operand.
    /// Why: a program with no positive would accept on the empty span everywhere,
    /// and each operand allocates counter-sets sized by its decoded bound.
    pub fn validate(&self) -> Result<(), CompileError> {
        if self.positives.is_empty() {
            return Err(CompileError::Invalid {
                message: "product program has no positive operand".to_string(),
            });
        }
        for operand in self.positives.iter().chain(&self.negatives) {
            operand.validate()?;
        }
        Ok(())
    }
}

/// Attempts to express `node` as a product of linear operands.
///
/// What: a `Node::Inter` whose operands each linearize, splitting `Comp` operands
/// into the negatives and the rest into the positives; returns `None` for anything
/// else or when no positive remains. Why: those shapes need the derivative DFA, so
/// the caller falls back to it; this back-end claims only the linear `&`/`~` cases.
///
/// @example
/// ```ignore
/// // (?:AKIA[A-Z2-7]{16}) & ~(AKIA2{16}) -> one positive, one negative operand.
/// let prog = linearize_product(&node).unwrap();
/// assert_eq!((prog.positives.len(), prog.negatives.len()), (1, 1));
/// ```
pub fn linearize_product(node: &Node) -> Option<ProductProgram> {
    let Node::Inter(operands) = node else {
        return None;
    };
    let mut positives: Vec<LinearProgram> = Vec::new();
    let mut negatives: Vec<LinearProgram> = Vec::new();
    for operand in operands {
        match operand {
            Node::Comp(inner) => negatives.push(linearize(inner)?),
            other => positives.push(linearize(other)?),
        }
    }
    if positives.is_empty() {
        return None;
    }
    Some(ProductProgram { positives, negatives })
}

/// One in-flight match attempt anchored at a single start position.
///
/// What: the per-operand simulation state for every positive and negative, all
/// advanced in lockstep over the same bytes. Why: keeping every operand of one
/// start together is what enforces the same-span requirement.
struct Thread {
    /// Per-positive-operand simulation state, in `positives` order.
    positives: Vec<State>,
    /// Per-negative-operand simulation state, in `negatives` order.
    negatives: Vec<State>,
}

/// Runs the product across every boundary, returning true on first acceptance.
///
/// What: seed a fresh thread at each boundary (the `Σ*` prefix), close every live
/// thread, test acceptance, then advance all threads by the next byte. Why: a match
/// may begin at any position, and each thread carries the joint operand state for
/// its own start so acceptance tests one shared span.
fn run_product(prog: &ProductProgram, line: &[u8]) -> bool {
    let mut threads: Vec<Thread> = Vec::new();
    for i in 0..=line.len() {
        threads.push(new_thread(prog));
        let ctx = boundary_ctx(line, i);
        for thread in &mut threads {
            close_thread(prog, thread, ctx);
        }
        if threads.iter().any(accepts) {
            return true;
        }
        if i == line.len() {
            break;
        }
        threads = advance_threads(prog, threads, line[i]);
    }
    false
}

/// Builds a thread seeded for a start at the current boundary.
///
/// What: one seeded `State` per operand. Why: each start gets its own anchored
/// run, seeded exactly once here rather than re-seeded every boundary.
fn new_thread(prog: &ProductProgram) -> Thread {
    Thread {
        positives: prog.positives.iter().map(seed_for).collect(),
        negatives: prog.negatives.iter().map(seed_for).collect(),
    }
}

/// Builds the seeded state for one operand.
///
/// What: a `State::seeded` sized to the operand's chain. Why: a shared tail used by
/// both operand lists when a thread is created.
fn seed_for(operand: &LinearProgram) -> State {
    State::seeded(operand.elements.len())
}

/// Takes the zero-width closure of every operand in a thread.
///
/// What: closes each positive and negative state under the boundary context. Why:
/// anchors and skippable repetitions must settle before the accept test.
fn close_thread(prog: &ProductProgram, thread: &mut Thread, ctx: Ctx) {
    for (state, operand) in thread.positives.iter_mut().zip(&prog.positives) {
        closure(&operand.elements, state, ctx);
    }
    for (state, operand) in thread.negatives.iter_mut().zip(&prog.negatives) {
        closure(&operand.elements, state, ctx);
    }
}

/// Reports whether a thread accepts: all positives match and no negative does.
///
/// What: conjunction over positives with a negation over negatives. Why: this is
/// `A & ~B` evaluated on the one span the thread represents.
fn accepts(thread: &Thread) -> bool {
    thread.positives.iter().all(State::accepts) && thread.negatives.iter().all(|state| !state.accepts())
}

/// Advances every thread by one byte, dropping those that can no longer accept.
///
/// What: steps each thread and keeps it only while every positive stays alive.
/// Why: a dead positive can never match again, so the thread is pruned, which
/// bounds the live-thread count by the longest positive operand.
fn advance_threads(prog: &ProductProgram, threads: Vec<Thread>, b: u8) -> Vec<Thread> {
    threads
        .into_iter()
        .filter_map(|thread| step_thread(prog, &thread, b))
        .collect()
}

/// Steps one thread by a byte, returning `None` if a positive operand died.
///
/// What: steps every operand state, then prunes when any positive is dead. Why:
/// negatives are kept even when dead (a dead negative means `~B` holds), but a dead
/// positive makes the intersection unsatisfiable for this start.
fn step_thread(prog: &ProductProgram, thread: &Thread, b: u8) -> Option<Thread> {
    let positives: Vec<State> = thread
        .positives
        .iter()
        .zip(&prog.positives)
        .map(|(state, operand)| step(&operand.elements, state, b))
        .collect();
    if positives.iter().any(State::is_dead) {
        return None;
    }
    let negatives: Vec<State> = thread
        .negatives
        .iter()
        .zip(&prog.negatives)
        .map(|(state, operand)| step(&operand.elements, state, b))
        .collect();
    Some(Thread { positives, negatives })
}

/// Differential tests against the eager DFA plus a serialized-size proof.
///
/// What: lives in a separate `*_tests.rs` file (exempt from the line and rustdoc
/// budgets). Why: keeps the product file within budget while proving it against the
/// trusted oracle.
#[cfg(test)]
#[path = "product_tests.rs"]
mod tests;
