//! Inspection-only annotation injection: debug builds started with `IDE_INSPECT_ANNOTATIONS` naming a JSON file
//! install its hints and diagnostics for the initially displayed text, so nested-compositor frames can show them
//! without a language server. Release builds do not contain this module, and without the variable it does nothing.
//!
//! The file holds `{ "hints": [{ "position", "label" }], "diagnostics": [{ "source", "start", "end", "severity",
//! "code", "message" }] }` with character offsets of the initial file; `severity` is `error`, `warning`,
//! `information`, `hint`, or absent. The snapshots carry the initial file generation and revision, so an external
//! change or a file switch makes them stale, and they disappear exactly as stale server snapshots do.

/// The parent's state and the production setter.
use super::{AppWindow, State, annotate};
/// A malformed inspection file stops startup with a message naming it.
use anyhow::{Context, Result, bail};
/// The snapshot records a language server would produce.
use ide_app::language::{
    diagnostics::{Diagnostic, DiagnosticsSnapshot, Freshness, Severity, SourceGroup},
    hints::{HintKind, HintsSnapshot, InlayHint},
    identity::ServerIdentity,
};
/// What: `Deserialize` lets serde build a record from JSON.
/// Why: The inspection file is JSON written by the probe script.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const fixture = JSON.parse(text) as InspectionFile;
/// ```
use serde::Deserialize;
/// Shared UI state and shared snapshot pointers.
use std::{cell::RefCell, rc::Rc, sync::Arc};

/// One hint in the inspection file.
#[derive(Deserialize)]
struct FileHint {
    /// Character offset the label is drawn for.
    position: usize,
    /// Label text as a server would send it.
    label: String,
}

/// One diagnostic in the inspection file.
#[derive(Deserialize)]
struct FileProblem {
    /// Source name the problem is grouped by.
    source: String,
    /// First marked character.
    start: usize,
    /// Character after the marked range.
    end: usize,
    /// What: `Option<String>` is the severity word, or nothing for an omitted severity.
    /// Why: An omitted severity is a real protocol case worth showing.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// severity?: string;
    /// ```
    severity: Option<String>,
    /// Rule or error code.
    code: Option<String>,
    /// Message, possibly several lines.
    message: String,
}

/// The whole inspection file; `#[serde(default)]` lets either list be left out.
#[derive(Deserialize)]
struct InspectionFile {
    /// Hint labels.
    #[serde(default)]
    hints: Vec<FileHint>,
    /// Diagnostics.
    #[serde(default)]
    diagnostics: Vec<FileProblem>,
}

/// Translate a severity word; an unknown word is an error in the inspection file.
fn severity(word: Option<&str>) -> Result<Option<Severity>> {
    let Some(known) = word else {
        return Ok(None);
    };
    if known == "error" {
        return Ok(Some(Severity::Error));
    }
    if known == "warning" {
        return Ok(Some(Severity::Warning));
    }
    if known == "information" {
        return Ok(Some(Severity::Information));
    }
    if known == "hint" {
        return Ok(Some(Severity::Hint));
    }
    bail!("Unknown severity {known:?} in the inspection annotation file");
}

/// What: Read `IDE_INSPECT_ANNOTATIONS` and install its snapshots through the production setter.
///       `Result<()>` is success without a value, or an error naming the file.
/// Why: Nested-compositor frames need hints and diagnostics on a fixture without a real server.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function inject(window: AppWindow, state: Shared<State>): void;
/// ```
pub(super) fn inject(window: &AppWindow, state: &Rc<RefCell<State>>) -> Result<()> {
    // What: `var_os` reads the variable without requiring UTF-8; `let ... else` returns when it is unset.
    // Why: Without the variable the application behaves exactly as without this module.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const path = process.env.IDE_INSPECT_ANNOTATIONS; if (path === undefined) return;
    // ```
    let Some(path) = std::env::var_os("IDE_INSPECT_ANNOTATIONS") else {
        return Ok(());
    };
    let text = std::fs::read_to_string(&path).with_context(|| {
        return format!(
            "Cannot read the inspection annotation file {}",
            path.display()
        );
    })?;
    let file: InspectionFile = serde_json::from_str(&text).with_context(|| {
        return format!(
            "Cannot parse the inspection annotation file {}",
            path.display()
        );
    })?;
    let stamp = annotate::displayed(&state.borrow());
    let server = ServerIdentity {
        name: "inspection".to_string(),
        instance: 0,
    };
    let mut hints = Vec::new();
    for hint in file.hints {
        hints.push(InlayHint {
            position: hint.position,
            label: hint.label,
            kind: Some(HintKind::Type),
            padding_left: false,
            padding_right: false,
            server: server.clone(),
        });
    }
    hints.sort_by_key(|hint| return hint.position);
    let mut groups: Vec<SourceGroup> = Vec::new();
    for problem in file.diagnostics {
        let item = Diagnostic {
            start: problem.start,
            end: problem.end,
            severity: severity(problem.severity.as_deref())?,
            code: problem.code,
            message: problem.message,
            server: server.clone(),
            freshness: Freshness::Versioned,
        };
        // What: `iter_mut().find(...)` lends the group with this source for appending, if one exists.
        // Why: Problems are grouped by source, as the Language module groups them.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const group = groups.find(known => known.source === problem.source);
        // ```
        if let Some(group) = groups
            .iter_mut()
            .find(|known| return known.source == problem.source)
        {
            group.items.push(item);
        } else {
            groups.push(SourceGroup {
                source: problem.source,
                items: vec![item],
            });
        }
    }
    let lines = state.borrow().document.text().len_lines();
    tracing::info!(
        hints = hints.len(),
        groups = groups.len(),
        ?stamp,
        "inspection annotations injected"
    );
    let hint_snapshot = Arc::new(HintsSnapshot {
        stamp,
        first_line: 0,
        last_line: lines,
        hints,
    });
    let problem_snapshot = Arc::new(DiagnosticsSnapshot { stamp, groups });
    annotate::set_annotations(window, state, Some(hint_snapshot), Some(problem_snapshot));
    return Ok(());
}
