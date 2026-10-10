//! What the server can see and change from inside its sandbox,
//!  recorded once at start.

/// What:
///  `Value` is any JSON value;
///  `json!` builds one from literal syntax.
/// Why:
///  The audit is one report line.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Value = unknown;
/// ```
use serde_json::{Value, json};
/// What:
///  `Write` adds `write_all` to files;
///  `OpenOptions` opens a file with chosen modes.
/// Why:
///  Write attempts use the same open-for-append the build-script probe uses.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { appendFileSync } from 'node:fs';
/// ```
use std::{fs::OpenOptions, io::Write};

/// What:
///  Mount points mounted read-write,
///  from `/proc/self/mountinfo`.
/// Why:
///  Inside the sandbox only the private state,
///  `/tmp`,
///  and the kernel file systems may be writable.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function writableMounts(): string[]
/// ```
fn writable_mounts() -> Vec<String> {
    let mut found = Vec::new();
    // `unwrap_or_default` substitutes empty text when the table cannot be read.
    let table = std::fs::read_to_string("/proc/self/mountinfo").unwrap_or_default();
    for line in table.lines() {
        // Fields: id, parent, device, root, mount point, mount options, ...
        let fields: Vec<&str> = line.split(' ').collect();
        if fields.len() > 5 && fields[5].split(',').any(|option| return option == "rw") {
            found.push(fields[4].to_string());
        }
    }
    return found;
}

/// Try to append to `path` and report the result with the raw error number.
fn attempt_write(path: &str) -> Value {
    let outcome = OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .and_then(|mut file| return file.write_all(b"x"));
    return match outcome {
        Ok(()) => json!({ "path": path, "ok": true }),
        Err(error) => json!({ "path": path, "ok": false, "errno": error.raw_os_error() }),
    };
}

/// What:
///  Build the audit record.
///  `writes` is a colon-separated list of files to try writing.
/// Why:
///  The confinement acceptance tests read this record through the application's real start path.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function audit(writes: string): object
/// ```
pub fn audit(writes: &str) -> Value {
    let mut names: Vec<String> = Vec::new();
    // `vars_os` lists every variable; only the names are recorded, never the values.
    for (name, _) in std::env::vars_os() {
        names.push(name.to_string_lossy().into_owned());
    }
    names.sort();
    let mut namespaces = json!({});
    for kind in ["user", "pid", "net", "mnt"] {
        let link = std::fs::read_link(format!("/proc/self/ns/{kind}"))
            .map_or(String::new(), |target| return target.display().to_string());
        namespaces[kind] = json!(link);
    }
    let mut results = Vec::new();
    for path in writes.split(':') {
        if !path.is_empty() {
            results.push(attempt_write(path));
        }
    }
    // The working directory shows which spelling of the project root exists inside the sandbox.
    let cwd = std::env::current_dir().map_or(String::new(), |found| {
        return found.display().to_string();
    });
    return json!({
        "pid": std::process::id(),
        "cwd": cwd,
        "environment": names,
        "writableMounts": writable_mounts(),
        "namespaces": namespaces,
        "writes": results,
    });
}
