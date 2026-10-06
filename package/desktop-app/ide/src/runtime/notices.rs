//! The license and notice texts embedded in the executable,
//!  as `monochromatic-ide --licenses`
//! prints them.
//!
//! What:
//!  [`is_notice`] decides which embedded files are license or notice texts,
//!  [`collect`] checks
//!       their digests,
//!  and [`write`] prints each one in full under a heading.
//! Why:
//!  The user chose on 2026-10-06 that the executable shows the texts it carries through a
//!      `--licenses` flag;
//!  the files sit inside the executable,
//!  so nothing else can show them.

/// Each text is digest-checked before anything is printed.
use super::embedded::EmbeddedRuntime;
/// Damage is an error with the file and the remedy.
use anyhow::Result;
/// Printing goes to any writer:
///  standard output in the executable,
///  a buffer in tests.
use std::io::Write;

/// What:
///  One license or notice text:
///  its path in the embedded table and its checked bytes.
///       `&'static` borrows data stored in the executable for the whole program.
/// Why:
///  The heading names the path,
///  so a reader can find the same file in the source tree.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Notice = { path: string; text: Uint8Array };
/// ```
#[derive(Debug)]
pub struct Notice {
    /// Path in the embedded table,
    ///  for example `runtime/licenses/rust/LICENSE`.
    pub path: &'static str,
    /// The text exactly as it was when the executable was built.
    pub text: &'static [u8],
}

/// What:
///  Whether an embedded path is a license or notice text:
///  everything below `LICENSES/` and
///       `runtime/licenses/`,
///  and any other file whose name (ignoring case) contains `LICENSE` or
///       `LICENCE` or starts with `COPYING` or `NOTICE`.
///  `rsplit('/')` walks the path's parts from
///       the end,
///  so its first item is the file name.
/// Why:
///  Most texts sit in those two folders,
///  but Helix also ships a license beside some query files
///      (`runtime/queries/snakemake/LICENSE`).
///  Query read-me files are documentation or a source
///      link,
///  not license terms,
///  so they are left out.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function isNotice(path: string): boolean
/// ```
pub fn is_notice(path: &str) -> bool {
    if path.starts_with("LICENSES/") || path.starts_with("runtime/licenses/") {
        return true;
    }
    let name = path.rsplit('/').next().unwrap_or(path).to_ascii_uppercase();
    return name.contains("LICENSE")
        || name.contains("LICENCE")
        || name.starts_with("COPYING")
        || name.starts_with("NOTICE");
}

/// What:
///  Every license and notice text of `runtime`,
///  in path order,
///  each digest-checked.
///       `Result<Vec<Notice>>` is the list or the first damage found.
/// Why:
///  All texts are checked before any is printed,
///  so a damaged executable prints no partial list.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function collect(runtime: EmbeddedRuntime): Notice[] // throws on damage
/// ```
pub fn collect(runtime: &EmbeddedRuntime) -> Result<Vec<Notice>> {
    let mut notices = Vec::new();
    // What: `filter(|file| ...)` keeps the files the arrow function accepts.
    // Why: Only license and notice texts are printed.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // for (const file of runtime.files.filter(file => isNotice(file.path))) { ... }
    // ```
    for file in runtime
        .files
        .iter()
        .filter(|file| return is_notice(file.path))
    {
        // `required` checks the digest; the file is in the table, so only damage can fail here.
        let text = runtime.required(file.path)?;
        notices.push(Notice {
            path: file.path,
            text,
        });
    }
    return Ok(notices);
}

/// What:
///  The heading line for one text,
///  saying whose text it is.
///       `strip_prefix` returns the rest of the text after a prefix,
///  or `None` without it.
/// Why:
///  A reader scanning the output must see which component each text belongs to.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function heading(path: string): string
/// ```
fn heading(path: &str) -> String {
    if let Some(rest) = path.strip_prefix("runtime/licenses/") {
        // `split_once('/')` divides `<grammar>/<file>` at its first slash.
        let (grammar, file) = rest.split_once('/').unwrap_or((rest, ""));
        return format!("Language grammar {grammar}: {file}");
    }
    if let Some(rest) = path.strip_prefix("runtime/queries/") {
        let (language, file) = rest.split_once('/').unwrap_or((rest, ""));
        return format!("Helix highlighting queries for {language}: {file}");
    }
    if let Some(file) = path.strip_prefix("LICENSES/font/") {
        return format!("Font compiled into the application: {file}");
    }
    if let Some(file) = path.strip_prefix("LICENSES/") {
        return format!("Monochromatic IDE: {file}");
    }
    if path == "runtime/Helix-LICENSE" {
        return "Helix (highlighting queries and the Helix crates compiled in): Helix-LICENSE"
            .to_string();
    }
    return path.to_string();
}

/// What:
///  Print an introduction,
///  then every text in full under a framed heading that names its
///       component and its embedded path.
///  `&mut impl Write` lends any writer for writing.
/// Why:
///  One plain-text stream that a pager,
///  a file,
///  or a terminal can hold.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function write(notices: Notice[], version: string, out: Writable): void
/// ```
pub fn write(notices: &[Notice], version: &str, out: &mut impl Write) -> std::io::Result<()> {
    let rule = "=".repeat(78);
    writeln!(
        out,
        "Monochromatic IDE {version} carries these {} license and notice texts, each in full below.",
        notices.len()
    )?;
    writeln!(
        out,
        "The notices of the Rust crates compiled into the executable are not collected here yet."
    )?;
    for notice in notices {
        writeln!(out)?;
        writeln!(out, "{rule}")?;
        writeln!(out, "{}", heading(notice.path))?;
        writeln!(out, "Embedded as {}", notice.path)?;
        writeln!(out, "{rule}")?;
        writeln!(out)?;
        out.write_all(notice.text)?;
        // A text without a final line break still ends its line before the next heading.
        if !notice.text.ends_with(b"\n") {
            writeln!(out)?;
        }
    }
    return Ok(());
}

/// Selection,
///  headings,
///  and damage,
///  on a small table.
#[cfg(test)]
#[path = "notices_tests.rs"]
mod tests;
