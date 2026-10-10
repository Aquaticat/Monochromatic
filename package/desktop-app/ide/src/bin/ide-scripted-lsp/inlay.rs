//! The inlay-hint answer, and the scripted steps that leave one unanswered, hold it back, or
//! supersede it.

/// Framing and the report.
use crate::framing::Wire;
/// What a test scripted for this request.
use crate::script::Step;
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

/// What: Answer one hint request as the test scripted it. `step` is what this request gets;
///       `held` is the slot of an answer held back by an earlier request.
///       `&mut Option<Value>` lends the slot for changing.
/// Why: A held answer is written right after the next answer, so the client receives the answer
///      to its earlier request after the answer to its later one, in that order however busy the
///      machine is. A superseded answer makes the client send the request again; the
///      notification after one gives the client a message that is not an answer.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function respond(wire: Wire, id: unknown, step: Step, held: { value?: object }): void {
///   if (step === 'silent') return;
///   if (step === 'hold') { held.value = answer(id); return; }
///   wire.send(step === 'answer' ? answer(id) : contentModified(id));
///   if (step === 'modifiedThenNotify') wire.send(logMessage());
///   if (held.value) { wire.send(held.value); held.value = undefined; }
/// }
/// ```
pub fn respond(wire: &Wire, id: &Value, step: Step, held: &mut Option<Value>) {
    match step {
        Step::Silent => return,
        Step::Hold => {
            // `Some(...)` is the "value present" variant of `Option`: the answer waits in the slot.
            *held = Some(answer(id));
            return;
        }
        Step::Answer => send(wire, answer(id)),
        Step::Modified | Step::ModifiedThenNotify => {
            send(
                wire,
                json!({ "id": id, "error": { "code": -32801, "message": "content modified" } }),
            );
            if step == Step::ModifiedThenNotify {
                send(
                    wire,
                    json!({ "method": "window/logMessage", "params": { "type": 4, "message": "scripted notification after a superseded hint answer" } }),
                );
            }
        }
    }
    // What: `take()` moves the held answer out of the slot and leaves "nothing" behind.
    // Why: A held answer is written exactly once, after the next answer.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const late = held.value; held.value = undefined; if (late) wire.send(late);
    // ```
    if let Some(late) = held.take() {
        send(wire, late);
    }
}
