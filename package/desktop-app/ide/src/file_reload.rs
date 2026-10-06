//! Read authoritative disk text without changing the displayed document or filesystem.

/// Helix correspondence is prepared separately from applying current reading state.
use crate::document::{Document, Reload};
/// I/O failures retain their affected input and operation context.
use anyhow::{Context, Result, bail};
/// What:
///  Path borrows a filesystem name,
///  unlike the owned PathBuf sibling.
/// Why:
///  A read operation need not copy or retain the caller's path.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function readReload(snapshot: Document, path: string): Reload | undefined;
/// ```
use std::path::Path;

/// Read one regular UTF-8 file and prepare correspondence only if its bytes changed.
/// The caller retains the previous document on missing-file or decoding failures.
pub fn read_reload(snapshot: &Document, path: &Path) -> Result<Option<Reload>> {
    // What: ? propagates failure; the closure supplies the affected path lazily.
    // Why: A read failure must not silently replace visible source with empty text.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const metadata = await stat(path); // throws with path context
    // ```
    let metadata = std::fs::metadata(path)
        .with_context(|| return format!("Cannot inspect source file {}", path.display()))?;
    if !metadata.is_file() {
        // bail! returns an error rather than opening a directory or potentially blocking device.
        bail!(
            "Cannot refresh {}: source is not a regular file",
            path.display()
        );
    }
    let source = std::fs::read_to_string(path)
        .with_context(|| return format!("Cannot read source file {} as UTF-8", path.display()))?;
    // What: Iterator::eq compares bytes incrementally without cloning the old rope into a string.
    // Why: An unchanged poll must not increment the source revision or compute a diff.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (sameBytes(snapshot.text, source)) return undefined;
    // ```
    if snapshot.text().bytes().eq(source.bytes()) {
        // None is a successful unchanged read, not a suppressed read failure.
        return Ok(None);
    }
    tracing::debug!(path = %path.display(), base = snapshot.revision(), "preparing changed disk source");
    // What: &source lends bytes to Helix; Some carries the prepared replacement on success.
    // Why: Only the UI thread applies this result to the latest selection.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return snapshot.prepareReload(source);
    // ```
    return Ok(Some(snapshot.prepare_reload(&source)));
}
