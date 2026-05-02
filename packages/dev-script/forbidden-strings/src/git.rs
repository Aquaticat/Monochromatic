// What:     `use std::process::Command;` brings the Command builder into
//           scope. `Command` constructs and runs child processes; we
//           use it for one specific call: `git ls-files -z`.
// Why:      The `--all` mode needs the list of files git considers
//           tracked. Shelling out to git is the simplest way to honor
//           `.gitignore` without re-implementing it.
// TS map:   `import { spawnSync } from "node:child_process";`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { spawnSync } from "node:child_process";
// ```
use std::process::Command;

// What:     `pub fn list_tracked_files() -> Result<Vec<String>, String>`
//           runs `git ls-files -z` and parses NUL-separated output into
//           an owned vector of UTF-8 path strings. `pub` makes the
//           function visible from `main.rs`.
// Why:      `--all` mode uses this to enumerate every git-tracked file.
//           Caller-visible.
// TS map:   `export function listTrackedFiles(): string[]` — except Rust
//           encodes failure in `Result` rather than throwing.
//
// In TS you'd write (pseudocode):
// ```ts
// export function listTrackedFiles(): string[] {
//   const r = spawnSync("git", ["ls-files", "-z"]);
//   if (r.status !== 0) throw new Error(`git ls-files exit ${r.status}`);
//   return r.stdout.toString("utf8").split("\0").filter(Boolean);
// }
// ```
pub fn list_tracked_files() -> Result<Vec<String>, String> {
    // What:     `Command::new("git").args(["ls-files", "-z"]).output()`
    //           is a builder chain: construct a Command, set args, run
    //           it, capture stdout/stderr/exit status.
    // Why:      `git ls-files -z` separates paths by NUL bytes so paths
    //           with newlines or quotes don't break the split.
    // TS map:   `spawnSync("git", ["ls-files", "-z"])`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const output = spawnSync("git", ["ls-files", "-z"]);
    // ```
    let output = Command::new("git")
        .args(["ls-files", "-z"])
        .output()
        .map_err(|e| format!("git ls-files: {}", e))?;
    if !output.status.success() {
        return Err(format!("git ls-files exit {}", output.status));
    }
    let mut files: Vec<String> = Vec::new();
    // What:     `output.stdout.split(|&b| b == 0)` splits a `Vec<u8>`
    //           by predicate. `|&b| b == 0` is a closure (TS arrow fn)
    //           where `&b` destructures the borrowed `&u8` into a
    //           plain `u8` for comparison.
    // Why:      `-z` separator is the NUL byte (`b'\0'`).
    // TS map:   `output.stdout.toString("utf8").split("\0")` — but this
    //           lossy-decodes whereas Rust validates UTF-8 explicitly
    //           (next block).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // for (const chunk of output.stdout.toString("utf8").split("\0")) {
    //   if (chunk.length === 0) continue;
    //   files.push(chunk);
    // }
    // ```
    for chunk in output.stdout.split(|&b| b == 0) {
        if chunk.is_empty() {
            continue;
        }
        // What:     `std::str::from_utf8(chunk)` validates the bytes are
        //           UTF-8; returns `Result<&str, Utf8Error>`. We ignore
        //           non-UTF-8 paths (rare; OsString gymnastics aren't
        //           worth it for this tool).
        // Why:      Forbidden-strings rules are written for source code,
        //           which is overwhelmingly UTF-8.
        // TS map:   `new TextDecoder("utf-8", { fatal: true }).decode(chunk)`
        //           inside try/catch.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // try {
        //   files.push(new TextDecoder("utf-8", { fatal: true }).decode(chunk));
        // } catch { /* skip */ }
        // ```
        if let Ok(s) = std::str::from_utf8(chunk) {
            files.push(s.to_string());
        }
    }
    Ok(files)
}
