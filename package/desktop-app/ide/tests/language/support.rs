//! Shared fixtures for Language integration tests: a child process per test, a scripted server,
//! and a polling probe around the worker handle.
//!
//! Helix derives every server root from the process working directory and keeps the first
//! value it reads. A test that starts a server therefore runs its body in a child process whose
//! working directory was set when it was spawned; the test process itself never changes directory.

use helix_core::Rope;
use ide_app::document::Document;
use ide_app::language::{
    LanguageWorker,
    config::LanguageSetup,
    diagnostics::DiagnosticsSnapshot,
    hints::HintsSnapshot,
    identity::DocumentStamp,
    reply::{LanguageReply, PositionRequest, RequestKind},
    status::{LanguageStatus, ServerState},
    sync::{DocumentOpen, DocumentReload},
};
use serde_json::Value;
use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
    sync::Arc,
    time::{Duration, Instant},
};

/// Set in the child process to the project root the body works on.
const ROOT_VARIABLE: &str = "IDE_LANGUAGE_TEST_ROOT";

/// Name of the scripted server definition.
pub const SERVER: &str = "scripted-ls";

/// Longest wait for any expected state.
const PATIENCE: Duration = Duration::from_secs(20);

/// Where the child process works: its project root, its working directory, and its `PWD`.
pub struct Layout {
    /// Project root handed to the worker.
    pub root: PathBuf,
    /// Working directory of the child process.
    pub cwd: PathBuf,
    /// Value of the `PWD` variable, which Helix prefers when it names the working directory;
    /// nothing removes the variable.
    pub pwd: Option<PathBuf>,
}

/// The usual layout: the project root is the working directory.
pub fn standard(base: &Path) -> Layout {
    let root = base.join("project");
    fs::create_dir(&root).expect("project directory");
    return Layout {
        root: root.clone(),
        cwd: root,
        pwd: None,
    };
}

/// In the child process: the project root. In the test process: nothing.
pub fn child_root() -> Option<PathBuf> {
    return std::env::var_os(ROOT_VARIABLE).map(PathBuf::from);
}

/// Run the named test again in a child process laid out by `layout`, and require it to pass.
/// `test` is the full test name, including its module.
pub fn run_child(test: &str, layout: fn(&Path) -> Layout) {
    let directory = tempfile::tempdir().expect("test directory");
    let base = directory
        .path()
        .canonicalize()
        .expect("canonical test directory");
    fs::create_dir(base.join("scratch")).expect("scratch directory");
    let placed = layout(&base);
    let mut command = Command::new(std::env::current_exe().expect("test executable"));
    command
        .args([test, "--exact", "--nocapture", "--test-threads=1"])
        .current_dir(&placed.cwd)
        .env(ROOT_VARIABLE, &placed.root);
    match &placed.pwd {
        Some(pwd) => command.env("PWD", pwd),
        // The parent's value names another directory and would only mislead a reader of the log.
        None => command.env_remove("PWD"),
    };
    let status = command.status().expect("child test process");
    assert!(status.success(), "child process of {test} failed: {status}");
}

/// The scratch directory beside the project, for report files and outside-project fixtures.
pub fn scratch(root: &Path) -> PathBuf {
    let mut current = root;
    loop {
        let candidate = current.join("scratch");
        if candidate.is_dir() && !candidate.starts_with(root) {
            return candidate;
        }
        current = current
            .parent()
            .expect("scratch directory beside the project");
    }
}

/// Path of the scripted server's report file.
pub fn report_path(root: &Path) -> PathBuf {
    return scratch(root).join("report.jsonl");
}

/// Language definitions for the scripted server with the given environment and request timeout.
pub fn scripted(root: &Path, variables: &[(&str, &str)], timeout: u64) -> String {
    return scripted_with_roots(root, variables, timeout, "[]");
}

/// Like `scripted`, with root-marker file names in TOML array syntax.
pub fn scripted_with_roots(
    root: &Path,
    variables: &[(&str, &str)],
    timeout: u64,
    roots: &str,
) -> String {
    let mut environment = format!("IDE_SCRIPTED_REPORT = '{}'", report_path(root).display());
    for (name, value) in variables {
        environment.push_str(&format!(", IDE_SCRIPTED_{name} = '{value}'"));
    }
    return format!(
        r#"
[language-server.{SERVER}]
command = '{program}'
timeout = {timeout}
environment = {{ {environment} }}

[language-server.{SERVER}.config.scripted]
flag = true
nested = {{ value = 42 }}

[[language]]
name = "scripted"
scope = "source.scripted"
file-types = ["scripted"]
roots = {roots}
language-servers = ["{SERVER}"]
"#,
        program = env!("CARGO_BIN_EXE_ide-scripted-lsp"),
    );
}

/// The worker handle plus everything polled from it so far.
pub struct Probe {
    /// The handle under test.
    pub worker: LanguageWorker,
    /// Latest status seen.
    pub status: Arc<LanguageStatus>,
    /// Every reply the fence let through, in arrival order.
    pub replies: Vec<LanguageReply>,
    /// Latest diagnostics seen.
    pub diagnostics: Option<Arc<DiagnosticsSnapshot>>,
    /// Latest hints seen.
    pub hints: Option<Arc<HintsSnapshot>>,
    /// The document as the application would hold it.
    pub document: Document,
    /// File-open generation of the displayed file.
    pub file: u64,
    /// Path of the displayed file.
    pub path: PathBuf,
}

impl Probe {
    /// Start a worker for `root` with application-supplied definitions.
    pub fn new(root: &Path, definitions: String) -> Self {
        let setup = LanguageSetup {
            extra_languages: Some(definitions),
            ..LanguageSetup::default()
        };
        return Self::with_setup(root, setup);
    }

    /// Start a worker for `root` with an explicit setup.
    pub fn with_setup(root: &Path, setup: LanguageSetup) -> Self {
        let worker = LanguageWorker::with_setup(root, setup).expect("language worker");
        return Self {
            worker,
            status: Arc::new(LanguageStatus::closed()),
            replies: Vec::new(),
            diagnostics: None,
            hints: None,
            document: Document::new(""),
            file: 0,
            path: PathBuf::new(),
        };
    }

    /// The stamp of the displayed text.
    pub fn stamp(&self) -> DocumentStamp {
        return DocumentStamp {
            file: self.file,
            revision: self.document.revision(),
        };
    }

    /// Write `text` to `path` and display it, as the application does after reading a file.
    pub fn open(&mut self, path: &Path, text: &str) {
        fs::write(path, text).expect("source file");
        self.display(path, text);
    }

    /// Display `text` for an existing `path` without writing it.
    pub fn display(&mut self, path: &Path, text: &str) {
        self.file += 1;
        self.document = Document::new(text);
        self.path = path.to_path_buf();
        let sent = self
            .worker
            .open(DocumentOpen {
                path: path.to_path_buf(),
                text: Rope::from_str(text),
                stamp: self.stamp(),
            })
            .expect("worker accepts open");
        assert!(sent, "command queue full");
    }

    /// Replace the file on disk and apply the reload exactly as the application's reload path does.
    pub fn reload(&mut self, text: &str) {
        fs::write(&self.path, text).expect("changed source file");
        let reload = self.document.prepare_reload(text);
        let command = DocumentReload::from_reload(self.file, &reload);
        assert!(self.document.apply_reload(reload), "reload accepted");
        assert!(self.worker.reload(command).expect("worker accepts reload"));
    }

    /// Send a position request and return its number.
    pub fn request(&mut self, kind: RequestKind, position: usize) -> u64 {
        let request = PositionRequest {
            stamp: self.stamp(),
            kind,
            position,
        };
        return self
            .worker
            .request(request)
            .expect("worker accepts request")
            .expect("command queue has room");
    }

    /// Drain everything the worker published since the last poll.
    pub fn poll(&mut self) {
        if let Some(status) = self.worker.try_take_status().expect("status poll") {
            self.status = status;
        }
        while let Some(reply) = self.worker.try_take_reply().expect("reply poll") {
            self.replies.push(reply);
        }
        if let Some(diagnostics) = self
            .worker
            .try_take_diagnostics()
            .expect("diagnostics poll")
        {
            self.diagnostics = Some(diagnostics);
        }
        if let Some(hints) = self.worker.try_take_hints().expect("hints poll") {
            self.hints = Some(hints);
        }
    }

    /// Poll until `done` holds, or fail with the last observed state.
    pub fn until(&mut self, what: &str, done: impl Fn(&Probe) -> bool) {
        let start = Instant::now();
        loop {
            self.poll();
            if done(self) {
                return;
            }
            assert!(
                start.elapsed() < PATIENCE,
                "timed out waiting for {what}; status {:?}; replies {:?}; diagnostics {:?}; hints {:?}",
                self.status,
                self.replies,
                self.diagnostics,
                self.hints
            );
            std::thread::sleep(Duration::from_millis(5));
        }
    }

    /// State of the named server in the latest status.
    pub fn state(&self, name: &str) -> Option<&ServerState> {
        for row in &self.status.servers {
            if row.server.name == name {
                return Some(&row.state);
            }
        }
        return None;
    }

    /// Wait until the scripted server is ready.
    pub fn until_ready(&mut self) {
        self.until("the scripted server to be ready", |probe| {
            return probe.state(SERVER) == Some(&ServerState::Ready);
        });
    }

    /// Wait for the last reply of request `number` and return every reply it produced.
    pub fn answers(&mut self, number: u64) -> Vec<LanguageReply> {
        self.until("the request to be answered", |probe| {
            return probe
                .replies
                .iter()
                .any(|reply| return reply.request == number && reply.remaining == 0);
        });
        let mut found = Vec::new();
        for reply in &self.replies {
            if reply.request == number {
                found.push(reply.clone());
            }
        }
        return found;
    }

    /// Every message of the displayed diagnostics, in group and position order.
    pub fn messages(&self) -> Vec<String> {
        let mut found = Vec::new();
        if let Some(snapshot) = &self.diagnostics {
            for group in &snapshot.groups {
                for item in &group.items {
                    found.push(item.message.clone());
                }
            }
        }
        return found;
    }
}

/// Every line the scripted server reported so far.
pub fn report(root: &Path) -> Vec<Value> {
    let Ok(text) = fs::read_to_string(report_path(root)) else {
        return Vec::new();
    };
    let mut lines = Vec::new();
    for line in text.lines() {
        // A line still being written is skipped; the next read sees it whole.
        if let Ok(value) = serde_json::from_str(line) {
            lines.push(value);
        }
    }
    return lines;
}

/// Wait until the report satisfies `done`, and return it.
pub fn report_until(root: &Path, what: &str, done: impl Fn(&[Value]) -> bool) -> Vec<Value> {
    let start = Instant::now();
    loop {
        let lines = report(root);
        if done(&lines) {
            return lines;
        }
        assert!(
            start.elapsed() < PATIENCE,
            "timed out waiting for the server report to show {what}: {lines:?}"
        );
        std::thread::sleep(Duration::from_millis(5));
    }
}

/// Methods the server received, in order.
pub fn received(lines: &[Value]) -> Vec<String> {
    let mut methods = Vec::new();
    for line in lines {
        if let Some(method) = line["received"].as_str() {
            methods.push(method.to_string());
        }
    }
    return methods;
}

/// The server's latest copy of the document text, with the version it was sent under.
pub fn server_text(lines: &[Value]) -> Option<(i64, String)> {
    let mut latest = None;
    for line in lines {
        if let Some(text) = line["text"]["text"].as_str() {
            latest = Some((
                line["text"]["version"].as_i64().unwrap_or(-1),
                text.to_string(),
            ));
        }
    }
    return latest;
}

/// Wait until the server's copy of the text equals `expected`.
pub fn server_text_until(root: &Path, expected: &str) -> Vec<Value> {
    return report_until(
        root,
        "the server text to equal the document text",
        |lines| {
            return server_text(lines).is_some_and(|(_, text)| return text == expected);
        },
    );
}

/// Processes whose parent is this process, as `(pid, state letter, command name)`.
pub fn children() -> Vec<(u32, char, String)> {
    let own = std::process::id();
    let mut found = Vec::new();
    for entry in fs::read_dir("/proc").expect("process table").flatten() {
        let name = entry.file_name();
        let Some(pid) = name
            .to_str()
            .and_then(|text| return text.parse::<u32>().ok())
        else {
            continue;
        };
        let Ok(stat) = fs::read_to_string(entry.path().join("stat")) else {
            continue;
        };
        // The command name is in parentheses and may contain spaces; fields follow the last `)`.
        let Some(close) = stat.rfind(')') else {
            continue;
        };
        let open = stat.find('(').unwrap_or(0);
        let fields: Vec<&str> = stat[close + 1..].split_whitespace().collect();
        if fields.len() < 2 {
            continue;
        }
        if fields[1].parse::<u32>().ok() == Some(own) {
            let state = fields[0].chars().next().unwrap_or('?');
            found.push((pid, state, stat[open + 1..close].to_string()));
        }
    }
    return found;
}

/// Wait until this process has no child left, alive or unreaped.
pub fn children_until_none() {
    let start = Instant::now();
    loop {
        let left = children();
        if left.is_empty() {
            return;
        }
        assert!(
            start.elapsed() < Duration::from_secs(5),
            "child processes remain after the worker was dropped: {left:?}"
        );
        std::thread::sleep(Duration::from_millis(10));
    }
}
