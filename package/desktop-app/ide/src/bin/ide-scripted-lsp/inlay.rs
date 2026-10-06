//! The inlay-hint answer, and holding back the first answer so a later request is answered first.

/// Framing and the report.
use crate::framing::Wire;
/// What: `Value` is any JSON value; `json!` builds one from literal syntax.
/// Why: The answer is one JSON object.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Value = unknown;
/// ```
use serde_json::{Value, json};

/// What: The fixed answer to one `textDocument/inlayHint` request with request number `id`.
///       `&Value` lends the number. The answer ignores the requested range.
/// Why: One hint has label parts, a kind, padding, edits, and resolve data the client must
///      ignore; the other names a line past the end of every test text, which the client drops.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function answer(id: unknown): object { return { id, result: [/* two hints */] }; }
/// ```
fn answer(id: &Value) -> Value {
    return json!({ "id": id, "result": [
        {
            "position": { "line": 0, "character": 5 },
            "label": [{ "value": "part-a" }, { "value": "-part-b", "command": { "title": "x", "command": "scripted.command" } }],
            "kind": 1,
            "paddingLeft": true,
            "textEdits": [{ "range": { "start": { "line": 0, "character": 5 }, "end": { "line": 0, "character": 5 } }, "newText": ": T" }],
            "data": { "resolveMe": true },
        },
        { "position": { "line": 99, "character": 0 }, "label": "past-end" },
    ] });
}

/// Write one message, turning a write failure into a line on standard error.
fn send(wire: &Wire, message: Value) {
    if let Err(error) = wire.send(message) {
        eprintln!("scripted language server cannot write an inlay-hint answer: {error}");
    }
}

/// What: Answer one hint request. `seen` counts the hint requests of this process, this one
///       included; with `hold_first`, the first answer is kept in `held` and written right after
///       the second answer. `&mut Option<Value>` lends the slot for changing; `u64` is an
///       unsigned 64-bit count (siblings: `u32`, `usize`).
/// Why: The client then receives the answer to its earlier request after the answer to its
///      later one, on the same stream, in that order however busy the machine is, which is the
///      order a server that answers out of order produces.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function respond(wire: Wire, id: unknown, seen: number, holdFirst: boolean, held: { value?: object }): void {
///   if (holdFirst && seen === 1) { held.value = answer(id); return; }
///   wire.send(answer(id));
///   if (held.value) { wire.send(held.value); held.value = undefined; }
/// }
/// ```
pub fn respond(wire: &Wire, id: &Value, seen: u64, hold_first: bool, held: &mut Option<Value>) {
    if hold_first && seen == 1 {
        // `Some(...)` is the "value present" variant of `Option`: the answer waits in the slot.
        *held = Some(answer(id));
        return;
    }
    send(wire, answer(id));
    // What: `take()` moves the held answer out of the slot and leaves "nothing" behind.
    // Why: The held answer is written exactly once, after the later answer.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const late = held.value; held.value = undefined; if (late) wire.send(late);
    // ```
    if let Some(late) = held.take() {
        send(wire, late);
    }
}
