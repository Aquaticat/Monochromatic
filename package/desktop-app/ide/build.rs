//! Validate UI declarations,
//!  require embedded resources in the native procedural-macro compilation,
//! and generate the table of language files the application binary carries inside itself.

/// What:
///  Include the shared digest function from the application's sources (`#[path]` names the
///       file;
///  `mod` makes it a module of this build script).
/// Why:
///  The digest recorded here must be computed exactly as the application recomputes it.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { fnv1a } from './src/content_digest';
/// ```
#[path = "src/content_digest.rs"]
mod content_digest;

/// What:
///  File system access and path types.
///  `Path` borrows a path,
///  `PathBuf` owns one.
/// Why:
///  The generator walks the prepared runtime and writes one generated source file.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import fs from 'node:fs'; import path from 'node:path';
/// ```
use std::{
    fmt::Write as _,
    fs,
    path::{Path, PathBuf},
};

/// What:
///  The generated file's name below Cargo's `OUT_DIR`.
/// Why:
///  `src/main.rs` includes it by this name.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const GENERATED = 'embedded_runtime.rs';
/// ```
const GENERATED: &str = "embedded_runtime.rs";

/// What:
///  Every regular file below `root`,
///  as (path relative to `root`,
///  absolute path) pairs.
///       `Vec<(String, PathBuf)>` is a growable list of pairs;
///  a work list replaces recursion.
/// Why:
///  Query and notice directories are nested;
///  a work list walks them without growing the stack.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function filesBelow(root: string): Array<[relative: string, absolute: string]>
/// ```
fn files_below(root: &Path) -> Vec<(String, PathBuf)> {
    let mut found: Vec<(String, PathBuf)> = Vec::new();
    // What: `vec![...]` builds a list holding the root; `to_path_buf()` copies it into an owned path.
    // Why: Each step takes one directory off this list and pushes its subdirectories.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const pending = [root];
    // ```
    let mut pending: Vec<PathBuf> = vec![root.to_path_buf()];
    // What: `while let Some(directory) = pending.pop()` loops while the list still has an entry.
    // Why: The walk ends when every directory has been read.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // while (pending.length) { const directory = pending.pop()!; ... }
    // ```
    while let Some(directory) = pending.pop() {
        // What: `unwrap_or_else(|error| panic!(...))` stops the build with a message on failure.
        // Why: A build script reports problems by failing; there is no caller to hand an error to.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const entries = fs.readdirSync(directory, { withFileTypes: true }); // throws
        // ```
        let entries = fs::read_dir(&directory)
            .unwrap_or_else(|error| panic!("Cannot list {}: {error}", directory.display()));
        for listed in entries {
            let entry = listed
                .unwrap_or_else(|error| panic!("Cannot list {}: {error}", directory.display()));
            let path = entry.path();
            // `fs::metadata` follows symbolic links, so a linked file is embedded by its contents.
            let metadata = fs::metadata(&path)
                .unwrap_or_else(|error| panic!("Cannot inspect {}: {error}", path.display()));
            if metadata.is_dir() {
                pending.push(path);
            } else if metadata.is_file() {
                // What: `strip_prefix(root)` gives the part of the path below the root.
                // Why: The table records each file by its place in the runtime layout.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // const relative = path.relative(root, file);
                // ```
                let relative = path
                    .strip_prefix(root)
                    .expect("walked paths lie below the root")
                    .to_str()
                    .unwrap_or_else(|| panic!("{} is not valid Unicode", path.display()))
                    .to_string();
                found.push((relative, path));
            }
        }
    }
    return found;
}

/// What:
///  The grammar file names `manifest.json` lists,
///  such as `sql.so`.
///  `Vec<String>` owns them.
/// Why:
///  The runtime directory may still hold libraries of an earlier selection;
///  only listed ones ship.
///      The manifest is the runtime task's own `JSON.stringify` output,
///  so its `grammars` array is read
///      directly;
///  any entry that is not a plain `<name>.so` stops the build.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function listedGrammars(manifest: string): string[] { return JSON.parse(manifest).grammars; }
/// ```
fn listed_grammars(manifest: &str, location: &Path) -> Vec<String> {
    // What: `split_once("\"grammars\"")` divides the text at the key, returning `Option<(&str, &str)>`.
    // Why: Only the text after the key holds the list.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const after = manifest.split('"grammars"')[1];
    // ```
    let after = manifest
        .split_once("\"grammars\"")
        .map(|(_, rest)| return rest)
        .unwrap_or_else(|| panic!("{} has no grammars list", location.display()));
    let list = after
        .split_once('[')
        .and_then(|(_, rest)| return rest.split_once(']'))
        .map(|(inside, _)| return inside)
        .unwrap_or_else(|| panic!("{} has no grammars array", location.display()));
    let mut names: Vec<String> = Vec::new();
    // What: `split('"').skip(1).step_by(2)` takes the text between each pair of quotes.
    // Why: Every entry is one quoted file name.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const names = list.split('"').filter((_, index) => index % 2 === 1);
    // ```
    for name in list.split('"').skip(1).step_by(2) {
        let plain = name
            .chars()
            .all(|character| return character.is_ascii_alphanumeric() || "_-.".contains(character));
        if !plain || !name.ends_with(".so") || name.starts_with('.') {
            panic!(
                "{} lists an unexpected grammar entry {name:?}",
                location.display()
            );
        }
        names.push(name.to_string());
    }
    if names.is_empty() {
        panic!("{} lists no grammar", location.display());
    }
    return names;
}

/// What:
///  Collect every file the application binary embeds,
///  as (path in the former application
///       directory layout,
///  absolute source path) pairs,
///  sorted by path.
/// Why:
///  One list feeds both the generated table and the build's change tracking.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function embeddedFiles(runtime: string, packageRoot: string): Array<[string, string]>
/// ```
fn embedded_files(runtime: &Path, package: &Path) -> Vec<(String, PathBuf)> {
    let manifest = runtime.join("manifest.json");
    let text = fs::read_to_string(&manifest).unwrap_or_else(|error| {
        panic!(
            "The application binary embeds its language runtime, but {} cannot be read ({error}). Prepare it with `mise run //package/desktop-app/ide:runtime` (the build, build:debug, lint, and test tasks run it first), then build again.",
            manifest.display()
        )
    });
    let mut files: Vec<(String, PathBuf)> = vec![
        ("runtime/manifest.json".to_string(), manifest.clone()),
        (
            "runtime/Helix-LICENSE".to_string(),
            runtime.join("Helix-LICENSE"),
        ),
    ];
    for (relative, path) in files_below(&runtime.join("queries")) {
        files.push((format!("runtime/queries/{relative}"), path));
    }
    for library in listed_grammars(&text, &manifest) {
        let name = library.trim_end_matches(".so");
        let library_path = runtime.join("grammars").join(&library);
        // A listed library that is absent would otherwise fail later as a bare read error without a remedy.
        if !library_path.is_file() {
            panic!(
                "The language manifest {} lists {library}, but {} is missing, so the runtime is incomplete. Prepare it again with `mise run //package/desktop-app/ide:runtime`, then build again.",
                manifest.display(),
                library_path.display()
            );
        }
        files.push((format!("runtime/grammars/{library}"), library_path));
        let notices = files_below(&runtime.join("licenses").join(name));
        if notices.is_empty() {
            panic!(
                "The runtime holds no license notice for the bundled grammar {name}; prepare it again with the runtime task."
            );
        }
        for (relative, path) in notices {
            files.push((format!("runtime/licenses/{name}/{relative}"), path));
        }
    }
    for (relative, path) in files_below(&package.join("LICENSES")) {
        files.push((format!("LICENSES/{relative}"), path));
    }
    for notice in ["Inter-LICENSE.txt", "JetBrainsMono-OFL.txt"] {
        files.push((
            format!("LICENSES/font/{notice}"),
            package.join("asset/font").join(notice),
        ));
    }
    // What: `sort_by(|left, right| left.0.cmp(&right.0))` orders pairs by their first element.
    // Why: The application finds files by halving this sorted list.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // files.sort(([left], [right]) => compare(left, right));
    // ```
    files.sort_by(|left, right| return left.0.cmp(&right.0));
    return files;
}

/// What:
///  Write the Rust source of the embedded table into `OUT_DIR` and tell Cargo what to watch.
/// Why:
///  `include_bytes!` in the generated file copies each file into the executable at compile time.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function generateEmbeddedRuntime(outDir: string, packageRoot: string): void
/// ```
fn generate_embedded_runtime(out_directory: &Path, package: &Path) {
    // What: `ancestors().nth(3)` climbs from `target/<profile>/build/ide-<hash>/out` to `target/<profile>`.
    // Why: The runtime task prepares `target/debug/runtime` and `target/release/runtime`, one per profile.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const profileDirectory = path.resolve(outDir, '../../..');
    // ```
    let profile = out_directory.ancestors().nth(3).unwrap_or_else(|| {
        panic!(
            "Unexpected Cargo output directory {}",
            out_directory.display()
        )
    });
    let runtime = profile.join("runtime");
    println!("cargo:rerun-if-changed={}", runtime.display());
    println!(
        "cargo:rerun-if-changed={}",
        package.join("LICENSES").display()
    );
    println!(
        "cargo:rerun-if-changed={}",
        package.join("asset/font").display()
    );
    let files = embedded_files(&runtime, package);
    let mut table = String::new();
    // What: `let mut key: u64` starts the digest over all paths and file digests.
    // Why: The key names the cache directory, so it changes whenever any embedded file changes.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let keyInput = '';
    // ```
    let mut key_input: Vec<u8> = Vec::new();
    let mut total: usize = 0;
    for (relative, path) in &files {
        let bytes = fs::read(path)
            .unwrap_or_else(|error| panic!("Cannot read {}: {error}", path.display()));
        let digest = content_digest::fnv1a(&bytes);
        total += bytes.len();
        key_input.extend_from_slice(relative.as_bytes());
        key_input.push(0);
        key_input.extend_from_slice(&digest.to_le_bytes());
        let absolute = path
            .to_str()
            .unwrap_or_else(|| panic!("{} is not valid Unicode", path.display()));
        // What: `writeln!(table, ...)` appends one formatted line; `{relative:?}` writes the text as a
        //       quoted, escaped Rust string literal. `.expect` stops on the impossible write failure.
        // Why: Paths become literals in generated code and must stay valid whatever characters they hold.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // table += `EmbeddedFile { path: ${JSON.stringify(relative)}, ... },\n`;
        // ```
        writeln!(
            table,
            "        EmbeddedFile {{ path: {relative:?}, bytes: include_bytes!({absolute:?}), digest: 0x{digest:016x} }},"
        )
        .expect("writing to a String cannot fail");
    }
    let key = format!("{:016x}", content_digest::fnv1a(&key_input));
    let generated = format!(
        "// Generated by build.rs from {runtime}: {count} files, {total} bytes. Do not edit.\n\
         use ide_app::runtime::embedded::{{EmbeddedFile, EmbeddedRuntime}};\n\
         /// The language runtime and license texts this build embeds, sorted by path.\n\
         pub static EMBEDDED_RUNTIME: EmbeddedRuntime = EmbeddedRuntime {{\n    key: {key:?},\n    files: &[\n{table}    ],\n}};\n",
        runtime = runtime.display(),
        count = files.len(),
    );
    let output = out_directory.join(GENERATED);
    fs::write(&output, generated)
        .unwrap_or_else(|error| panic!("Cannot write {}: {error}", output.display()));
}

/// What:
///  Build entry point invoked by Cargo,
///  separate from application main.
/// Why:
///  The non-GUI tests can exercise document logic without opening a window or embedding files.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// if (features.has('gui')) { compileSlint('ui/app.slint'); generateEmbeddedRuntime(outDir, root); }
/// ```
fn main() {
    // Cargo passes this to the Slint procedural macro used by the native module.
    // The standalone compile_with_config validation uses the same embedding policy.
    println!("cargo:rustc-env=SLINT_EMBED_RESOURCES=true");
    // What: Read an optional Cargo feature flag; is_ok means it exists.
    // Why: Headless document tests need no generated UI bindings and no embedded runtime.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (process.env.CARGO_FEATURE_GUI !== undefined) { ... }
    // ```
    if std::env::var("CARGO_FEATURE_GUI").is_ok() {
        // What: Configure fonts and other imported resources as embedded bytes.
        // Why: Runtime rendering must not require the build machine's font files.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const config = compilerConfig({ embedResources: true });
        // ```
        let config = slint_build::CompilerConfiguration::new()
            .embed_resources(slint_build::EmbedResourcesKind::EmbedFiles);
        // What: expect terminates the build on a returned compiler error.
        // Why: A malformed UI must fail compilation rather than ship no window.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // compileSlint('ui/app.slint', config); // throws on failure
        // ```
        slint_build::compile_with_config("ui/app.slint", config).expect("compile IDE UI");
        // What: `PathBuf::from(std::env::var_os(...)...)` reads Cargo's directories as owned paths.
        // Why: The generated table goes to `OUT_DIR`; license texts are read from the package.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // generateEmbeddedRuntime(process.env.OUT_DIR, process.env.CARGO_MANIFEST_DIR);
        // ```
        let out_directory = PathBuf::from(std::env::var_os("OUT_DIR").expect("Cargo sets OUT_DIR"));
        let package = PathBuf::from(
            std::env::var_os("CARGO_MANIFEST_DIR").expect("Cargo sets CARGO_MANIFEST_DIR"),
        );
        generate_embedded_runtime(&out_directory, &package);
    }
}
