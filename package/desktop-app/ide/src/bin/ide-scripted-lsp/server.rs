//! Request and notification handling:
//!  one blocking read loop on the main thread.

/// Text mirroring and position arithmetic.
use crate::document::{apply_change, line_at, offset_at};
/// Framing,
///  the report,
///  and pending client replies.
use crate::framing::{Wire, read_message};
/// Settings of this run.
use crate::script::{Hover, Init, Script};
/// JSON values and the literal-building macro.
use serde_json::{Value, json};
/// What:
///  `HashMap` is a key-value table;
///  `Arc` is a thread-safe shared pointer (siblings:
///  `Rc`
///       for one thread,
///  `Box` for one owner);
///  `thread` starts helper threads.
/// Why:
///  A delayed hover answer and the client probe must not block the read loop.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const documents = new Map<string, string>();
/// ```
use std::{collections::HashMap, io, sync::Arc, thread, time::Duration};

/// What:
///  The loop's own state.
///  `String` owns its text (sibling:
///  borrowed `&str`).
/// Why:
///  Only the main thread reads and edits documents,
///  so no lock is needed for them.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// class Session { documents = new Map<string, string>(); probed = false; hovers = 0; }
/// ```
struct Session {
    /// Settings of this run.
    script: Script,
    /// Shared output stream,
    ///  report,
    ///  and reply table.
    wire: Arc<Wire>,
    /// Text of every open document by address.
    documents: HashMap<String, String>,
    /// Whether the client probe was already started.
    probed: bool,
    /// Number of hover requests seen.
    hovers: u64,
    /// Whether the scripted stall already happened.
    stalled: bool,
}

/// Capabilities announced in the `initialize` answer.
fn capabilities(script: &Script) -> Value {
    // `mut` allows adding optional members below.
    let mut result = json!({ "hoverProvider": true });
    if let Some(encoding) = script.encoding {
        result["positionEncoding"] = json!(match encoding {
            crate::script::Unit::Utf8 => "utf-8",
            crate::script::Unit::Utf16 => "utf-16",
            crate::script::Unit::Utf32 => "utf-32",
        });
    }
    if let Some(change) = script.sync {
        result["textDocumentSync"] = json!({ "openClose": true, "change": change });
        if script.save {
            result["textDocumentSync"]["save"] = json!(true);
        }
    }
    if script.all_features {
        result["definitionProvider"] = json!(true);
        result["referencesProvider"] = json!(true);
        result["inlayHintProvider"] = json!({ "resolveProvider": true });
    }
    if script.pull_diagnostics {
        result["diagnosticProvider"] = json!({ "identifier": "scripted", "interFileDependencies": false, "workspaceDiagnostics": false });
    }
    return result;
}

/// Session behavior.
impl Session {
    /// What:
    ///  Send a message,
    ///  turning a write failure into a line on standard error.
    /// Why:
    ///  A closed pipe ends the loop at the next read;
    ///  one failed write needs no other handling.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// send(message: object) { try { wire.send(message); } catch (error) { console.error(error); } }
    /// ```
    fn send(&self, message: Value) {
        if let Err(error) = self.wire.send(message) {
            eprintln!("scripted language server cannot write: {error}");
        }
    }

    /// What:
    ///  Sleep once,
    ///  on the read loop itself,
    ///  before the first message of the scripted
    ///       method is handled.
    ///  `&mut self` allows remembering that the stall happened.
    /// Why:
    ///  Unlike a delayed hover answer,
    ///  which a helper thread sends late,
    ///  this holds back
    ///      everything:
    ///  the message itself and all the client sends after it wait unread,
    ///  so
    ///      a request sent meanwhile can pass its timeout before the server reads it.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// stall(method: string) { if (!this.stalled && method === script.stallAt) { this.stalled = true; sleepSync(script.stall); } }
    /// ```
    fn stall(&mut self, method: &str) {
        if self.stalled || self.script.stall == 0 || method != self.script.stall_at {
            return;
        }
        self.stalled = true;
        thread::sleep(Duration::from_millis(self.script.stall));
    }

    /// Record the server's copy of a document and,
    ///  when configured,
    ///  push diagnostics that quote it.
    fn publish(&self, uri: &str, version: &Value) {
        // `get` returns `Option<&String>`; `map_or` substitutes empty text for an unknown document.
        let text = self
            .documents
            .get(uri)
            .map_or("", |found| return found.as_str());
        self.wire
            .record(json!({ "text": { "uri": uri, "version": version, "text": text } }));
        if !self.script.push_diagnostics {
            return;
        }
        let mut params = json!({
            "uri": uri,
            "diagnostics": [{
                "range": { "start": { "line": 0, "character": 0 }, "end": { "line": 0, "character": 1 } },
                "severity": 2,
                "source": "scripted",
                "message": format!("TEXT:{text}"),
            }],
        });
        if self.script.versioned_diagnostics {
            // `clone` copies the JSON number so the notification owns its own value.
            params["version"] = version.clone();
        }
        self.send(json!({ "method": "textDocument/publishDiagnostics", "params": params }));
    }

    /// What:
    ///  Answer a hover request according to the script.
    ///  `&mut self` allows counting requests.
    /// Why:
    ///  Hover is the request tests use for delay,
    ///  crash,
    ///  supersession,
    ///  and silence.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// hover(id: unknown, params: HoverParams): void
    /// ```
    fn hover(&mut self, id: &Value, params: &Value) {
        self.hovers += 1;
        let modified = self.script.hover == Hover::Modified
            || (self.script.hover == Hover::ModifiedOnce && self.hovers == 1);
        if self.script.hover == Hover::Crash {
            // The configured line comes right before the end, as a crashing server's last words.
            if let Some(line) = &self.script.stderr_at_shutdown {
                eprintln!("{line}");
            }
            std::process::exit(7);
        }
        if self.script.hover == Hover::Silent {
            return;
        }
        let uri = params["textDocument"]["uri"].as_str().unwrap_or("");
        let text = self
            .documents
            .get(uri)
            .map_or("", |found| return found.as_str());
        let position = &params["position"];
        let offset = offset_at(
            text,
            position["line"].as_u64().unwrap_or(0),
            position["character"].as_u64().unwrap_or(0),
            self.script.unit(),
        );
        let line = line_at(text, offset);
        let answer = if modified {
            // The answer a server gives when its own state moved under the request.
            json!({ "id": id, "error": { "code": -32801, "message": "content modified" } })
        } else if line.trim().is_empty() {
            json!({ "id": id, "result": null })
        } else {
            // `chars().next()` reads the character at the offset, if any; `map_or` renders it as text.
            let character = text[offset..]
                .chars()
                .next()
                .map_or(String::new(), |found| return found.to_string());
            json!({ "id": id, "result": {
                "contents": { "kind": "markdown", "value": format!("line={line} char={character}") },
                "range": { "start": position, "end": position },
            } })
        };
        if self.script.hover_delay == 0 {
            self.send(answer);
            if self.script.push_after_hover {
                // An unversioned push that arrives after an answer, as delayed analysis produces.
                self.publish(uri, &Value::Null);
            }
            return;
        }
        // What: `Arc::clone` copies the shared pointer; `thread::spawn(move || ...)` runs the
        //       closure on a new thread, moving the captured values into it.
        // Why: The answer was computed from the text at request time and is sent late, so a
        //      change notification can overtake it, which is the stale-reply case.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // setTimeout(() => wire.send(answer), hoverDelay);
        // ```
        let wire = Arc::clone(&self.wire);
        let delay = Duration::from_millis(self.script.hover_delay);
        thread::spawn(move || {
            thread::sleep(delay);
            if let Err(error) = wire.send(answer) {
                eprintln!("scripted language server cannot write a delayed answer: {error}");
            }
        });
    }

    /// Answer one request from the client.
    fn request(&mut self, id: &Value, method: &str, params: &Value) {
        let uri = params["textDocument"]["uri"].as_str().unwrap_or("");
        if method == "initialize" {
            match self.script.init {
                Init::Hang => {}
                Init::Exit => std::process::exit(3),
                Init::Error => self.send(
                    json!({ "id": id, "error": { "code": -32603, "message": "scripted initialize failure" } }),
                ),
                Init::Ok => {
                    // A slow start: the client must not send anything else in the meantime.
                    thread::sleep(Duration::from_millis(self.script.init_delay));
                    self.send(json!({ "id": id, "result": {
                        "capabilities": capabilities(&self.script),
                        "serverInfo": { "name": "ide-scripted-lsp" },
                    } }));
                }
            }
        } else if method == "shutdown" {
            // `if let Some` writes the configured line only when one was given.
            if let Some(line) = &self.script.stderr_at_shutdown {
                eprintln!("{line}");
            }
            self.send(json!({ "id": id, "result": null }));
        } else if method == "textDocument/hover" {
            self.hover(id, params);
        } else if method == "textDocument/definition"
            && let Some(result) = &self.script.definition
        {
            // A scripted result is sent exactly as the test wrote it.
            self.send(json!({ "id": id, "result": result }));
        } else if method == "textDocument/references"
            && let Some(result) = &self.script.references
        {
            self.send(json!({ "id": id, "result": result }));
        } else if method == "textDocument/definition" {
            let range = json!({ "start": { "line": 2, "character": 0 }, "end": { "line": 2, "character": 6 } });
            let mut targets = vec![
                json!({ "uri": uri, "range": range }),
                json!({ "uri": "untitled:Untitled-1", "range": range }),
                json!({ "uri": "jdt://contents/java.base/java/lang/String.class", "range": range }),
                json!({ "uri": "file:///definitely/missing/file.rs", "range": range }),
            ];
            if let Some(outside) = &self.script.outside {
                targets.push(json!({
                    "uri": format!("file://{}", outside.display()),
                    "range": { "start": { "line": 0, "character": 0 }, "end": { "line": 0, "character": 1 } },
                }));
            }
            self.send(json!({ "id": id, "result": targets }));
        } else if method == "textDocument/references" {
            self.send(json!({ "id": id, "error": { "code": -32603, "message": "scripted internal failure" } }));
        } else if method == "textDocument/inlayHint" {
            self.send(json!({ "id": id, "result": [
                {
                    "position": { "line": 0, "character": 5 },
                    "label": [{ "value": "part-a" }, { "value": "-part-b", "command": { "title": "x", "command": "scripted.command" } }],
                    "kind": 1,
                    "paddingLeft": true,
                    "textEdits": [{ "range": { "start": { "line": 0, "character": 5 }, "end": { "line": 0, "character": 5 } }, "newText": ": T" }],
                    "data": { "resolveMe": true },
                },
                { "position": { "line": 99, "character": 0 }, "label": "past-end" },
            ] }));
        } else if method == "textDocument/diagnostic" {
            let text = self
                .documents
                .get(uri)
                .map_or("", |found| return found.as_str());
            self.send(json!({ "id": id, "result": { "kind": "full", "items": [{
                "range": { "start": { "line": 0, "character": 0 }, "end": { "line": 0, "character": 1 } },
                "severity": 1,
                "source": "scripted-pull",
                "message": format!("PULLED:{text}"),
            }] } }));
        } else {
            self.send(json!({ "id": id, "error": { "code": -32601, "message": format!("scripted server has no {method}") } }));
        }
    }

    /// React to one notification from the client.
    fn notification(&mut self, method: &str, params: &Value) {
        let uri = params["textDocument"]["uri"].as_str().unwrap_or("");
        let version = &params["textDocument"]["version"];
        if method == "exit" {
            // A lingering server stays; the client then has to kill it.
            if !self.script.linger {
                std::process::exit(0);
            }
        } else if method == "textDocument/didOpen" {
            let text = params["textDocument"]["text"].as_str().unwrap_or("");
            self.documents.insert(uri.to_string(), text.to_string());
            self.publish(uri, version);
            if self.script.probe && !self.probed {
                self.probed = true;
                let wire = Arc::clone(&self.wire);
                let target = uri.to_string();
                thread::spawn(move || {
                    crate::probe::run(&wire, &target);
                });
            }
        } else if method == "textDocument/didChange" {
            // `entry(...).or_default()` borrows the stored text for editing, creating empty text first if absent.
            let text = self.documents.entry(uri.to_string()).or_default();
            // `as_array()` is `Some` for a JSON array; `into_iter().flatten()` walks its items or nothing.
            for change in params["contentChanges"].as_array().into_iter().flatten() {
                apply_change(text, change, self.script.unit());
            }
            self.publish(uri, version);
        } else if method == "textDocument/didClose" {
            self.documents.remove(uri);
        }
    }
}

/// What:
///  Run until the client closes standard input or sends `exit`.
///  `io::Result<()>` is success
///       without a value or an I/O error.
/// Why:
///  Every received message is recorded before it is handled,
///  so the report shows the exact
///      order the client produced.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// for await (const message of messages(process.stdin)) { record(message); handle(message); }
/// ```
pub fn run(script: Script) -> io::Result<()> {
    // `as_deref()` turns `Option<PathBuf>` into `Option<&Path>` without copying.
    let wire = Arc::new(Wire::new(script.report.as_deref())?);
    if let Ok(writes) = std::env::var("IDE_SCRIPTED_AUDIT") {
        // Recorded before anything else, so a sandbox audit exists even if the session fails.
        wire.record(json!({ "audit": crate::audit::audit(&writes) }));
    }
    wire.record(json!({ "started": { "cwd": std::env::current_dir()?.display().to_string(), "pid": std::process::id() } }));
    let mut session = Session {
        script,
        wire: Arc::clone(&wire),
        documents: HashMap::new(),
        probed: false,
        hovers: 0,
        stalled: false,
    };
    // `lock()` on standard input returns a buffered reader this thread owns.
    let mut input = io::stdin().lock();
    // `while let Some(x) = ...` repeats until the call yields "nothing", which is end of input.
    while let Some(message) = read_message(&mut input)? {
        let method = message["method"].as_str();
        let id = &message["id"];
        match method {
            Some(name) => {
                session
                    .wire
                    .record(json!({ "received": name, "id": id, "params": message["params"] }));
                // The report shows the message as received before the scripted stall holds it back.
                session.stall(name);
                if id.is_null() {
                    session.notification(name, &message["params"]);
                } else {
                    session.request(id, name, &message["params"]);
                }
            }
            None => {
                let reply = if message["error"].is_null() {
                    json!({ "result": message["result"] })
                } else {
                    json!({ "error": message["error"] })
                };
                session.wire.resolve(id.as_u64().unwrap_or(0), reply);
            }
        }
    }
    // What: `loop` without a condition repeats forever; `thread::sleep` pauses this thread.
    // Why: A lingering server outlives the end of its input, as a stuck server would, until it
    //      is killed.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (script.linger) for (;;) await sleep(3_600_000);
    // ```
    if session.script.linger {
        loop {
            thread::sleep(Duration::from_secs(3600));
        }
    }
    // `Ok(())` reports success without a value.
    return Ok(());
}
