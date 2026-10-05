//! Drive the headless Language module through a scripted plan and print what it observed.
//!
//! The package task `inspect:language` builds this program in the bounded container and runs it
//! on the host against disposable projects with real language servers. It reads one JSON plan,
//! makes the plan's project root the working directory exactly as the application does at
//! startup, and prints one JSON object per observation on standard output.

/// JSON rendering of replies, status, diagnostics, and hints.
mod render;
/// Execution of plan steps against the worker handle.
mod session;

/// Failures name the operation that failed.
use anyhow::{Context, Result, bail};
/// What: `Deserialize` lets the serde library decode JSON into these records.
/// Why: A typed plan rejects a malformed step instead of guessing.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Plan = { project: string; steps: Step[] };
/// ```
use serde::Deserialize;
/// What: `PathBuf` is an owned filesystem path (sibling: borrowed `&Path`).
/// Why: Paths come from the decoded plan and outlive it.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type PathBuf = string;
/// ```
use std::path::PathBuf;

/// What: One instruction of a plan. `#[serde(tag = "do")]` selects the variant by the JSON
///       member `do`; `usize` is the address-sized index type and `u64` an unsigned 64-bit count.
/// Why: The same few steps express every real-server check: all five feature paths, the
///      reload, and the stale-reply case.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Step = { do: 'open'; file: string } | { do: 'ready'; seconds: number } | /* ... */;
/// ```
#[derive(Debug, Deserialize)]
#[serde(tag = "do", rename_all = "lowercase")]
pub enum Step {
    /// Display a file of the project, read from disk.
    Open {
        /// Path relative to the project root.
        file: PathBuf,
    },
    /// Wait until some server of the displayed file is ready.
    Ready {
        /// Longest wait.
        seconds: u64,
    },
    /// Send a position request, repeating it until the wanted outcome appears.
    Request {
        /// `definition`, `references`, or `hover`.
        kind: String,
        /// Character offset in the displayed text.
        at: usize,
        /// Outcome to wait for: `hover`, `locations`, `empty`, or empty text for the first answer.
        #[serde(default)]
        until: String,
        /// Longest wait.
        seconds: u64,
    },
    /// Report visible lines and wait for at least `minimum` hints.
    Hints {
        /// First visible line.
        first: usize,
        /// Number of visible lines.
        visible: usize,
        /// Fewest hints that end the wait.
        minimum: usize,
        /// Longest wait.
        seconds: u64,
    },
    /// Wait until the displayed diagnostics number between `minimum` and `maximum`.
    Diagnostics {
        /// Fewest diagnostics that end the wait.
        minimum: usize,
        /// Most diagnostics that end the wait.
        maximum: usize,
        /// Longest wait.
        seconds: u64,
    },
    /// Write new content to the displayed file, as an external editor would, and apply the reload.
    Reload {
        /// The new content.
        text: String,
    },
    /// Send a hover request and reload at once, then report whether its reply was dropped.
    Stale {
        /// Character offset of the hover.
        at: usize,
        /// The new content.
        text: String,
        /// Milliseconds to keep polling afterwards.
        settle: u64,
    },
    /// Keep polling for a fixed time.
    Sleep {
        /// How long.
        milliseconds: u64,
    },
    /// Stop displaying the file.
    Close,
}

/// A whole plan.
#[derive(Debug, Deserialize)]
struct Plan {
    /// Root of a disposable project.
    project: PathBuf,
    /// Steps in order.
    steps: Vec<Step>,
}

/// What: The program entry point. `Result<()>` is success without a value, or an error that is
///       printed and turns into a failure exit status.
/// Why: The working directory is set before anything else, as the application must do, because
///      Helix reads it once and roots every server from it.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const plan = JSON.parse(readFileSync(process.argv[2], 'utf8')); process.chdir(plan.project); run(plan);
/// ```
fn main() -> Result<()> {
    // What: `args_os().nth(1)` takes the first argument after the program name, as an `Option`.
    // Why: The plan file is the only argument.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const planPath = process.argv[2];
    // ```
    let Some(argument) = std::env::args_os().nth(1) else {
        bail!("Usage: ide-language-inspect <plan.json>");
    };
    // `PathBuf::from` wraps the raw argument as a path without converting its bytes.
    let plan_path = PathBuf::from(argument);
    // The trailing `?` returns the error to the caller when reading or decoding fails.
    let encoded = std::fs::read_to_string(&plan_path)
        .with_context(|| return format!("Cannot read plan {}", plan_path.display()))?;
    let plan: Plan = serde_json::from_str(&encoded).context("Cannot decode the plan")?;
    let project = plan
        .project
        .canonicalize()
        .with_context(|| return format!("Cannot resolve project {}", plan.project.display()))?;
    ide_app::language::enter_project_directory(&project)?;
    // Log to standard error so standard output carries only observations.
    tracing_subscriber::fmt()
        .with_env_filter(format!(
            "ide_app=debug,{}",
            ide_app::language::HELIX_LOG_DIRECTIVE
        ))
        .with_writer(std::io::stderr)
        .init();
    let mut session = session::Session::new(&project)?;
    // `enumerate` pairs each step with its position, for the printed record.
    for (number, step) in plan.steps.iter().enumerate() {
        session.run(number, step)?;
    }
    session.finish();
    // `Ok(())` reports success without a value.
    return Ok(());
}
