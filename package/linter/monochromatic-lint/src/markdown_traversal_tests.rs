//! What: Deliberately damaged native arenas exercising the source adapter's validation guards.
//! Why: Parser-generated happy paths cannot prove rejection of corrupt child graphs and byte ranges.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // Prove a valid arena is accepted, mutate one invariant, then require the exact processing failure.
//! ```

/// Import the real guard boundary and installed arena construction API.
use super::{MarkdownError, traversal};
use satteri_arena::{Arena, Mdast};
use satteri_ast::mdast::MdastNodeType;

/// Construct an actual arena with a root and one reachable child.
fn valid_arena() -> Arena<Mdast> {
    // Owned UTF-8 text contains one astral character so midpoint byte offsets are distinguishable.
    let mut arena: Arena<Mdast> = Arena::<Mdast>::new(String::from("🚀x"));
    let root: u32 = arena.alloc_node(MdastNodeType::Root as u8);
    let child: u32 = arena.alloc_node(MdastNodeType::Paragraph as u8);
    arena.set_position(root, 0, 5, 1, 1, 1, 4);
    arena.set_position(child, 0, 5, 1, 1, 1, 4);
    arena.set_children(root, &[child]);
    // The positive control checks the same path and exact bytes later corruption tests mutate.
    assert!(traversal(&arena, "🚀x", 0).is_ok());
    return arena;
}

/// Extract the operational failure without requiring Debug on the successful traversal indexes.
fn rejected(arena: &Arena<Mdast>) -> MarkdownError {
    match traversal(arena, "🚀x", 0) {
        Ok(_) => panic!("corrupted native arena must be rejected"),
        Err(error) => return error,
    }
}

/// Repeated valid ids and individually invalid ids are independent rejection paths.
#[test]
fn child_graph_rejects_duplicate_invalid_and_cyclic_ids() {
    let mut duplicate: Arena<Mdast> = valid_arena();
    duplicate.set_children(0, &[1, 1]);
    assert!(rejected(&duplicate).message.contains("invalid or repeated child"));
    let mut invalid: Arena<Mdast> = valid_arena();
    invalid.children[0] = 99;
    assert!(rejected(&invalid).message.contains("invalid or repeated child"));
    let mut cyclic: Arena<Mdast> = valid_arena();
    cyclic.children[0] = 0;
    assert!(rejected(&cyclic).message.contains("invalid or repeated child"));
}

/// Every source-range predicate fails independently, not only when several defects happen together.
#[test]
fn source_ranges_reject_reversal_out_of_bounds_and_each_utf8_midpoint() {
    for (start, end) in [(5, 4), (0, 6), (1, 4), (0, 1)] {
        let mut arena: Arena<Mdast> = valid_arena();
        arena.nodes[1].start_offset = start;
        arena.nodes[1].end_offset = end;
        let error: MarkdownError = rejected(&arena);
        assert!(error.message.contains("outside UTF-8 boundaries"));
        assert!(error.offset <= 5);
    }
}

/// Missing roots, unknown kinds and a valid-but-wrong entry kind remain distinct diagnostics.
#[test]
fn root_and_kind_validation_does_not_assume_a_valid_parser_result() {
    let empty: Arena<Mdast> = Arena::<Mdast>::new(String::from("🚀x"));
    assert!(rejected(&empty).message.contains("no root node"));
    let mut unknown: Arena<Mdast> = valid_arena();
    unknown.nodes[1].node_type = u8::MAX;
    assert!(rejected(&unknown).message.contains("unknown node kind"));
    let mut wrong_root: Arena<Mdast> = valid_arena();
    wrong_root.nodes[0].node_type = MdastNodeType::Paragraph as u8;
    assert!(rejected(&wrong_root).message.contains("non-root entry node"));
}

/// An invalid flat child-list range is rejected before the arena's unchecked accessor is called.
#[test]
fn child_list_bounds_are_checked_before_borrowing() {
    let mut arena: Arena<Mdast> = valid_arena();
    arena.nodes[0].children_start = 99;
    assert!(rejected(&arena).message.contains("out-of-range child list"));
}
